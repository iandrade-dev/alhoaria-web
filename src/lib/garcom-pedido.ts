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

const semQuantidade = (texto: string) => texto.replace(/^\d+x /, "").replace(/ \(a partir de\)$/, "");

/**
 * Cada linha da sacola vira itens da cozinha: o lanche (com ingredientes,
 * adicionais e potinhos nos detalhes e no preço unitário) e, separados,
 * bebida e porção que vieram junto dele. A quantidade da linha vale para todos.
 */
export function itensDaLinha(item: ItemSacola): ItemDoPedido[] {
  const out: ItemDoPedido[] = [];
  for (const linha of linhasDoItem({ ...item, quantidade: 1 })) {
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

export const itensDoPedido = (itens: readonly ItemSacola[]) => itens.flatMap(itensDaLinha);
export const totalDosItens = (itens: readonly ItemDoPedido[]) => itens.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
export const totalDaComanda = (itens: readonly ItemSacola[]) => itens.reduce((s, i) => s + totalDoItem(i), 0);

export function normalizarMesa(valor: string) {
  return valor.replace(/\s+/g, " ").trim().slice(0, MAX_MESA);
}

/** Valida a comanda e devolve o corpo do POST, ou a mensagem do que falta. */
export function montarPedido(mesa: string, observacao: string, itens: readonly ItemSacola[]): { ok: true; pedido: NovoPedidoMesa } | { ok: false; erro: string } {
  const table = normalizarMesa(mesa);
  if (!table) return { ok: false, erro: "Informe a mesa." };
  if (itens.length === 0) return { ok: false, erro: "Adicione ao menos um item." };
  const note = observacao.trim().slice(0, MAX_OBSERVACAO);
  return { ok: true, pedido: { table, ...(note ? { note } : {}), items: itensDoPedido(itens) } };
}

/** Assinatura estável do envio: a mesma comanda na mesma empresa reaproveita a chave. */
export function assinaturaDoEnvio(companyId: string, pedido: NovoPedidoMesa) {
  return JSON.stringify([companyId, pedido.table, pedido.note ?? "", pedido.items.map((i) => [i.name, i.quantity, i.unitPriceCents, i.details ?? []])]);
}

export type EnvioPendente = { chave: string; assinatura: string };

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

/** Rascunho guardado no aparelho: nada se perde se a rede ou a plataforma cair. */
export type Rascunho = { versao: 1; mesa: string; observacao: string; itens: ItemSacola[]; pendente: EnvioPendente | null };
export const rascunhoVazio = (): Rascunho => ({ versao: 1, mesa: "", observacao: "", itens: [], pendente: null });

export function lerRascunho(raw: string | null): Rascunho {
  if (!raw) return rascunhoVazio();
  try {
    const d = JSON.parse(raw) as Partial<Rascunho>;
    if (d.versao !== 1 || !Array.isArray(d.itens)) return rascunhoVazio();
    const itens = d.itens.map(normalizarItem).filter((i): i is ItemSacola => !!i);
    const pendente = d.pendente && typeof d.pendente.chave === "string" && typeof d.pendente.assinatura === "string" ? { chave: d.pendente.chave, assinatura: d.pendente.assinatura } : null;
    return { versao: 1, mesa: typeof d.mesa === "string" ? normalizarMesa(d.mesa) : "", observacao: typeof d.observacao === "string" ? d.observacao.slice(0, MAX_OBSERVACAO) : "", itens, pendente };
  } catch { return rascunhoVazio(); }
}

/** Pedidos do dia (horário local do aparelho), mais recentes primeiro. */
export function pedidosDeHoje<T extends { createdAt: string }>(pedidos: readonly T[], agora = new Date()): T[] {
  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const hoje = dia(agora);
  return pedidos.filter((p) => { const d = new Date(p.createdAt); return !Number.isNaN(d.getTime()) && dia(d) === hoje; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
