import { RECEITAS, ORDEM_LANCHES, type LancheId } from "../components/bancada/passos";

const precos: Record<LancheId, number> = { costela: 4490, pulled: 3590, brocolis: 3390, dogalho: 2690 };
export const CATALOGO = ORDEM_LANCHES.map((id) => ({ id, nome: RECEITAS[id].nome, descricao: RECEITAS[id].desc, foto: RECEITAS[id].foto, preco: precos[id], experiencia3D: true }));
export const CATALOGO_POR_ID = Object.fromEntries(CATALOGO.map((item) => [item.id, item])) as Record<LancheId, (typeof CATALOGO)[number]>;
