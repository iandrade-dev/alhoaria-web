import type { LancheId } from "./layout";
import type { ProdutoPublicado, PublicacaoAlhoaria } from "../../lib/publicacao-alhoaria";

export type GrupoOpcao = "pao" | "pasta" | "creme" | "queijo";
export type Opcao = { id: string; nome: string; sub: string; texto: string; preco: number };
export type Opcoes = Record<GrupoOpcao, string | null>;
export type AdicionalId = "bacon" | "tomate-seco" | "cebola-caramelizada" | "cebola-crispy" | "farofa" | "queijo-dobro";
export type SeparadoId = "pasta-tradicional" | "pasta-ervas" | "creme-4-queijos" | "creme-cheddar";
export type SaborLata = "coca" | "coca-zero" | "pepsi-black" | "guarana" | "fanta" | "pureza";
export type SaborSoda = "maca-verde" | "frutas-vermelhas";
export type BebidaId = "lata" | "chopp" | "soda";
export type Bebida = { id: "lata"; sabor: SaborLata } | { id: "chopp" } | { id: "soda"; sabor: SaborSoda };
export type PorcaoId = "batata" | "dadinho";
export type Trio = { id: "alhoaria" | "dogalho"; nome: string; preco: number; de: number; batata: string; lanches: LancheId[]; acrescimo: Partial<Record<LancheId, number>>; latas: SaborLata[] };
export type Linha = { texto: string; valor: number; detalhe?: string; obs?: string; nivel: 0 | 1 };
export type Pedido = {
  lanche: LancheId;
  opcoes: Opcoes | null;
  adicionais: Partial<Record<AdicionalId, number>>;
  separados: Partial<Record<SeparadoId, number>>;
  bebida: Bebida | null;
  porcao: PorcaoId | null;
  combo: boolean;
  lataCombo: SaborLata | null;
};
export type CompraProduto = { tipo: "produto"; id: string; variante: string | null; opcoes: string[] };

export const ORDEM_GRUPOS: GrupoOpcao[] = ["pao", "pasta", "creme", "queijo"];
const SEM_OPCAO = {
  pasta: { nome: "Sem pasta", texto: "sem pasta de alho" },
  creme: { nome: "Sem creme", texto: "sem creme de queijo" },
  queijo: { nome: "Sem queijo", texto: "sem queijo gratinado" },
};
export const opcoesVazias = (): Opcoes => ({ pao: null, pasta: null, creme: null, queijo: null });
export const novoPedido = (lanche: LancheId): Pedido => ({
  lanche, opcoes: lanche === "dogalho" ? null : opcoesVazias(), adicionais: {}, separados: {}, bebida: null, porcao: null, combo: false, lataCombo: null,
});

// Referências das peças que já têm animação e limites físicos na bancada.
export const OPCOES_VISUAIS: Record<GrupoOpcao, readonly string[]> = {
  pao: ["parmesao", "roseta"],
  pasta: ["ervas", "tradicional"],
  creme: ["cheddar", "4-queijos"],
  queijo: ["mucarela", "colonial"],
};
const PREFIXOS_OPCAO: Record<GrupoOpcao, string> = { pao: "Pão ", pasta: "Pasta de alho ", creme: "Creme ", queijo: "" };
const LIMITES_ADICIONAIS: Record<AdicionalId, number> = { bacon: 12, "tomate-seco": 1, "cebola-caramelizada": 1, "cebola-crispy": 12, farofa: 12, "queijo-dobro": 12 };
const LIMITES_SEPARADOS: Record<SeparadoId, number> = { "pasta-tradicional": 12, "pasta-ervas": 12, "creme-4-queijos": 12, "creme-cheddar": 12 };
const CORES_LATAS: Record<SaborLata, string> = {
  coca: "#b3121f", "coca-zero": "#1b1b1d", "pepsi-black": "#141a33", guarana: "#1c6b34", fanta: "#e8730f", pureza: "#d2a52c",
};
const PORCOES_3D: readonly PorcaoId[] = ["batata", "dadinho"];
const LANCHES_3D: readonly LancheId[] = ["pulled", "brocolis", "dogalho", "costela"];
const TRIOS_3D = ["alhoaria", "dogalho"] as const;
const REFERENCIAS_DE_MONTAGEM = new Set([
  ...LANCHES_3D, ...PORCOES_3D, ...TRIOS_3D.map(id => "trio-" + id), "bebida-lata", "bebida-lata-avulsa", "personalizacao",
]);

