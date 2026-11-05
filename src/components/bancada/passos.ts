// Dados das receitas e reducer puro da bancada. Nada aqui toca em DOM ou three.js.
// O id de cada etapa é o nome do ícone WebP (public/assets/bancada/icones/<id>.webp) e do GLB da camada,
// exceto "macarico", cujo modelo é macarico-mao.glb (mais o gratinado.glb, que aparece com a varredura).

export type LancheId = "pulled" | "brocolis" | "dogalho" | "costela";
export type BebidaId = "lata" | "chopp" | "soda";
export type PorcaoId = "dadinho" | "batata";
export type Tela = "escolha" | "montar" | "bebida" | "porcao" | "final";

export type Etapa = {
  id: string;
  nome: string;
  pede: string;
  dica: string;
  opcao: { nome: string; sub: string };
  opcional?: true;
};

export type Receita = {
  id: LancheId;
  nome: string;
  assinatura?: string;
  desc: string;
  tags: readonly string[];
  foto: string;
  lista: "No pão" | "Na cestinha";
  tampa: { modelo: string; no: string; fechaApos?: string };
  etapas: readonly Etapa[];
};

const paoDeAlho = (recheio: Etapa, pao: Etapa["opcao"], pasta: { dica: string; sub: string }, queijo: string): readonly Etapa[] => [
  { id: "pao", nome: "Pão", pede: "Escolha o pão", dica: "Toque ou arraste até a tábua.", opcao: pao },
  { id: "pasta", nome: "Pasta de alho", pede: "Espalhe a pasta de alho", dica: pasta.dica, opcao: { nome: "Pasta de alho", sub: pasta.sub } },
  recheio,
  { id: "creme", nome: "Creme de queijo", pede: "Entra o creme de queijo", dica: "Creme artesanal.", opcao: { nome: "Creme de queijo", sub: "artesanal" } },
  { id: "mussarela", nome: "Mussarela", pede: "Muito queijo por cima", dica: queijo, opcao: { nome: "Mussarela", sub: "muito queijo" } },
  { id: "macarico", nome: "Maçarico", pede: "Dê o toque do maçarico", dica: "Gratina e dá as manchas douradas.", opcao: { nome: "Maçarico", sub: "gratinar por cima" } },
];
const PAO_ESPECIAL = { nome: "Pão de alho especial", sub: "aberto ao meio" };
const PASTA_EXCLUSIVA = { dica: "A pasta exclusiva da casa.", sub: "receita exclusiva" };
const tampaPao = { modelo: "pao", no: "pao_tampa" } as const;

