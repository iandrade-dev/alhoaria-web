// Cardápio do pedido do protótipo (turbinar, bebida, acompanhamento e combo). Fonte: a loja da Alhoaria no Anota AI
// (PEDIDO_URL), lida em ATUALIZADO. Valores em centavos. O protótipo não monta o carrinho do Anota AI: o resumo é só
// para a pessoa repetir lá os mesmos itens.
import { PEDIDO_URL } from "@/lib/links";
import type { LancheId } from "./layout";

export const ATUALIZADO = "2026-11-06";
export const FONTE = PEDIDO_URL;
export const AVISO = "Preços do cardápio de 06/11/2026. O valor final é o do Anota AI.";

export const LANCHES_PRECO: Record<LancheId, { nome: string; preco: number }> = {
  costela: { nome: "A Costela!", preco: 4490 },
  pulled: { nome: "Pulled Pork!", preco: 3590 },
  brocolis: { nome: "Brócolis & Queijo!", preco: 3390 },
  dogalho: { nome: "Dogalho", preco: 2690 },
};

// ---------------------------------------------------------------- Turbine
export type AdicionalId = "bacon" | "tomate-seco" | "cebola-caramelizada" | "cebola-crispy" | "farofa" | "queijo-dobro";
export type SeparadoId = "pasta-tradicional" | "pasta-ervas" | "creme-4-queijos" | "creme-cheddar";
type Item = { nome: string; curto: string; preco: number; max: number };

/** Adicionais que vão no lanche (cada um tem um potinho em volta da tábua). */
export const ADICIONAIS: Record<AdicionalId, Item> = {
  bacon: { nome: "Bacon em cubos", curto: "Bacon", preco: 600, max: 12 },
  "tomate-seco": { nome: "Tomate seco", curto: "Tomate seco", preco: 600, max: 1 },
  "cebola-caramelizada": { nome: "Cebola caramelizada", curto: "Cebola caramelizada", preco: 600, max: 1 },
  "cebola-crispy": { nome: "Cebola crispy", curto: "Cebola crispy", preco: 600, max: 12 },
  farofa: { nome: "Farofa de alho", curto: "Farofa de alho", preco: 400, max: 12 },
  "queijo-dobro": { nome: "Queijo gratinado em dobro", curto: "Queijo em dobro", preco: 600, max: 12 },
};
export const ORDEM_ADICIONAIS = Object.keys(ADICIONAIS) as AdicionalId[];

/** Adicionais que vão separados (potinho com tampa ao lado do lanche). */
export const SEPARADOS: Record<SeparadoId, Item> = {
  "pasta-tradicional": { nome: "Pasta de alho tradicional", curto: "Pasta de alho", preco: 400, max: 12 },
  "pasta-ervas": { nome: "Pasta de alho com ervas", curto: "Pasta com ervas", preco: 400, max: 12 },
  "creme-4-queijos": { nome: "Creme 4 queijos", curto: "Creme 4 queijos", preco: 400, max: 12 },
  "creme-cheddar": { nome: "Creme cheddar defumado", curto: "Cheddar defumado", preco: 400, max: 12 },
};
export const ORDEM_SEPARADOS = Object.keys(SEPARADOS) as SeparadoId[];

// ---------------------------------------------------------------- Bebidas
export type SaborLata = "coca" | "coca-zero" | "pepsi-black" | "guarana" | "fanta" | "pureza";
export type SaborSoda = "maca-verde" | "frutas-vermelhas";
export type BebidaId = "lata" | "chopp" | "soda";
export type Bebida = { id: "lata"; sabor: SaborLata } | { id: "chopp" } | { id: "soda"; sabor: SaborSoda };