function contem<T extends string>(lista: readonly T[], valor: unknown): valor is T {
  return typeof valor === "string" && (lista as readonly string[]).includes(valor);
}
function tabela<T extends string, V>(pares: readonly (readonly [T, V])[]) {
  return Object.fromEntries(pares) as Record<T, V>;
}

export function brl(centavos: number) {
  const valor = Math.round(centavos);
  return `R$ ${Math.floor(valor / 100)},${String(valor % 100).padStart(2, "0")}`;
}

export function precoProduto(produto: ProdutoPublicado, compra: CompraProduto) {
  if (compra.id !== produto.id || !produto.available || new Set(compra.opcoes).size !== compra.opcoes.length) return null;
  const variantes = produto.variants.filter(v => v.available);
  const variante = variantes.find(v => v.id === compra.variante);
  if (produto.variants.length ? !variante : compra.variante !== null) return null;
  let preco = variante?.priceCents ?? produto.priceCents;
  let escolhas = 0;
  for (const grupo of produto.optionGroups) {
    const opcoes = grupo.options.filter(o => o.available && compra.opcoes.includes(o.id));
    if (opcoes.length < grupo.min || opcoes.length > grupo.max) return null;
    preco += opcoes.reduce((total, o) => total + o.priceCents, 0);
    escolhas += opcoes.length;
  }
  return escolhas === compra.opcoes.length ? preco : null;
}

export function produtoPadrao(produto: ProdutoPublicado): CompraProduto {
  return {
    tipo: "produto", id: produto.id,
    variante: produto.variants.find(v => v.available)?.id ?? null,
    opcoes: produto.optionGroups.flatMap(g => g.options.filter(o => o.available).slice(0, g.min).map(o => o.id)),
  };
}

function escolher(produto: ProdutoPublicado | undefined, referencia: string) {
  return produto?.optionGroups.find(grupo => grupo.reference === referencia)?.options.filter(opcao => opcao.available) ?? [];
}

