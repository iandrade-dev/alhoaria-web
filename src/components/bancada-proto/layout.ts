// Geometria compartilhada do protótipo: câmeras (as mesmas do fundo renderizado no Blender, ver
// blender/bancada3d/build_cozinha_fundo.py), posição das estações em volta da tábua e os dados de cada lanche.
// Coordenadas three.js: x para a direita, y para cima, z para a câmera; origem no centro do topo da tábua.
import { ORDEM_LANCHES, RECEITAS, type LancheId } from "../bancada/passos";
import { OPCOES, type GrupoOpcao } from "./cardapio";

export { ORDEM_LANCHES, RECEITAS, type LancheId };

export const MESA = -0.028;

export type Arranjo = "retrato" | "paisagem";

export type Camera = { pos: [number, number, number]; alvo: [number, number, number]; fov: number; aspecto: number };

// fov vertical em graus; aspecto = largura/altura da imagem de fundo renderizada com esta câmera.
export const CAMERAS: Record<Arranjo, Camera> = {
  retrato: { pos: [0, 0.94, 0.98], alvo: [0, 0.0, -0.01], fov: 47, aspecto: 9 / 16 },
  paisagem: { pos: [0, 0.6, 0.76], alvo: [0, 0.02, 0.0], fov: 40, aspecto: 16 / 9 },
};

/** Tipos de ação (coreografia da mão). Os lanches de pão de alho repetem os da Costela; o Dogalho tem os seus. */
export type Tipo =
  | "pasta" | "creme" | "recheio" | "tampa" | "mussarela" | "macarico"
  | "dog-pasta" | "dog-salsichas" | "dog-molhos" | "dog-tampa" | "dog-fondue" | "dog-mussarela" | "dog-palha"
  | "turbinar";

/**
 * Id de uma etapa (é também o `data-testid="estacao-<id>"`). A tampa não tem estação: o gesto é sobre o pão; o
 * Turbinar também não (os potinhos são do pedido). Etapas com opções têm uma estação por opção, com o id
 * `<etapa>:<opção>` (ex.: `pasta:ervas`); o botão dela é o `data-testid="opcao-<grupo>-<opção>"`.
 */
export type Passo = string;
export type EstacaoId = string;
/** Etapa de uma estação (`pasta:ervas` -> `pasta`). */
export const passoDe = (est: EstacaoId): Passo => est.split(":")[0];
/** Opção de uma estação (`pasta:ervas` -> `ervas`; null se a estação não é de opção). */
export const opcaoDaEstacao = (est: EstacaoId): string | null => est.split(":")[1] ?? null;

export type PassoDef = {
  id: Passo; tipo: Tipo; icone: string; nome: string; dica: string; feito: string; opcional?: boolean;
  /** Etapa com opções do pedido (uma estação por opção e o chip "Sem ..."). */
  grupo?: Exclude<GrupoOpcao, "pao">;
};
/** Onde cada estação fica na bancada: x, z e, opcional, giro em y (rad). */
export type Lugar = [number, number] | [number, number, number];
export type LancheDef = {
  id: LancheId;
  forma: "pao" | "dog";
  nome: string;
  foto: string;
  /** Frase do card final. */
  fim: string;
  passos: PassoDef[];
  estacoes: Record<Arranjo, Record<EstacaoId, Lugar>>;
  /** GLBs (sem extensão) deste lanche, além dos comuns. */
  arquivos: string[];
  /** Recheio (pão de alho): o GLB que vai no encaixe da costela. */
  recheio?: "costela" | "pulled-pernil" | "brocolis-floretes";
};

// ---------------------------------------------------------------- pão de alho (Costela, Pulled Pork!, Brócolis & Queijo!)
// Posições da Costela (aprovadas), agora com duas bisnagas, dois potes de creme e duas tigelas de queijo (uma por
// opção do pedido). Os outros dois lanches de pão usam as mesmas.
const LUGARES_PAO = (recheio: string): Record<Arranjo, Record<EstacaoId, Lugar>> => ({
  retrato: {
    "pasta:ervas": [-0.215, -0.235],
    "pasta:tradicional": [-0.1, -0.275],
    "creme:cheddar": [0.08, -0.29],
    "creme:4-queijos": [0.21, -0.235],
    [recheio]: [-0.195, 0.24],
    "mussarela:mucarela": [-0.058, 0.3],
    "mussarela:colonial": [0.072, 0.3],
    macarico: [0.205, 0.25],
  },
  paisagem: {
    "pasta:ervas": [-0.3, -0.15],
    "pasta:tradicional": [-0.41, -0.06],
    [recheio]: [-0.38, 0.15],
    "creme:cheddar": [0.31, -0.19],
    "creme:4-queijos": [0.44, -0.1],
    "mussarela:mucarela": [0.31, 0.19],
    "mussarela:colonial": [0.44, 0.1],
    macarico: [0.17, -0.28],
  },
});
/** Estações de opção de uma etapa do pão de alho (uma por opção do grupo, na ordem do cardápio). */
export const estacoesDaOpcao = (passo: string, grupo: Exclude<GrupoOpcao, "pao">) => OPCOES[grupo].map((o) => `${passo}:${o.id}`);