/** Sabores da lata: só o nome (a lata 3D fica só tingida, sem logo nem marca). */
export const SABORES_LATA: Record<SaborLata, { nome: string; preco: number; cor: string }> = {
  coca: { nome: "Coca-Cola", preco: 700, cor: "#b3121f" },
  "coca-zero": { nome: "Coca-Cola Zero", preco: 700, cor: "#1b1b1d" },
  "pepsi-black": { nome: "Pepsi Black", preco: 700, cor: "#141a33" },
  guarana: { nome: "Guaraná Antarctica", preco: 700, cor: "#1c6b34" },
  fanta: { nome: "Fanta Laranja", preco: 700, cor: "#e8730f" },
  pureza: { nome: "Pureza", preco: 600, cor: "#d2a52c" },
};
export const ORDEM_SABORES_LATA = Object.keys(SABORES_LATA) as SaborLata[];
export const SABORES_SODA: Record<SaborSoda, { nome: string; cor: string }> = {
  "maca-verde": { nome: "maçã verde", cor: "#8fcf3c" },
  "frutas-vermelhas": { nome: "frutas vermelhas", cor: "#b5193a" },
};
export const ORDEM_SABORES_SODA = Object.keys(SABORES_SODA) as SaborSoda[];

export const BEBIDAS: Record<BebidaId, { nome: string; curto: string; preco: number }> = {
  lata: { nome: "Refri lata", curto: "Refri lata", preco: 700 },
  chopp: { nome: "Caneca de chopp Pilsen Lohn 500 ml", curto: "Chopp 500 ml", preco: 990 },
  soda: { nome: "Soda italiana", curto: "Soda italiana", preco: 1490 },
};
export const ORDEM_BEBIDAS: BebidaId[] = ["lata", "chopp", "soda"];

export function precoBebida(b: Bebida) {
  return b.id === "lata" ? SABORES_LATA[b.sabor].preco : BEBIDAS[b.id].preco;
}
export function nomeBebida(b: Bebida) {
  if (b.id === "lata") return b.sabor === "pureza" ? "Pureza lata" : `Refri lata ${SABORES_LATA[b.sabor].nome}`;
  if (b.id === "soda") return `Soda italiana ${SABORES_SODA[b.sabor].nome}`;
  return BEBIDAS.chopp.nome;
}

// ---------------------------------------------------------------- Porções
export type PorcaoId = "batata" | "dadinho";
export const PORCOES: Record<PorcaoId, { nome: string; curto: string; preco: number; aPartir: true; molho: string }> = {
  batata: { nome: "Batata rústica", curto: "Batata rústica", preco: 2490, aPartir: true, molho: "com creme de cheddar defumado" },
  dadinho: { nome: "Dadinho de tapioca", curto: "Dadinho de tapioca", preco: 2990, aPartir: true, molho: "com creme de cheddar defumado" },
};
export const ORDEM_PORCOES: PorcaoId[] = ["batata", "dadinho"];

// ---------------------------------------------------------------- Combos
export type Trio = { id: "alhoaria" | "dogalho"; nome: string; preco: number; de: number; batata: string; lanches: LancheId[] };
export const TRIOS: Trio[] = [
  { id: "alhoaria", nome: "Trio Alhoaria Delícia Completa", preco: 5590, de: 6090, batata: "batata ondulada", lanches: ["costela", "pulled", "brocolis"] },
  { id: "dogalho", nome: "Trio Dogalho!", preco: 3690, de: 5680, batata: "batata frita", lanches: ["dogalho"] },
];
export const trioDe = (l: LancheId) => TRIOS.find((t) => t.lanches.includes(l)) ?? null;
/** Quanto o trio economiza em relação aos itens soltos (lanche + batata rústica + lata). */
export function economiaDoTrio(l: LancheId, sabor: SaborLata | null) {
  const t = trioDe(l);
  if (!t) return 0;
  const lata = sabor ? SABORES_LATA[sabor].preco : BEBIDAS.lata.preco;
  return LANCHES_PRECO[l].preco + PORCOES.batata.preco + lata - t.preco;
}

