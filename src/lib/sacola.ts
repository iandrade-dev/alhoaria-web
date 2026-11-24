import { brl, type Bebida, type CardapioAlhoaria, type CompraProduto, type Pedido, type PorcaoId, type Linha } from "../components/bancada-proto/cardapio";
import { restaurante } from "../data/restaurante";

export type ConteudoSacola = CompraProduto | { tipo: "lanche"; pedido: Pedido } | { tipo: "bebida"; bebida: Bebida } | { tipo: "porcao"; porcao: PorcaoId };
export type ItemSacola = { id: string; quantidade: number; conteudo: ConteudoSacola };
export const VERSAO_SACOLA = 1;
export const MAX_QUANTIDADE = 99;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (v: object, k: string) => Object.hasOwn(v, k);
const validKey = (v: unknown, o: object): v is string => typeof v === "string" && own(o, v);
const qtdValida = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_QUANTIDADE;

function bebida(v: unknown, disponiveis: readonly Bebida[]): Bebida | null {
  if (!obj(v) || !own(v, "id") || v.id !== "lata" || !own(v, "sabor")) return null;
  return disponiveis.find(b => b.id === "lata" && b.sabor === v.sabor) ?? null;
}

function extras(v: unknown, tabela: Record<string, { max: number }>): Record<string, number> | null {
  if (!obj(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!validKey(k, tabela) || typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > tabela[k].max) return null;
    if (n) out[k] = n;
  }
  return out;
}

export function normalizarConteudo(v: unknown, cardapio: CardapioAlhoaria): ConteudoSacola | null {
  if (!obj(v) || !own(v, "tipo")) return null;
  if (v.tipo === "produto") {
    if (typeof v.id !== "string" || !(v.variante === null || typeof v.variante === "string") ||
      !Array.isArray(v.opcoes) || !v.opcoes.every(o => typeof o === "string")) return null;
    const produto = cardapio.produtoPorId.get(v.id);
    const compra: CompraProduto = { tipo: "produto", id: v.id, variante: typeof v.variante === "string" ? v.variante : null, opcoes: [...v.opcoes] };
    return produto && cardapio.precoProduto(produto, compra) !== null ? compra : null;
  }
  if (v.tipo === "bebida" && own(v, "bebida")) {
    const b = bebida(v.bebida, cardapio.bebidas);
    return b ? { tipo: "bebida", bebida: b } : null;
  }
  if (v.tipo === "porcao" && own(v, "porcao") && validKey(v.porcao, cardapio.PORCOES)) {
    return { tipo: "porcao", porcao: v.porcao as PorcaoId };
  }
  if (v.tipo !== "lanche" || !own(v, "pedido") || !obj(v.pedido)) return null;
  const p = v.pedido;
  if (!own(p, "lanche") || !validKey(p.lanche, cardapio.LANCHES_PRECO) || !own(p, "adicionais") || !own(p, "separados") || !own(p, "bebida") || !own(p, "porcao") || !own(p, "combo") || !own(p, "lataCombo") || !own(p, "opcoes")) return null;
  const adicionais = extras(p.adicionais, cardapio.ADICIONAIS);
  const separados = extras(p.separados, cardapio.SEPARADOS);
  if (!adicionais || !separados || typeof p.combo !== "boolean") return null;
  const b = p.bebida === null ? null : bebida(p.bebida, cardapio.bebidasJunto);
  if (p.bebida !== null && !b) return null;
  if (p.porcao !== null && !validKey(p.porcao, cardapio.PORCOES)) return null;
  const lanche = p.lanche as Pedido["lanche"];
  const trio = cardapio.trioDe(lanche);
  if (p.lataCombo !== null && (typeof p.lataCombo !== "string" || !trio?.latas.some(sabor => sabor === p.lataCombo))) return null;
  let opcoes: Pedido["opcoes"] = null;
  if (lanche !== "dogalho") {
    if (!obj(p.opcoes)) return null;
    opcoes = cardapio.novoPedido(lanche).opcoes!;
    for (const grupo of cardapio.ORDEM_GRUPOS) {
      const valor = own(p.opcoes, grupo) ? p.opcoes[grupo] : null;
      if (valor === null && cardapio.OPCOES[grupo].length === 0) continue;
      if (typeof valor !== "string" || !(valor === "sem" && grupo !== "pao") && !cardapio.opcaoDe(grupo, valor)) return null;
      opcoes[grupo] = valor;
    }
  } else if (p.opcoes !== null) return null;
  const pedido: Pedido = { lanche, opcoes, adicionais, separados, bebida: b, porcao: p.porcao as Pedido["porcao"], combo: p.combo, lataCombo: p.lataCombo as Pedido["lataCombo"] };
  if (pedido.combo && !cardapio.saborDaLataDoCombo(pedido)) return null;
  return { tipo: "lanche", pedido };
}

export function normalizarItem(v: unknown, cardapio: CardapioAlhoaria): ItemSacola | null {
  if (!obj(v) || !own(v, "id") || typeof v.id !== "string" || !v.id.trim() || v.id.length > 200 || !own(v, "quantidade") || !qtdValida(v.quantidade) || !own(v, "conteudo")) return null;
  const conteudo = normalizarConteudo(v.conteudo, cardapio);
  return conteudo ? { id: v.id, quantidade: v.quantidade, conteudo } : null;
}

