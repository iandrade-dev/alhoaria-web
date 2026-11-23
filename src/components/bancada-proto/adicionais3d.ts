import { criarPoteComTampa } from "@cardapios/bancada-3d";
import type { SeparadoId } from "./cardapio";

export { dose, potinho, punhadoNaMao, type Altura } from "@cardapios/bancada-3d";

/** Cor do creme de cada separado. */
const CREMES: Record<SeparadoId, string> = {
  "pasta-tradicional": "#efe5c8",
  "pasta-ervas": "#c9d39a",
  "creme-4-queijos": "#f1d88e",
  "creme-cheddar": "#e2862c",
};
/** Potinho descartável com tampa transparente (separado), apoiado em y = 0. */
export function potinhoSeparado(id: SeparadoId) {
  return criarPoteComTampa(CREMES[id]);
}
