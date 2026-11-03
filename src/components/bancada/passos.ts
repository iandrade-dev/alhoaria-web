// Os índices referem-se a costela.ingredients; o maçarico é uma etapa de preparo.
export const PASSOS = [
  { id: "pao", nome: "Pão tostado", anotacao: "tostado na chapa", ingrediente: 0 },
  { id: "pasta", nome: "Pasta de alho", anotacao: "pasta de alho da casa", ingrediente: 1 },
  { id: "costela", nome: "Costela desfiada", anotacao: "6 horas de fogo", ingrediente: 2 },
  { id: "creme", nome: "Creme de queijo", anotacao: "creme artesanal", ingrediente: 3 },
  { id: "mussarela", nome: "Mussarela", anotacao: "mussarela de verdade", ingrediente: 4 },
  { id: "macarico", nome: "Maçarico", anotacao: "dourado no maçarico", ingrediente: null },
] as const;

export type PassoId = (typeof PASSOS)[number]["id"];

export type EstadoBancada = {
  passoAtual: number;
  colocados: ReadonlySet<PassoId>;
  animando: boolean;
};

export const estadoInicial: EstadoBancada = {
  passoAtual: 0,
  colocados: new Set<PassoId>(),
  animando: false,
};

export type AcaoBancada =
  | { type: "colocar" }
  | { type: "pular" }
  | { type: "fimAnimacao" }
  | { type: "recomecar" };

export function bancadaReducer(estado: EstadoBancada, acao: AcaoBancada): EstadoBancada {
  switch (acao.type) {
    case "recomecar":
      return { passoAtual: 0, colocados: new Set<PassoId>(), animando: false };
    case "colocar":
      if (estado.animando || estado.passoAtual >= PASSOS.length) return estado;
      return {
        ...estado,
        colocados: new Set([...estado.colocados, PASSOS[estado.passoAtual].id]),
        animando: true,
      };
    case "pular":
      if (estado.animando || estado.passoAtual >= PASSOS.length) return estado;
      return { ...estado, passoAtual: estado.passoAtual + 1 };
    case "fimAnimacao":
      if (!estado.animando) return estado;
      return { ...estado, animando: false, passoAtual: estado.passoAtual + 1 };
  }
}