export function lerSacola(raw: string | null, cardapio: CardapioAlhoaria): { itens: ItemSacola[]; aviso: string } {
  if (raw === null) return { itens: [], aviso: "" };
  try {
    const dados: unknown = JSON.parse(raw);
    if (!obj(dados) || !own(dados, "versao") || dados.versao !== VERSAO_SACOLA || !own(dados, "itens") || !Array.isArray(dados.itens) || dados.itens.length > 200) throw new Error();
    if (own(dados, "empresa") && dados.empresa !== cardapio.companyId) throw new Error();
    const ids = new Set<string>();
    const itens: ItemSacola[] = [];
    for (const entrada of dados.itens) {
      const item = normalizarItem(entrada, cardapio);
      if (item && !ids.has(item.id)) { itens.push(item); ids.add(item.id); }
    }
    const mudou = typeof dados.publicacao === "string" && dados.publicacao !== cardapio.publicationId;
    const aviso = itens.length !== dados.itens.length || (itens.length > 0 && mudou)
      ? "A sacola foi atualizada. Confira os itens e preços do cardápio atual." : "";
    return { itens, aviso };
  } catch { return { itens: [], aviso: "Não foi possível recuperar a sacola salva. Monte seu pedido novamente." }; }
}

export function nomeDoConteudo(c: ConteudoSacola, cardapio: CardapioAlhoaria) {
  switch (c.tipo) {
    case "lanche": return cardapio.LANCHES_PRECO[c.pedido.lanche]?.nome ?? "";
    case "bebida": return cardapio.nomeBebida(c.bebida, true);
    case "porcao": return cardapio.PORCOES[c.porcao]?.nome ?? "";
    case "produto": return cardapio.produtoPorId.get(c.id)?.name ?? "";
  }
}

export function linhasDoItem(item: ItemSacola, cardapio: CardapioAlhoaria): Linha[] {
  const c = item.conteudo;
  let linhas: Linha[];
  switch (c.tipo) {
    case "lanche":
      linhas = cardapio.linhasDoPedido(c.pedido);
      break;
    case "bebida":
      linhas = [{ texto: `1x ${cardapio.nomeBebida(c.bebida, true)}`, valor: cardapio.precoBebidaAvulsa(c.bebida), nivel: 0 }];
      break;
    case "porcao": {
      const porcao = cardapio.PORCOES[c.porcao];
      linhas = porcao ? [{ texto: `1x ${porcao.nome} (a partir de)`, detalhe: porcao.molho, valor: porcao.preco, nivel: 0 }] : [];
      break;
    }
    case "produto": {
      const produto = cardapio.produtoPorId.get(c.id);
      const preco = produto && cardapio.precoProduto(produto, c);
      if (!produto || preco === null || preco === undefined) return [];
      const variante = produto.variants.find(v => v.id === c.variante);
      const opcoes = produto.optionGroups.flatMap(g => g.options.filter(o => c.opcoes.includes(o.id)).map(o => o.name));
      linhas = [{ texto: `1x ${produto.name}`, valor: preco, obs: [variante?.label, ...opcoes].filter(Boolean).join(" · "), nivel: 0 }];
      break;
    }
  }
  return linhas.map(l => ({ ...l, texto: l.texto.startsWith("1x ") ? l.texto.replace(/^1x /, `${item.quantidade}x `) : item.quantidade > 1 ? `${l.texto} em cada unidade (valor total)` : l.texto, valor: l.valor * item.quantidade }));
}
export const totalDoItem = (item: ItemSacola, cardapio: CardapioAlhoaria) => linhasDoItem(item, cardapio).reduce((s, l) => s + l.valor, 0);
export function textoDaSacola(itens: readonly ItemSacola[], cardapio: CardapioAlhoaria) {
  const linhas = itens.flatMap(item => [`Composição (${item.quantidade} ${item.quantidade === 1 ? "unidade" : "unidades"}):`, ...linhasDoItem(item, cardapio).map(l => `  ${l.texto}: ${brl(l.valor)}${l.detalhe ? `\n    (${l.detalhe})` : ""}${l.obs ? `\n    ${l.obs}` : ""}`)]);
  return [`Olá! Quero fazer este pedido, montado no site de ${restaurante.nome}:`, ...linhas, `Total estimado: ${brl(itens.reduce((s, i) => s + totalDoItem(i, cardapio), 0))}`, "Valores de porções são a partir de. Confirme preços e entrega na loja."].join("\n");
}

export function atualizarItem(itens: readonly ItemSacola[], id: string, conteudo: unknown, quantidade: number | undefined, cardapio: CardapioAlhoaria): ItemSacola[] | null {
  const c = normalizarConteudo(conteudo, cardapio);
  const anterior = itens.find(i => i.id === id);
  if (!c || !anterior || (quantidade !== undefined && !qtdValida(quantidade))) return null;
  return itens.map(i => i.id === id ? { id, conteudo: c, quantidade: quantidade ?? i.quantidade } : i);
}
export const removerItem = (itens: readonly ItemSacola[], id: string): ItemSacola[] => itens.filter(i => i.id !== id);
