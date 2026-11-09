import type { LancheDef, PassoDef } from "../bancada-proto/layout";
import type { Opcoes } from "../bancada-proto/cardapio";

/** Mesmas escolhas e etapas da bancada, sem inventar um segundo cardápio. */
export function sequencia(def: LancheDef, opcoes: Opcoes | null): PassoDef[] {
  return def.passos.filter((p) => p.tipo !== "turbinar"
    && !(p.grupo && opcoes?.[p.grupo] === "sem")
    && !(p.tipo === "macarico" && opcoes?.queijo === "sem"));
}
export const estacao = (passo: PassoDef, opcoes: Opcoes | null) =>
  passo.grupo && opcoes?.[passo.grupo] ? `${passo.id}:${opcoes[passo.grupo]}` : passo.id;