export function criarCardapio(publicacao: PublicacaoAlhoaria) {
  const produtosAtivos = publicacao.products.filter(produto => produto.available).sort((a, b) => a.sortOrder - b.sortOrder);
  const porReferencia = new Map(produtosAtivos.map(produto => [produto.reference, produto]));
  const personalizacao = porReferencia.get("personalizacao");
  const OPCOES = tabela(ORDEM_GRUPOS.map(grupo => [grupo, escolher(personalizacao, grupo).flatMap(opcao => {
    if (!opcao.reference) return [];
    const texto = PREFIXOS_OPCAO[grupo] + (grupo === "queijo" ? opcao.name : opcao.name.toLocaleLowerCase("pt-BR"));
    return [{ id: opcao.reference, nome: opcao.name, sub: "", texto, preco: opcao.priceCents }];
  })] as const));
  const OPCOES_PADRAO = tabela(ORDEM_GRUPOS.map(g => [g, OPCOES[g][0]?.id ?? (g === "pao" ? null : "sem")] as const));
  const temIngredientes3D = ORDEM_GRUPOS.every(grupo =>
    OPCOES[grupo].length > 0 && OPCOES[grupo].every(opcao => OPCOES_VISUAIS[grupo].includes(opcao.id)),
  );
  const lanches = produtosAtivos.flatMap(p => {
    if (!contem(LANCHES_3D, p.reference)) return [];
    return [{ id: p.reference, nome: p.name, descricao: p.description, foto: p.photos[0]?.url ?? "",
      preco: p.priceCents, experiencia3D: p.reference === "dogalho" || temIngredientes3D }];
  });
  const LANCHES_PRECO = tabela(lanches.map(lanche => [lanche.id, lanche] as const));
  const produtos = produtosAtivos.filter(p => !p.reference || !REFERENCIAS_DE_MONTAGEM.has(p.reference));
  const produtoPorId = new Map(produtos.map(p => [p.id, p]));

  function itensExtras<T extends string>(grupo: string, limites: Record<T, number>) {
    return tabela(escolher(personalizacao, grupo).flatMap(o => {
      if (!o.reference || !Object.hasOwn(limites, o.reference)) return [];
      const id = o.reference as T;
      return [[id, { nome: o.name, curto: o.name, preco: o.priceCents, max: limites[id] }] as const];
    }));
  }
  const adicionais = itensExtras("adicionais", LIMITES_ADICIONAIS);
  const SEPARADOS = itensExtras("separados", LIMITES_SEPARADOS);
  const ORDEM_ADICIONAIS = Object.keys(adicionais) as AdicionalId[];
  const ORDEM_SEPARADOS = Object.keys(SEPARADOS) as SeparadoId[];
  const ADICIONAIS = { ...adicionais, "queijo-dobro": adicionais["queijo-dobro"] ?? { nome: "Queijo em dobro", curto: "Queijo em dobro", preco: 0, max: 0 } };
  const POTINHOS = ORDEM_ADICIONAIS.filter(id => id !== "queijo-dobro");
  const lata = porReferencia.get("bebida-lata");
  const avulsa = porReferencia.get("bebida-lata-avulsa");
  const sabores = Object.keys(CORES_LATAS) as SaborLata[];
  const SABORES_LATA = tabela((lata?.variants ?? []).flatMap(v => {
    if (!v.available || !contem(sabores, v.reference)) return [];
    return [[v.reference, { nome: v.label, preco: v.priceCents, cor: CORES_LATAS[v.reference] }] as const];
  }));
  const avulsas = tabela(escolher(avulsa, "sabores").flatMap(o => {
    if (!avulsa || !contem(sabores, o.reference)) return [];
    return [[o.reference, { nome: o.name, preco: avulsa.priceCents + o.priceCents }] as const];
  }));
  const ORDEM_SABORES_LATA = Object.keys(SABORES_LATA) as SaborLata[];
  const SABORES_LATA_AVULSA = Object.keys(avulsas) as SaborLata[];
  const bebidas = SABORES_LATA_AVULSA.map(sabor => ({ id: "lata", sabor }) as const);
  const bebidasJunto = ORDEM_SABORES_LATA.map(sabor => ({ id: "lata", sabor }) as const);
  const ORDEM_BEBIDAS: BebidaId[] = ORDEM_SABORES_LATA.length ? ["lata"] : [];
  const BEBIDAS = {
    lata: { nome: lata?.name ?? "", curto: "Refri lata", preco: lata?.priceCents ?? 0 },
    chopp: { nome: "", curto: "", preco: 0 },
    soda: { nome: "", curto: "", preco: 0 },
  };
  const SABORES_SODA = { "maca-verde": { nome: "", cor: "#8fcf3c" }, "frutas-vermelhas": { nome: "", cor: "#b5193a" } };
  const ORDEM_SABORES_SODA: SaborSoda[] = [];
  const PORCOES = tabela(produtosAtivos.flatMap(p => contem(PORCOES_3D, p.reference)
    ? [[p.reference, { nome: p.name, curto: p.name, preco: p.priceCents, molho: p.description }] as const] : []));
  const ORDEM_PORCOES = Object.keys(PORCOES) as PorcaoId[];
  const precoLatasTrio = new Map<Trio["id"], Partial<Record<SaborLata, number>>>();
  const TRIOS: Trio[] = TRIOS_3D.flatMap(id => {
    const produto = porReferencia.get("trio-" + id);
    if (!produto) return [];
    const lanches = escolher(produto, "lanches").flatMap(o =>
      contem(LANCHES_3D, o.reference) && LANCHES_PRECO[o.reference] ? [o.reference] : [],
    );
    const latas = escolher(produto, "latas").flatMap(o => contem(sabores, o.reference) ? [o.reference] : []);
    if (!lanches.length || !latas.length) return [];
    for (const opcao of escolher(produto, "latas")) {
      if (contem(latas, opcao.reference) && !SABORES_LATA[opcao.reference]) {
        SABORES_LATA[opcao.reference] = { nome: opcao.name, preco: 0, cor: CORES_LATAS[opcao.reference] };
      }
    }
    const acrescimo = tabela(escolher(produto, "lanches").flatMap(o => contem(lanches, o.reference) ? [[o.reference, o.priceCents] as const] : []));
    precoLatasTrio.set(id, tabela(escolher(produto, "latas").flatMap(o => contem(latas, o.reference) ? [[o.reference, o.priceCents] as const] : [])));
    return [{ id, nome: produto.name, preco: produto.priceCents,
      de: produto.variants.find(v => v.reference === "preco-anterior")?.priceCents ?? produto.priceCents,
      batata: produto.description, lanches, acrescimo, latas }];
  });
  const trioDe = (id: LancheId) => TRIOS.find(trio => trio.lanches.includes(id)) ?? null;
  const precoDoTrio = (trio: Trio, id: LancheId) => trio.preco + (trio.acrescimo[id] ?? 0);
  const opcaoDe = (grupo: GrupoOpcao, id: string | null) => OPCOES[grupo].find(o => o.id === id) ?? null;
  const precoBebida = (b: Bebida) => b.id === "lata" ? SABORES_LATA[b.sabor]?.preco ?? 0 : 0;
  const precoBebidaAvulsa = (b: Bebida) => b.id === "lata" ? avulsas[b.sabor]?.preco ?? 0 : 0;
  function nomeBebida(b: Bebida, solta = false) {
    if (b.id !== "lata") return "";
    const nome = solta ? avulsas[b.sabor]?.nome : SABORES_LATA[b.sabor]?.nome ?? avulsas[b.sabor]?.nome;
    return b.sabor === "pureza" ? `${nome ?? "Pureza"} lata` : `Refri lata ${nome ?? b.sabor}`;
  }
  function lataContaNoTrio(pedido: Pedido) {
    const trio = pedido.combo ? trioDe(pedido.lanche) : null;
    return !!trio && pedido.bebida?.id === "lata" && trio.latas.includes(pedido.bebida.sabor);
  }
  function saborDaLataDoCombo(pedido: Pedido) {
    if (pedido.bebida?.id === "lata" && lataContaNoTrio(pedido)) return pedido.bebida.sabor;
    const trio = trioDe(pedido.lanche);
    return pedido.lataCombo && trio?.latas.includes(pedido.lataCombo) ? pedido.lataCombo : null;
  }
  function economiaDoTrio(id: LancheId, sabor: SaborLata | null) {
    const trio = trioDe(id);
    const lanche = LANCHES_PRECO[id];
    if (!trio || !lanche) return 0;
    const precoLata = (sabor ? SABORES_LATA[sabor]?.preco : undefined) ?? BEBIDAS.lata.preco;
    return lanche.preco + (PORCOES.batata?.preco ?? 0) + precoLata - precoDoTrio(trio, id);
  }
  function textoDasOpcoes(opcoes: Opcoes) {
    return ORDEM_GRUPOS.flatMap(grupo => {
      if (opcoes[grupo] === "sem" && grupo !== "pao") return [SEM_OPCAO[grupo].texto];
      const opcao = opcaoDe(grupo, opcoes[grupo]);
      return opcao ? [opcao.texto] : [];
    }).join(" · ");
  }
  function pedidoPadrao(id: LancheId): Pedido {
    return { ...novoPedido(id), opcoes: id === "dogalho" ? null : { ...OPCOES_PADRAO } };
  }
  function pedidoDaURL(q: URLSearchParams, id: LancheId) {
    const pedido = novoPedido(id);
    if (pedido.opcoes) for (const grupo of ORDEM_GRUPOS) {
      const valor = q.get(grupo);
      if (opcaoDe(grupo, valor) || (grupo !== "pao" && valor === "sem")) pedido.opcoes[grupo] = valor;
    }
    const sabor = q.get("sabor");
    if (q.get("bebida") === "lata" && contem(ORDEM_SABORES_LATA, sabor)) pedido.bebida = { id: "lata", sabor };
    const porcao = q.get("porcao");
    if (contem(ORDEM_PORCOES, porcao)) pedido.porcao = porcao;
    for (const id of ORDEM_ADICIONAIS) {
      const n = Number(q.get(`adicional.${id}`));
      if (Number.isInteger(n) && n > 0 && n <= ADICIONAIS[id].max) pedido.adicionais[id] = n;
    }
    for (const id of ORDEM_SEPARADOS) {
      const n = Number(q.get(`separado.${id}`));
      if (Number.isInteger(n) && n > 0 && n <= SEPARADOS[id].max) pedido.separados[id] = n;
    }
    const trio = trioDe(id);
    const lataCombo = q.get("lataCombo");
    pedido.combo = !!trio && q.get("combo") === "1";
    if (trio && contem(trio.latas, lataCombo)) pedido.lataCombo = lataCombo;
    return pedido;
  }
  function linhasDoPedido(pedido: Pedido): Linha[] {
    const lanche = LANCHES_PRECO[pedido.lanche];
    if (!lanche) return [];
    const trio = pedido.combo ? trioDe(pedido.lanche) : null;
    const obs = pedido.opcoes ? textoDasOpcoes(pedido.opcoes) || undefined : undefined;
    const linhas: Linha[] = [];
    if (trio) {
      const sabor = saborDaLataDoCombo(pedido);
      const lata = sabor ? nomeBebida({ id: "lata", sabor }) : "refri lata (falta o sabor)";
      const acrescimo = sabor ? precoLatasTrio.get(trio.id)?.[sabor] ?? 0 : 0;
      linhas.push({ texto: `1x ${trio.nome}`, valor: precoDoTrio(trio, pedido.lanche) + acrescimo, detalhe: `${lanche.nome} + ${trio.batata} + ${lata}`, obs, nivel: 0 });
    } else linhas.push({ texto: `1x ${lanche.nome}`, valor: lanche.preco, obs, nivel: 0 });
    if (pedido.opcoes) for (const grupo of ORDEM_GRUPOS) {
      const opcao = opcaoDe(grupo, pedido.opcoes[grupo]);
      if (opcao?.preco) linhas.push({ texto: `+ ${opcao.nome}`, valor: opcao.preco, nivel: 1 });
    }
    for (const id of ORDEM_ADICIONAIS) {
      const item = ADICIONAIS[id];
      const n = Math.min(item.max, pedido.adicionais[id] ?? 0);
      if (n > 0) linhas.push({ texto: `+ ${item.nome}${n > 1 ? ` x${n}` : ""}`, valor: n * item.preco, nivel: 1 });
    }
    for (const id of ORDEM_SEPARADOS) {
      const item = SEPARADOS[id];
      const n = Math.min(item.max, pedido.separados[id] ?? 0);
      if (n > 0) linhas.push({ texto: `+ ${item.nome} (separado)${n > 1 ? ` x${n}` : ""}`, valor: n * item.preco, nivel: 1 });
    }
    if (pedido.bebida?.id === "lata" && SABORES_LATA[pedido.bebida.sabor] && !lataContaNoTrio(pedido)) {
      linhas.push({ texto: `1x ${nomeBebida(pedido.bebida)}`, valor: precoBebida(pedido.bebida), nivel: 0 });
    }
    const porcao = pedido.porcao && PORCOES[pedido.porcao];
    if (porcao) linhas.push({ texto: `1x ${porcao.nome} (a partir de)`, valor: porcao.preco, detalhe: porcao.molho, nivel: 0 });
    return linhas;
  }
  const totalDoPedido = (p: Pedido) => linhasDoPedido(p).reduce((s, l) => s + l.valor, 0);
  function textoDoPedido(p: Pedido) {
    const linhas = linhasDoPedido(p).flatMap(l => [
      `${l.nivel ? "   " : ""}${l.texto}: ${brl(l.valor)}`,
      ...(l.detalhe ? [`   (${l.detalhe})`] : []),
      ...(l.obs ? [`   ${l.obs}`] : []),
    ]);
    return [`Olá! Quero fazer este pedido, montado no site de ${publicacao.company.brandName}:`, ...linhas, `Total: ${brl(totalDoPedido(p))}`].join("\n");
  }
  return {
    companyId: publicacao.company.id, publicationId: publicacao.publicationId, publishedAt: publicacao.publishedAt,
    lanches, produtos, produtoPorId, bebidas, bebidasJunto, brl, pedidoPadrao, pedidoDaURL, produtoPadrao, precoProduto,
    AVISO: "Preços do cardápio publicado. Valor final e entrega são confirmados pela loja.",
    ADICIONAIS, BEBIDAS, LANCHES_PRECO, OPCOES, OPCOES_PADRAO, ORDEM_ADICIONAIS, ORDEM_BEBIDAS,
    ORDEM_GRUPOS, ORDEM_PORCOES, ORDEM_SABORES_LATA, ORDEM_SABORES_SODA, ORDEM_SEPARADOS, PORCOES, POTINHOS, SABORES_LATA,
    SABORES_SODA, SABORES_LATA_AVULSA, SEM_OPCAO, SEPARADOS, economiaDoTrio, lataContaNoTrio, linhasDoPedido, novoPedido,
    opcaoDe, precoBebida, precoBebidaAvulsa, nomeBebida, precoDoTrio, saborDaLataDoCombo, textoDasOpcoes, textoDoPedido,
    totalDoPedido, trioDe,
  };
}

export type CardapioAlhoaria = ReturnType<typeof criarCardapio>;
