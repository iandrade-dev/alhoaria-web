// Os índices referem-se a costela.ingredients; o maçarico é uma etapa de preparo.
export const PASSOS = [
  { id: "pao", nome: "Pão de alho da casa", pedido: "Escolha o pão", anotacao: "tostado na chapa", ingrediente: 0, opcoes: [{ id: "pao-casa", nome: "Pão de alho da casa", icone: "pao" }] },
  { id: "pasta", nome: "Pasta de alho", pedido: "Escolha a pasta", anotacao: "pasta de alho da casa", ingrediente: 1, opcoes: [{ id: "pasta-alho", nome: "Pasta de alho", icone: "pasta" }] },
  { id: "costela", nome: "Costela desfiada", pedido: "Escolha o recheio", anotacao: "6 horas de fogo", ingrediente: 2, opcoes: [{ id: "costela-desfiada", nome: "Costela desfiada", icone: "costela" }] },
  { id: "creme", nome: "Creme de queijo", pedido: "Escolha o creme", anotacao: "creme artesanal", ingrediente: 3, opcoes: [{ id: "creme-queijo", nome: "Creme de queijo", icone: "creme" }] },
  { id: "mussarela", nome: "Mussarela", pedido: "Escolha o queijo", anotacao: "mussarela de verdade", ingrediente: 4, opcoes: [{ id: "mussarela", nome: "Mussarela", icone: "mussarela" }] },
  { id: "macarico", nome: "Maçarico", pedido: "Finalize no maçarico", anotacao: "dourado no maçarico", ingrediente: null, opcoes: [{ id: "macarico", nome: "Maçarico", icone: "macarico" }] },
] as const;

export type PassoId = (typeof PASSOS)[number]["id"];
export type EstadoBancada = {
  passoAtual: number;
  colocados: ReadonlySet<PassoId>;
  animando: boolean;
};
export const estadoInicial: EstadoBancada = { passoAtual: 0, colocados: new Set<PassoId>(), animando: false };
export type AcaoBancada =
  | { type: "escolher"; opcaoId: string }
  | { type: "desfazer" }
  | { type: "pular" }
  | { type: "fimAnimacao" }
  | { type: "recomecar" };

export function bancadaReducer(estado: EstadoBancada, acao: AcaoBancada): EstadoBancada {
  switch (acao.type) {
    case "recomecar": return { ...estadoInicial, colocados: new Set<PassoId>() };
    case "escolher": {
      if (estado.animando || estado.passoAtual >= PASSOS.length) return estado;
      const passo = PASSOS[estado.passoAtual];
      if (!passo.opcoes.some((opcao) => opcao.id === acao.opcaoId)) return estado;
      return { ...estado, colocados: new Set([...estado.colocados, passo.id]), animando: true };
    }
    case "desfazer": {
      if (estado.animando || !estado.colocados.size) return estado;
      const indice = PASSOS.findLastIndex((passo) => estado.colocados.has(passo.id));
      const colocados = new Set(estado.colocados);
      colocados.delete(PASSOS[indice].id);
      return { ...estado, passoAtual: indice, colocados };
    }
    case "pular":
      if (estado.animando || estado.passoAtual >= PASSOS.length) return estado;
      return { ...estado, passoAtual: estado.passoAtual + 1 };
    case "fimAnimacao":
      if (!estado.animando) return estado;
      return { ...estado, animando: false, passoAtual: estado.passoAtual + 1 };
  }
}
