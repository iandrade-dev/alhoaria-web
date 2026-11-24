import type { CardapioAlhoaria } from "../components/bancada-proto/cardapio";
import { linhasDoItem, normalizarItem, totalDoItem, type ItemSacola } from "./sacola";

/**
 * Partes puras do modo garçom: a comanda da mesa (mesmos itens da sacola),
 * o corpo enviado à plataforma e a chave de idempotência dos reenvios.
 */

export type StatusPedido = "queued" | "preparing" | "ready" | "delivered" | "canceled";
export type ItemDoPedido = { name: string; quantity: number; unitPriceCents: number; details?: string[] };
export type NovoPedidoMesa = { table: string; note?: string; items: ItemDoPedido[] };

export const STATUS: Record<StatusPedido, { nome: string; aberto: boolean }> = {
  queued: { nome: "Na fila", aberto: true },
  preparing: { nome: "Preparando", aberto: true },
  ready: { nome: "Pronto", aberto: true },
  delivered: { nome: "Entregue", aberto: false },
  canceled: { nome: "Cancelado", aberto: false },
};

export const MAX_MESA = 12;
export const MAX_OBSERVACAO = 280;
/** Limite da plataforma por item da comanda. */
export const MAX_QUANTIDADE_ITEM = 50;
const VALIDADE_DA_TENTATIVA = 24 * 60 * 60 * 1000;

const semQuantidade = (texto: string) => texto.replace(/^\d+x /, "").replace(/ \(a partir de\)$/, "");

/**
 * Cada linha da sacola vira itens da cozinha: o lanche (com ingredientes,
 * adicionais e potinhos nos detalhes e no preço unitário) e, separados,
 * bebida e porção que vieram junto dele. A quantidade da linha vale para todos.
 */
export function itensDaLinha(item: ItemSacola, cardapio: CardapioAlhoaria): ItemDoPedido[] {
  const out: ItemDoPedido[] = [];
  for (const linha of linhasDoItem({ ...item, quantidade: 1 }, cardapio)) {
    const atual = out[out.length - 1];
    if (linha.nivel === 1 && atual) {
      atual.unitPriceCents += linha.valor;
      (atual.details ??= []).push(linha.texto.replace(/^\+ /, ""));
      continue;
    }
    const details = [linha.detalhe, linha.obs].filter((d): d is string => !!d);
    out.push({ name: semQuantidade(linha.texto), quantity: item.quantidade, unitPriceCents: linha.valor, ...(details.length ? { details } : {}) });
  }
  return out;
}

export const itensDoPedido = (itens: readonly ItemSacola[], cardapio: CardapioAlhoaria) => itens.flatMap((item) => itensDaLinha(item, cardapio));
export const totalDosItens = (itens: readonly ItemDoPedido[]) => itens.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
export const totalDaComanda = (itens: readonly ItemSacola[], cardapio: CardapioAlhoaria) => itens.reduce((s, i) => s + totalDoItem(i, cardapio), 0);

export function normalizarMesa(valor: string) {
  return valor.replace(/\s+/g, " ").trim().slice(0, MAX_MESA);
}

/** Valida a comanda e devolve o corpo do POST, ou a mensagem do que falta. */
export function montarPedido(mesa: string, observacao: string, itens: readonly ItemSacola[], cardapio: CardapioAlhoaria): { ok: true; pedido: NovoPedidoMesa } | { ok: false; erro: string } {
  const table = normalizarMesa(mesa);
  if (!table) return { ok: false, erro: "Informe a mesa." };
  if (itens.length === 0) return { ok: false, erro: "Adicione ao menos um item." };
  const validados = itens.map((item) => normalizarItem(item, cardapio));
  if (!validados.every((item): item is ItemSacola => item !== null && item.quantidade <= MAX_QUANTIDADE_ITEM)) {
    return { ok: false, erro: "Revise os itens e as quantidades da comanda conforme o cardápio publicado." };
  }
  const note = observacao.trim().slice(0, MAX_OBSERVACAO);
  const pedido = { table, ...(note ? { note } : {}), items: itensDoPedido(validados, cardapio) };
  if (!pedidoValido(pedido)) return { ok: false, erro: "A comanda excede os limites de itens, preços ou detalhes aceitos pela cozinha." };
  return { ok: true, pedido };
}

/** Assinatura estável do envio: a mesma comanda na mesma empresa reaproveita a chave. */
export function assinaturaDoEnvio(companyId: string, pedido: NovoPedidoMesa) {
  return JSON.stringify([companyId, pedido.table, pedido.note ?? "", pedido.items.map((i) => [i.name, i.quantity, i.unitPriceCents, i.details ?? []])]);
}

type Tentativa = { pedido: NovoPedidoMesa; rascunho: string; iniciadaEm: number };
export type EnvioPendente = { chave: string; assinatura: string; tentativa?: Tentativa };

/**
 * Uma chave por tentativa de envio. Repetir depois de falha de rede ou da
 * plataforma reaproveita a chave (a plataforma devolve o pedido já gravado,
 * sem duplicar). Mudou a comanda, a mesa ou a empresa: chave nova.
 */
export function chaveDoEnvio(pendente: EnvioPendente | null, assinatura: string, novaChave: () => string): EnvioPendente {
  if (pendente && pendente.assinatura === assinatura) return pendente;
  return { chave: novaChave(), assinatura };
}

export const novaChave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

/** Rascunho guardado no aparelho, incluindo a tentativa que pode ter chegado à plataforma. */
export type Rascunho = { versao: 1; mesa: string; observacao: string; itens: ItemSacola[]; pendente: EnvioPendente | null; revisar?: boolean };
export const rascunhoVazio = (): Rascunho => ({ versao: 1, mesa: "", observacao: "", itens: [], pendente: null });