const TURBINAR: PassoDef = { id: "turbinar", tipo: "turbinar", icone: "", nome: "Turbinar", dica: "Toque ou arraste um potinho até o lanche", feito: "Lanche turbinado" };

const COSTELA: LancheDef = {
  id: "costela", forma: "pao", nome: RECEITAS.costela.nome, foto: RECEITAS.costela.foto, recheio: "costela",
  fim: "A Costela, montada do seu jeito.",
  passos: [
    { id: "pasta", tipo: "pasta", icone: "pasta", nome: "Pasta de alho", dica: "Escolha a pasta e arraste até o pão", feito: "Pasta de alho no pão", grupo: "pasta" },
    { id: "costela", tipo: "recheio", icone: "costela", nome: "Costela", dica: "Arraste um punhado de costela até o pão", feito: "Costela no lugar" },
    { id: "creme", tipo: "creme", icone: "creme", nome: "Creme de queijo", dica: "Escolha o creme e arraste até a carne", feito: "Creme por cima da carne", grupo: "creme" },
    TURBINAR,
    { id: "tampa", tipo: "tampa", icone: "pao", nome: "Tampa", dica: "Deslize no pão pra fechar a tampa", feito: "Tampa fechada" },
    { id: "mussarela", tipo: "mussarela", icone: "mussarela", nome: "Queijo gratinado", dica: "Escolha o queijo e arraste até o lanche", feito: "Queijo derretendo", grupo: "queijo" },
    { id: "macarico", tipo: "macarico", icone: "macarico", nome: "Maçarico", dica: "Arraste o maçarico até o lanche", feito: "Gratinado no maçarico" },
  ],
  estacoes: LUGARES_PAO("costela"),
  arquivos: ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico-mao", "mao-luva", "bisnaga", "pote-creme"],
};

/** Pulled Pork! e Brócolis & Queijo!: a mesma sequência da Costela; o nome do recheio vem da receita. */
function lancheDePao(id: "pulled" | "brocolis", fim: string, punhado: string, feitoRecheio: string): LancheDef {
  const r = RECEITAS[id];
  const rech = r.etapas[2];
  const recheio = rech.id as "pulled-pernil" | "brocolis-floretes";
  return {
    id, forma: "pao", nome: r.nome, foto: r.foto, recheio, fim,
    passos: [
      { id: "pasta", tipo: "pasta", icone: "pasta", nome: "Pasta de alho", dica: "Escolha a pasta e arraste até o pão", feito: "Pasta de alho no pão", grupo: "pasta" },
      { id: recheio, tipo: "recheio", icone: recheio, nome: rech.nome, dica: `Arraste um punhado de ${punhado} até o pão`, feito: feitoRecheio },
      { id: "creme", tipo: "creme", icone: "creme", nome: "Creme de queijo", dica: `Escolha o creme e arraste até ${id === "brocolis" ? "o brócolis" : "a carne"}`, feito: `Creme por cima ${id === "brocolis" ? "do brócolis" : "da carne"}`, grupo: "creme" },
      TURBINAR,
      { id: "tampa", tipo: "tampa", icone: "pao", nome: "Tampa", dica: "Deslize no pão pra fechar a tampa", feito: "Tampa fechada" },
      { id: "mussarela", tipo: "mussarela", icone: "mussarela", nome: "Queijo gratinado", dica: "Escolha o queijo e arraste até o lanche", feito: "Queijo derretendo", grupo: "queijo" },
      { id: "macarico", tipo: "macarico", icone: "macarico", nome: "Maçarico", dica: "Arraste o maçarico até o lanche", feito: "Gratinado no maçarico" },
    ],
    estacoes: LUGARES_PAO(recheio),
    arquivos: ["tabua", "pao", "pasta", recheio, "creme", "mussarela", "gratinado", "macarico-mao", "mao-luva", "bisnaga", "pote-creme"],
  };
}