export const RECEITAS: Record<LancheId, Receita> = {
  pulled: {
    id: "pulled", nome: "Pulled Pork!", desc: "Pernil desfiado, assado por 4 horas em fogo baixo, no pão de alho.",
    tags: ["6 etapas"], foto: "/assets/bancada/lanche-pulled.webp", lista: "No pão", tampa: tampaPao,
    etapas: paoDeAlho({ id: "pulled-pernil", nome: "Pernil", pede: "Agora o pernil desfiado", dica: "Assado por 4 horas.", opcao: { nome: "Pernil desfiado", sub: "macio e suculento" } },
      PAO_ESPECIAL, PASTA_EXCLUSIVA, "Mussarela para gratinar."),
  },
  brocolis: {
    id: "brocolis", nome: "Brócolis & Queijo!", desc: "Pão de alho recheado com brócolis fresquinho e muito queijo gratinado.",
    tags: ["6 etapas", "Vegetariano"], foto: "/assets/bancada/lanche-brocolis.webp", lista: "No pão", tampa: tampaPao,
    etapas: paoDeAlho({ id: "brocolis-floretes", nome: "Brócolis", pede: "Distribua os brócolis", dica: "Fresquinhos.", opcao: { nome: "Brócolis", sub: "floretes frescos" } },
      PAO_ESPECIAL, PASTA_EXCLUSIVA, "Mussarela para gratinar."),
  },
  dogalho: {
    id: "dogalho", nome: "Dogalho", assinatura: "O Dog da Alhoaria",
    desc: "Brioche com pasta de alho, duas salsichas, fundue de 4 queijos e batata palha.",
    tags: ["7 etapas", "Brioche"], foto: "/assets/bancada/lanche-dogalho.webp", lista: "Na cestinha",
    tampa: { modelo: "dog-brioche", no: "dog_brioche_tampa", fechaApos: "dog-molhos" },
    etapas: [
      { id: "dog-brioche", nome: "Pão brioche", pede: "Escolha o pão", dica: "Brioche macio, na cestinha.", opcao: { nome: "Pão brioche", sub: "macio, aberto" } },
      { id: "dog-pasta", nome: "Pasta de alho", pede: "Espalhe a pasta de alho", dica: "A clássica da casa.", opcao: { nome: "Pasta de alho", sub: "artesanal" } },
      { id: "dog-salsichas", nome: "Salsichas", pede: "Coloque as salsichas", dica: "Duas salsichas especiais.", opcao: { nome: "Duas salsichas", sub: "especiais" } },
      { id: "dog-molhos", nome: "Molhos", pede: "Ketchup e mostarda", dica: "Toque ou arraste.", opcional: true, opcao: { nome: "Ketchup e mostarda", sub: "em zigue-zague" } },
      { id: "dog-fondue", nome: "Fundue", pede: "Cubra com o fundue", dica: "Fundue cremoso de 4 queijos.", opcao: { nome: "Fundue de 4 queijos", sub: "cremoso" } },
      { id: "dog-mussarela", nome: "Mussarela", pede: "Mussarela derretida", dica: "Por cima do fundue.", opcao: { nome: "Mussarela", sub: "derretida" } },
      { id: "dog-palha", nome: "Batata palha", pede: "Fecha com batata palha", dica: "A camada crocante.", opcional: true, opcao: { nome: "Batata palha", sub: "bem crocante" } },
    ],
  },
  costela: {
    id: "costela", nome: "A Costela!", desc: "A especial: costela assada 6 horas e desfiada, no pão de alho.",
    tags: ["6 etapas", "A da casa"], foto: "/assets/bancada/lanche-costela.webp", lista: "No pão", tampa: tampaPao,
    etapas: paoDeAlho({ id: "costela", nome: "Costela", pede: "Agora a costela desfiada", dica: "Seis horas de fogo.", opcao: { nome: "Costela desfiada", sub: "6 horas de fogo" } },
      { nome: "Pão de alho da casa", sub: "tostado na chapa" }, { dica: "A pasta da casa.", sub: "receita da casa" }, "Mussarela de verdade."),
  },
};
export const ORDEM_LANCHES: readonly LancheId[] = ["pulled", "brocolis", "dogalho", "costela"];

type Item<T extends string> = { id: T; nome: string; curto: string; sub: string; icone: string };
export const BEBIDAS: readonly Item<BebidaId>[] = [
  { id: "lata", nome: "Refrigerante lata", curto: "Refri lata", sub: "350 ml", icone: "beb-lata" },
  { id: "chopp", nome: "Chopp Pilsen Lohn", curto: "Chopp", sub: "caneca 500 ml", icone: "beb-chopp" },
  { id: "soda", nome: "Soda italiana", curto: "Soda", sub: "maçã verde ou frutas vermelhas", icone: "beb-soda" },
];
export const PORCOES: readonly Item<PorcaoId>[] = [
  { id: "dadinho", nome: "Dadinho de tapioca", curto: "Dadinho", sub: "com creme de cheddar defumado", icone: "porcao-dadinho" },
  { id: "batata", nome: "Batata rústica", curto: "Batata", sub: "com creme de cheddar defumado", icone: "porcao-batata" },
];

export type Estado = {
  tela: Tela;
  lanche: LancheId | null;
  passo: number;
  colocados: readonly string[];
  pulados: readonly string[];
  bebida: BebidaId | null;
  porcao: PorcaoId | null;
  /** Etapa em animação, "tampa" (fecha o brioche) ou "sacola" (o lanche entra na sacola). */
  animando: string | null;
  ensacado: boolean;
  /** Estado de antes do último "Limpar", para o toast "Desfazer". */
  anterior: Estado | null;
};

export const estadoInicial: Estado = {
  tela: "escolha", lanche: null, passo: 0, colocados: [], pulados: [], bebida: null, porcao: null, animando: null, ensacado: false, anterior: null,
};

export type Acao =
  | { type: "escolherLanche"; id: LancheId }
  | { type: "colocar"; id: string }
  | { type: "pular" }
  | { type: "proximo" }
  | { type: "voltar" }
  | { type: "desfazer" }
  | { type: "limpar" }
  | { type: "restaurar" }
  | { type: "descartarAnterior" }
  | { type: "bebida"; id: BebidaId }
  | { type: "porcao"; id: PorcaoId }
  | { type: "fimAnimacao" }
  | { type: "montarOutro" }
  | { type: "definir"; estado: Estado };

