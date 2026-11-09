import { OPCOES, PORCOES, SABORES_LATA, SABORES_SODA, novoPedido, type GrupoOpcao, type Pedido, type PorcaoId, type SaborLata, type SaborSoda } from "../components/bancada-proto/cardapio";
import type { LancheId } from "../components/bancada-proto/layout";

/** Parâmetros públicos validados; valores desconhecidos mantêm o fluxo normal da bancada. */
export function pedidoDaURL(q: URLSearchParams, id: LancheId): Pedido {
  const pedido = novoPedido(id);
  if (pedido.opcoes) for (const grupo of Object.keys(OPCOES) as GrupoOpcao[]) {
    const v = q.get(grupo);
    if (OPCOES[grupo].some((o) => o.id === v) || (grupo !== "pao" && v === "sem")) pedido.opcoes[grupo] = v;
  }
  const bebida = q.get("bebida"), sabor = q.get("sabor");
  if (bebida === "chopp") pedido.bebida = { id: "chopp" };
  if (bebida === "lata" && sabor && Object.hasOwn(SABORES_LATA, sabor)) pedido.bebida = { id: "lata", sabor: sabor as SaborLata };
  if (bebida === "soda" && sabor && Object.hasOwn(SABORES_SODA, sabor)) pedido.bebida = { id: "soda", sabor: sabor as SaborSoda };
  const porcao = q.get("porcao");
  if (porcao && Object.hasOwn(PORCOES, porcao)) pedido.porcao = porcao as PorcaoId;
  return pedido;
}
export function urlDoPedido(pedido: Pedido, caminho = "/bancada") {
  const q = new URLSearchParams({ lanche: pedido.lanche });
  if (pedido.opcoes) for (const [g, v] of Object.entries(pedido.opcoes)) if (v) q.set(g, v);
  if (pedido.bebida) {
    q.set("bebida", pedido.bebida.id);
    if ("sabor" in pedido.bebida) q.set("sabor", pedido.bebida.sabor);
  }
  if (pedido.porcao) q.set("porcao", pedido.porcao);
  return `${caminho}?${q}`;
}