/** A composição não inclui preços, que podem mudar entre a tentativa original e a resposta. */
export function assinaturaDoRascunho(rascunho: Pick<Rascunho, "mesa" | "observacao" | "itens">) {
  return JSON.stringify([normalizarMesa(rascunho.mesa), rascunho.observacao.trim().slice(0, MAX_OBSERVACAO), rascunho.itens]);
}

export function tentativaDoRascunho(rascunho: Rascunho, companyId: string) {
  const pendente = rascunho.pendente;
  const tentativa = pendente?.tentativa;
  return tentativa && tentativa.rascunho === assinaturaDoRascunho(rascunho) && pendente?.assinatura === assinaturaDoEnvio(companyId, tentativa.pedido)
    ? tentativa : null;
}

export function prepararEnvio(rascunho: Rascunho, cardapio: CardapioAlhoaria, agora = Date.now(), gerarChave = novaChave): { ok: true; pendente: EnvioPendente; pedido: NovoPedidoMesa } | { ok: false; erro: string } {
  if (rascunho.revisar) return { ok: false, erro: "Confira os pedidos de hoje e revise a comanda antes de enviar novamente." };
  const congelada = tentativaDoRascunho(rascunho, cardapio.companyId);
  const expirou = (t: Tentativa) => t.iniciadaEm > agora || agora - t.iniciadaEm >= VALIDADE_DA_TENTATIVA;
  const mensagemExpiracao = "A tentativa anterior passou da validade do reenvio. Confira os pedidos de hoje antes de enviar uma nova comanda.";
  if (congelada && rascunho.pendente) {
    if (expirou(congelada)) return { ok: false, erro: mensagemExpiracao };
    return { ok: true, pendente: rascunho.pendente, pedido: congelada.pedido };
  }
  const montado = montarPedido(rascunho.mesa, rascunho.observacao, rascunho.itens, cardapio);
  if (montado.ok === false) return montado;
  const assinatura = assinaturaDoEnvio(cardapio.companyId, montado.pedido);
  const pendente = chaveDoEnvio(rascunho.pendente, assinatura, gerarChave);
  if (pendente.tentativa && expirou(pendente.tentativa)) return { ok: false, erro: mensagemExpiracao };
  return { ...montado, pendente: { ...pendente, tentativa: { pedido: montado.pedido, rascunho: assinaturaDoRascunho(rascunho), iniciadaEm: pendente.tentativa?.iniciadaEm ?? agora } } };
}

function pedidoValido(valor: unknown): valor is NovoPedidoMesa {
  if (!valor || typeof valor !== "object") return false;
  const pedido = valor as Partial<NovoPedidoMesa>;
  if (typeof pedido.table !== "string" || !pedido.table.trim() || pedido.table.length > MAX_MESA ||
    (pedido.note !== undefined && (typeof pedido.note !== "string" || pedido.note.length > MAX_OBSERVACAO)) ||
    !Array.isArray(pedido.items) || pedido.items.length < 1 || pedido.items.length > 60) return false;
  return pedido.items.every((item) => item && typeof item === "object" &&
    typeof item.name === "string" && !!item.name.trim() && item.name.length <= 120 &&
    Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= MAX_QUANTIDADE_ITEM &&
    Number.isInteger(item.unitPriceCents) && item.unitPriceCents >= 0 && item.unitPriceCents <= 1_000_000 &&
    (item.details === undefined || Array.isArray(item.details) && item.details.length <= 12
      && item.details.every((d) => typeof d === "string" && !!d.trim() && d.length <= 120)));
}

export function lerRascunho(raw: string | null, cardapio: CardapioAlhoaria): Rascunho {
  if (!raw) return rascunhoVazio();
  try {
    const d = JSON.parse(raw) as Partial<Rascunho>;
    if (d.versao !== 1 || !Array.isArray(d.itens)) return rascunhoVazio();
    const itens = d.itens.map((item) => normalizarItem(item, cardapio)).filter((item): item is ItemSacola => !!item && item.quantidade <= MAX_QUANTIDADE_ITEM);
    const salva = d.pendente;
    const tentativa = salva?.tentativa;
    const dadosValidos = tentativa && typeof tentativa.rascunho === "string" && Number.isSafeInteger(tentativa.iniciadaEm)
      && pedidoValido(tentativa.pedido) && salva?.assinatura === assinaturaDoEnvio(cardapio.companyId, tentativa.pedido);
    const pendente = salva && typeof salva.chave === "string" && typeof salva.assinatura === "string"
      ? { chave: salva.chave, assinatura: salva.assinatura, ...(dadosValidos ? { tentativa } : {}) } : null;
    const revisar = d.revisar === true || !!pendente && (itens.length !== d.itens.length || !!tentativa && !dadosValidos);
    return { versao: 1, mesa: typeof d.mesa === "string" ? normalizarMesa(d.mesa) : "", observacao: typeof d.observacao === "string" ? d.observacao.slice(0, MAX_OBSERVACAO) : "", itens, pendente, ...(revisar ? { revisar } : {}) };
  } catch { return rascunhoVazio(); }
}

/** Pedidos do dia (horário local do aparelho), mais recentes primeiro. */
export function pedidosDeHoje<T extends { createdAt: string }>(pedidos: readonly T[], agora = new Date()): T[] {
  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const hoje = dia(agora);
  return pedidos.filter((p) => { const d = new Date(p.createdAt); return !Number.isNaN(d.getTime()) && dia(d) === hoje; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