// ---------------------------------------------------------------- Pedido
export type Pedido = {
  lanche: LancheId;
  adicionais: Partial<Record<AdicionalId, number>>;
  separados: Partial<Record<SeparadoId, number>>;
  bebida: Bebida | null;
  /** Porção escolhida (com combo, é uma porção a mais, além da batata do trio). */
  porcao: PorcaoId | null;
  combo: boolean;
  /** Sabor da lata do trio quando a bebida escolhida não é lata (chopp, soda ou nenhuma). */
  lataCombo: SaborLata | null;
};
export const novoPedido = (lanche: LancheId): Pedido => ({ lanche, adicionais: {}, separados: {}, bebida: null, porcao: null, combo: false, lataCombo: null });

/** Sabor da lata que entra no trio (null = ainda falta escolher). */
export const saborDaLataDoCombo = (p: Pedido): SaborLata | null => (p.bebida?.id === "lata" ? p.bebida.sabor : p.lataCombo);

export type Linha = { texto: string; valor: number; detalhe?: string; nivel: 0 | 1 };

const qtd = (n: number | undefined, max: number) => Math.max(0, Math.min(max, n ?? 0));

/** Linhas do resumo (a mesma fonte para a tela, o total e o texto copiado). */
export function linhasDoPedido(p: Pedido): Linha[] {
  const out: Linha[] = [];
  const lanche = LANCHES_PRECO[p.lanche];
  const trio = p.combo ? trioDe(p.lanche) : null;
  if (trio) {
    const sabor = saborDaLataDoCombo(p);
    const lata = sabor ? (sabor === "pureza" ? "Pureza lata" : `${SABORES_LATA[sabor].nome} lata`) : "refri lata (falta o sabor)";
    out.push({ texto: `1x ${trio.nome}`, valor: trio.preco, detalhe: `${lanche.nome} + ${trio.batata} + ${lata}`, nivel: 0 });
  } else {
    out.push({ texto: `1x ${lanche.nome}`, valor: lanche.preco, nivel: 0 });
  }
  for (const id of ORDEM_ADICIONAIS) {
    const a = ADICIONAIS[id]; const n = qtd(p.adicionais[id], a.max);
    if (n) out.push({ texto: `+ ${a.nome}${n > 1 ? ` x${n}` : ""}`, valor: n * a.preco, nivel: 1 });
  }
  for (const id of ORDEM_SEPARADOS) {
    const s = SEPARADOS[id]; const n = qtd(p.separados[id], s.max);
    if (n) out.push({ texto: `+ ${s.nome} (separado)${n > 1 ? ` x${n}` : ""}`, valor: n * s.preco, nivel: 1 });
  }
  if (p.bebida && !(trio && p.bebida.id === "lata")) out.push({ texto: `1x ${nomeBebida(p.bebida)}`, valor: precoBebida(p.bebida), nivel: 0 });
  if (p.porcao) {
    const po = PORCOES[p.porcao];
    out.push({ texto: `1x ${po.nome} (a partir de)`, valor: po.preco, detalhe: po.molho, nivel: 0 });
  }
  return out;
}

/** Total do pedido, em centavos. */
export function totalDoPedido(p: Pedido) {
  return linhasDoPedido(p).reduce((s, l) => s + l.valor, 0);
}

/** "R$ 54,90" (espaço comum, sem milhar: os pedidos do protótipo não passam de R$ 999). */
export function brl(c: number) {
  const r = Math.round(c);
  return `R$ ${Math.floor(r / 100)},${String(r % 100).padStart(2, "0")}`;
}

/** Texto para colar no pedido (Copiar pedido). */
export function textoDoPedido(p: Pedido) {
  const linhas = linhasDoPedido(p).map((l) => {
    const base = `${l.nivel ? "   " : ""}${l.texto}: ${brl(l.valor)}`;
    return l.detalhe ? `${base}\n${l.nivel ? "      " : "   "}(${l.detalhe})` : base;
  });
  return ["Meu pedido na Alhoaria:", ...linhas, `Total: ${brl(totalDoPedido(p))}`, AVISO].join("\n");
}