export const receitaDe = (e: Estado): Receita | null => (e.lanche ? RECEITAS[e.lanche] : null);
export const etapaAtual = (e: Estado): Etapa | null => receitaDe(e)?.etapas[e.passo] ?? null;
const sem = (lista: readonly string[], id: string) => lista.filter((x) => x !== id);

/** Etapa resolvida: colocada ou pulada (as opcionais); na bebida/porção, escolhida ou dispensada. */
export function resolvida(e: Estado): boolean {
  const etapa = etapaAtual(e);
  if (e.tela === "montar") return !!etapa && (e.colocados.includes(etapa.id) || e.pulados.includes(etapa.id));
  if (e.tela === "bebida") return e.bebida !== null || e.pulados.includes("bebida");
  if (e.tela === "porcao") return e.porcao !== null || e.pulados.includes("porcao");
  return false;
}

/** A tampa (do pão ou do brioche) está fechada na cena? */
export function tampaFechada(e: Estado): boolean {
  const r = receitaDe(e);
  if (!r) return false;
  const { fechaApos } = r.tampa;
  if (!fechaApos) return e.colocados.includes("mussarela");
  const ia = r.etapas.findIndex((x) => x.id === fechaApos);
  return e.tela !== "montar" || e.passo > ia || r.etapas.slice(ia + 1).some((x) => e.colocados.includes(x.id));
}

/** Arquivos GLB (sem extensão) para pré-carregar ao escolher o lanche. */
export function arquivosDoLanche(id: LancheId): string[] {
  const r = RECEITAS[id];
  const pao = r.tampa.modelo === "pao";
  return ["tabua", ...(pao ? [] : ["dog-cesta"]), ...r.etapas.map((x) => (x.id === "macarico" ? "macarico-mao" : x.id)), ...(pao ? ["gratinado"] : []), "sacola"];
}

function avancar(e: Estado): Estado {
  const r = receitaDe(e)!;
  const fecha = r.tampa.fechaApos === r.etapas[e.passo]?.id;
  const base = { ...e, animando: fecha ? "tampa" : e.animando };
  return e.passo < r.etapas.length - 1 ? { ...base, passo: e.passo + 1 } : { ...base, tela: "bebida" };
}

/** Final pronto, sem animação (parâmetros de URL para QA). */
export function estadoFinalDe(lanche: LancheId, bebida: BebidaId | null, porcao: PorcaoId | null): Estado {
  const r = RECEITAS[lanche];
  return {
    ...estadoInicial, tela: "final", lanche, passo: r.etapas.length - 1, colocados: r.etapas.map((x) => x.id), bebida, porcao,
    pulados: [...(bebida ? [] : ["bebida"]), ...(porcao ? [] : ["porcao"])], ensacado: true,
  };
}