// ---------------------------------------------------------------- Dogalho (brioche numa cestinha, sem maçarico)
const dogEtapa = (id: string) => RECEITAS.dogalho.etapas.find((e) => e.id === id)!;
const DOGALHO: LancheDef = {
  id: "dogalho", forma: "dog", nome: RECEITAS.dogalho.nome, foto: RECEITAS.dogalho.foto,
  fim: "O Dogalho, montado do seu jeito.",
  passos: [
    { id: "dog-pasta", tipo: "dog-pasta", icone: "dog-pasta", nome: dogEtapa("dog-pasta").nome, dica: "Arraste a bisnaga até o brioche", feito: "Pasta de alho no brioche" },
    { id: "dog-salsichas", tipo: "dog-salsichas", icone: "dog-salsichas", nome: dogEtapa("dog-salsichas").nome, dica: "Arraste as salsichas até o brioche", feito: "Salsichas no lugar" },
    { id: "dog-molhos", tipo: "dog-molhos", icone: "dog-molhos", nome: dogEtapa("dog-molhos").nome, dica: "Arraste o ketchup até o brioche", feito: "Ketchup e mostarda", opcional: true },
    TURBINAR,
    { id: "tampa", tipo: "dog-tampa", icone: "dog-brioche", nome: "Tampa", dica: "Deslize no brioche pra fechar a tampa", feito: "Tampa fechada" },
    { id: "dog-fondue", tipo: "dog-fondue", icone: "dog-fondue", nome: dogEtapa("dog-fondue").nome, dica: "Arraste a colher de fundue até o lanche", feito: "Fundue por cima" },
    { id: "dog-mussarela", tipo: "dog-mussarela", icone: "dog-mussarela", nome: dogEtapa("dog-mussarela").nome, dica: "Arraste a mussarela até o lanche", feito: "Mussarela derretendo" },
    { id: "dog-palha", tipo: "dog-palha", icone: "dog-palha", nome: dogEtapa("dog-palha").nome, dica: "Arraste a batata palha até o lanche", feito: "Batata palha por cima", opcional: true },
  ],
  estacoes: {
    // Quem tem o braço indo para a direita e para a câmera (bisnagas, colher) fica atrás ou à direita, para o
    // braço não cruzar a frente do lanche; os punhados (a mão pega girada) podem ficar na frente, como na Costela.
    retrato: {
      "dog-pasta": [-0.215, -0.245],
      "dog-salsichas": [-0.025, -0.31, Math.PI / 2],
      "dog-molhos": [0.205, -0.27],
      "dog-mussarela": [-0.165, 0.27],
      "dog-palha": [0.03, 0.3],
      "dog-fondue": [0.205, 0.25],
    },
    paisagem: {
      "dog-pasta": [-0.37, -0.15],
      "dog-salsichas": [-0.42, 0.13, 0.1],
      "dog-molhos": [-0.2, -0.285],
      "dog-fondue": [0.42, -0.16],
      "dog-mussarela": [0.43, 0.15],
      "dog-palha": [0.23, -0.27],
    },
  },
  arquivos: ["tabua", "dog-cesta", "dog-brioche", "dog-pasta", "dog-salsichas", "dog-molhos", "dog-fondue", "dog-mussarela", "dog-palha", "mao-luva", "bisnaga", "pote-creme"],
};

export const LANCHES: Record<LancheId, LancheDef> = {
  pulled: lancheDePao("pulled", "O Pulled Pork, montado do seu jeito.", "pernil", "Pernil no lugar"),
  brocolis: lancheDePao("brocolis", "O Brócolis & Queijo, montado do seu jeito.", "brócolis", "Brócolis no lugar"),
  dogalho: DOGALHO,
  costela: COSTELA,
};
export const ehLanche = (s: string | null): s is LancheId => !!s && (ORDEM_LANCHES as readonly string[]).includes(s);

export const arranjoDe = (w: number, h: number): Arranjo => (w / Math.max(1, h) < 1 ? "retrato" : "paisagem");

/** fov vertical que reproduz o recorte "cover" da imagem de fundo na tela atual. */
export function fovPara(cam: Camera, w: number, h: number) {
  const a = w / Math.max(1, h);
  if (a <= cam.aspecto) return cam.fov;
  const t = Math.tan((cam.fov * Math.PI) / 360) * (cam.aspecto / a);
  return (Math.atan(t) * 360) / Math.PI;
}
