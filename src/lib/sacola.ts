import { ADICIONAIS, SEPARADOS, OPCOES, ORDEM_GRUPOS, SABORES_LATA, SABORES_SODA, PORCOES, LANCHES_PRECO, linhasDoPedido, nomeBebida, precoBebida, brl, type Bebida, type Pedido, type PorcaoId, type Linha } from "../components/bancada-proto/cardapio";
import { restaurante } from "../data/restaurante";

export type ConteudoSacola = { tipo: "lanche"; pedido: Pedido } | { tipo: "bebida"; bebida: Bebida } | { tipo: "porcao"; porcao: PorcaoId };
export type ItemSacola = { id: string; quantidade: number; conteudo: ConteudoSacola };
export const VERSAO_SACOLA = 1;
export const MAX_QUANTIDADE = 99;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (v: object, k: string) => Object.prototype.hasOwnProperty.call(v, k);
const validKey = (v: unknown, o: object): v is string => typeof v === "string" && own(o, v);
const qtdValida = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_QUANTIDADE;
function bebida(v: unknown): Bebida | null {
  if (!obj(v) || !own(v, "id")) return null;
  if (v.id === "chopp") return { id: "chopp" };
  if (v.id === "lata" && own(v, "sabor") && validKey(v.sabor, SABORES_LATA)) return { id: "lata", sabor: v.sabor as keyof typeof SABORES_LATA };
  if (v.id === "soda" && own(v, "sabor") && validKey(v.sabor, SABORES_SODA)) return { id: "soda", sabor: v.sabor as keyof typeof SABORES_SODA };
  return null;
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
export function normalizarConteudo(v: unknown): ConteudoSacola | null {
  if (!obj(v) || !own(v, "tipo")) return null;
  if (v.tipo === "bebida" && own(v, "bebida")) { const b = bebida(v.bebida); return b ? { tipo: "bebida", bebida: b } : null; }
  if (v.tipo === "porcao" && own(v, "porcao") && validKey(v.porcao, PORCOES)) return { tipo: "porcao", porcao: v.porcao as PorcaoId };
  if (v.tipo !== "lanche" || !own(v, "pedido") || !obj(v.pedido)) return null;
  const p = v.pedido;
  if (!own(p, "lanche") || !validKey(p.lanche, LANCHES_PRECO) || !own(p, "adicionais") || !own(p, "separados") || !own(p, "bebida") || !own(p, "porcao") || !own(p, "combo") || !own(p, "lataCombo") || !own(p, "opcoes")) return null;
  const adicionais = extras(p.adicionais, ADICIONAIS), separados = extras(p.separados, SEPARADOS);
  if (!adicionais || !separados || typeof p.combo !== "boolean") return null;
  const b = p.bebida === null ? null : bebida(p.bebida);
  if (p.bebida !== null && !b) return null;
  if (p.porcao !== null && !validKey(p.porcao, PORCOES)) return null;
  if (p.lataCombo !== null && !validKey(p.lataCombo, SABORES_LATA)) return null;
  if (p.combo && b?.id !== "lata" && p.lataCombo === null) return null;
  let opcoes: Pedido["opcoes"] = null;
  if (p.lanche !== "dogalho") {
    if (!obj(p.opcoes)) return null;
    opcoes = { pao: "", pasta: "", creme: "", queijo: "" };
    for (const grupo of ORDEM_GRUPOS) {
      const valor = own(p.opcoes, grupo) ? p.opcoes[grupo] : null;
      if (typeof valor !== "string" || !(valor === "sem" && grupo !== "pao") && !OPCOES[grupo].some((o) => o.id === valor)) return null;
      opcoes[grupo] = valor;
    }
  } else if (p.opcoes !== null) return null;
  return { tipo: "lanche", pedido: { lanche: p.lanche as Pedido["lanche"], opcoes, adicionais, separados, bebida: b, porcao: p.porcao as PorcaoId | null, combo: p.combo, lataCombo: p.lataCombo as Pedido["lataCombo"] } };
}
export function normalizarItem(v: unknown): ItemSacola | null {
  if (!obj(v) || !own(v, "id") || typeof v.id !== "string" || !v.id.trim() || v.id.length > 200 || !own(v, "quantidade") || !qtdValida(v.quantidade) || !own(v, "conteudo")) return null;
  const conteudo = normalizarConteudo(v.conteudo);
  return conteudo ? { id: v.id, quantidade: v.quantidade, conteudo } : null;
}
export function lerSacola(raw: string | null): { itens: ItemSacola[]; aviso: string } {
  if (raw === null) return { itens: [], aviso: "" };
  try {
    const dados: unknown = JSON.parse(raw);
    if (!obj(dados) || !own(dados, "versao") || dados.versao !== VERSAO_SACOLA || !own(dados, "versaoCatalogo") || dados.versaoCatalogo !== restaurante.versaoCatalogo || !own(dados, "itens") || !Array.isArray(dados.itens) || dados.itens.length > 200) throw new Error();
    const itens = dados.itens.map(normalizarItem);
    if (itens.some((i) => !i) || new Set(itens.map((i) => i?.id)).size !== itens.length) throw new Error();
    return { itens: itens as ItemSacola[], aviso: "" };
  } catch { return { itens: [], aviso: "Não foi possível recuperar a sacola salva. Monte seu pedido novamente." }; }
}
export function linhasDoItem(item: ItemSacola): Linha[] {
  const c = item.conteudo;
  const linhas: Linha[] = c.tipo === "lanche" ? linhasDoPedido(c.pedido) : c.tipo === "bebida" ? [{ texto: `1x ${nomeBebida(c.bebida)}`, valor: precoBebida(c.bebida), nivel: 0 }] : [{ texto: `1x ${PORCOES[c.porcao].nome} (a partir de)`, detalhe: PORCOES[c.porcao].molho, valor: PORCOES[c.porcao].preco, nivel: 0 }];
  return linhas.map((l) => ({ ...l, texto: l.texto.startsWith("1x ") ? l.texto.replace(/^1x /, `${item.quantidade}x `) : item.quantidade > 1 ? `${l.texto} em cada unidade (valor total)` : l.texto, valor: l.valor * item.quantidade }));
}
export const totalDoItem = (item: ItemSacola) => linhasDoItem(item).reduce((s, l) => s + l.valor, 0);
export function textoDaSacola(itens: readonly ItemSacola[]) {
  const linhas = itens.flatMap((item) => [`Composição (${item.quantidade} ${item.quantidade === 1 ? "unidade" : "unidades"}):`, ...linhasDoItem(item).map((l) => `  ${l.texto}: ${brl(l.valor)}${l.detalhe ? `\n    (${l.detalhe})` : ""}${l.obs ? `\n    ${l.obs}` : ""}`)]);
  return [`Olá! Quero fazer este pedido, montado no site de ${restaurante.nome}:`, ...linhas, `Total estimado: ${brl(itens.reduce((s, i) => s + totalDoItem(i), 0))}`, "Valores de porções são a partir de; confirme preços e entrega na loja."].join("\n");
}

/** Operações imutáveis preservam a identidade de cada linha, sem agrupar composições iguais. */
export function atualizarItem(itens: readonly ItemSacola[], id: string, conteudo: unknown, quantidade?: number): ItemSacola[] | null {
  const c = normalizarConteudo(conteudo), anterior = itens.find((i) => i.id === id);
  if (!c || !anterior || (quantidade !== undefined && !qtdValida(quantidade))) return null;
  return itens.map((i) => i.id === id ? { id, conteudo: c, quantidade: quantidade ?? i.quantidade } : i);
}
export const removerItem = (itens: readonly ItemSacola[], id: string): ItemSacola[] => itens.filter((i) => i.id !== id);