export function bancadaReducer(estado: Estado, acao: Acao): Estado {
  const mantemAnterior = acao.type === "limpar" || acao.type === "restaurar" || acao.type === "fimAnimacao";
  const e = mantemAnterior || !estado.anterior ? estado : { ...estado, anterior: null };
  const r = receitaDe(e);
  switch (acao.type) {
    case "escolherLanche": return { ...estadoInicial, tela: "montar", lanche: acao.id };
    case "montarOutro": return estadoInicial;
    case "definir": return acao.estado;
    case "descartarAnterior": return e;
    case "fimAnimacao":
      if (!e.animando) return e;
      return { ...e, animando: null, ensacado: e.ensacado || e.animando === "sacola" };
    case "colocar": {
      const etapa = etapaAtual(e);
      if (!r || e.tela !== "montar" || e.animando || !etapa || etapa.id !== acao.id || e.colocados.includes(etapa.id)) return e;
      return { ...e, colocados: [...e.colocados, etapa.id], pulados: sem(e.pulados, etapa.id), animando: etapa.id };
    }
    case "pular": {
      if (e.animando) return e;
      if (e.tela === "montar") {
        const etapa = etapaAtual(e);
        return etapa?.opcional ? avancar({ ...e, pulados: [...e.pulados, etapa.id] }) : e;
      }
      if (e.tela === "bebida") return { ...e, bebida: null, pulados: [...sem(e.pulados, "bebida"), "bebida"], tela: "porcao" };
      if (e.tela === "porcao") return { ...e, porcao: null, pulados: [...sem(e.pulados, "porcao"), "porcao"], tela: "final", animando: "sacola", ensacado: false };
      return e;
    }
    case "proximo": {
      if (e.animando || !resolvida(e)) return e;
      if (e.tela === "montar") return avancar(e);
      if (e.tela === "bebida") return { ...e, tela: "porcao" };
      if (e.tela === "porcao") return { ...e, tela: "final", animando: "sacola", ensacado: false };
      return e;
    }
    case "voltar": {
      if (e.animando && e.animando !== "sacola") return e;
      if (e.tela === "final") return { ...e, tela: "porcao", animando: null };
      if (e.tela === "porcao") return { ...e, tela: "bebida" };
      if (e.tela === "bebida") return { ...e, tela: "montar", passo: (r?.etapas.length ?? 1) - 1 };
      if (e.tela === "montar") return e.passo > 0 ? { ...e, passo: e.passo - 1 } : estadoInicial;
      return e;
    }
    case "desfazer": {
      if (e.animando) return e;
      if (e.tela === "bebida") return { ...e, bebida: null };
      if (e.tela === "porcao") return { ...e, porcao: null };
      if (e.tela !== "montar" || !r || !e.colocados.length) return e;
      const ultimo = e.colocados[e.colocados.length - 1];
      return { ...e, colocados: e.colocados.slice(0, -1), passo: r.etapas.findIndex((x) => x.id === ultimo) };
    }
    case "limpar": {
      if (e.animando) return e;
      if (e.tela === "bebida" || e.tela === "porcao") {
        if (!e.bebida && !e.porcao) return e;
        return { ...e, bebida: null, porcao: null, tela: "bebida", pulados: e.pulados.filter((x) => x !== "bebida" && x !== "porcao"), anterior: { ...e, anterior: null } };
      }
      if (e.tela !== "montar" || !e.lanche || !(e.colocados.length || e.pulados.length)) return e;
      return { ...estadoInicial, tela: "montar", lanche: e.lanche, anterior: { ...e, anterior: null } };
    }
    case "restaurar": return e.anterior ? { ...e.anterior, animando: null } : e;
    case "bebida": return e.tela === "bebida" ? { ...e, bebida: e.bebida === acao.id ? null : acao.id, pulados: sem(e.pulados, "bebida") } : e;
    case "porcao": return e.tela === "porcao" ? { ...e, porcao: e.porcao === acao.id ? null : acao.id, pulados: sem(e.pulados, "porcao") } : e;
  }
}

export type Progresso = { rotulo: string; detalhe: string; indice: number; etapas: number; grupo: "lanche" | "bebida" | "porcao" | "final" };
export function progresso(e: Estado): Progresso {
  const r = receitaDe(e);
  const n = r?.etapas.length ?? 0;
  if (e.tela === "montar" && r) return { rotulo: `Etapa ${e.passo + 1} de ${n}`, detalhe: r.etapas[e.passo].nome, indice: e.passo, etapas: n, grupo: "lanche" };
  if (e.tela === "bebida") return { rotulo: "Combo · etapa 1 de 2", detalhe: "Bebida", indice: n, etapas: n, grupo: "bebida" };
  if (e.tela === "porcao") return { rotulo: "Combo · etapa 2 de 2", detalhe: "Porção", indice: n + 1, etapas: n, grupo: "porcao" };
  return { rotulo: "Tudo pronto", detalhe: "na sacola", indice: n + 2, etapas: n, grupo: "final" };
}

export function textoPedido(e: Estado): string {
  const r = receitaDe(e);
  if (!r) return "";
  const bebida = BEBIDAS.find((b) => b.id === e.bebida);
  const porcao = PORCOES.find((p) => p.id === e.porcao);
  const colocadas = r.etapas.filter((x) => e.colocados.includes(x.id)).map((x) => (x.id === "macarico" ? "gratinado no maçarico" : x.opcao.nome.toLowerCase()));
  const puladas = r.etapas.filter((x) => x.opcional && !e.colocados.includes(x.id)).map((x) => x.opcao.nome.toLowerCase());
  return [
    "Pedido Alhoaria",
    `Lanche: ${r.nome}${r.assinatura ? ` ${r.assinatura}` : ""}`,
    `Camadas: ${colocadas.join(", ")}`,
    ...(puladas.length ? [`Sem: ${puladas.join(", ")}`] : []),
    `Bebida: ${bebida ? bebida.nome : "sem bebida"}`,
    `Porção: ${porcao ? porcao.nome : "sem porção"}`,
  ].join("\n");
}
