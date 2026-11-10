import { ADICIONAIS, SEPARADOS, OPCOES, PORCOES, SABORES_LATA, SABORES_SODA, novoPedido, type GrupoOpcao, type Pedido, type PorcaoId, type SaborLata, type SaborSoda, type AdicionalId, type SeparadoId } from "../components/bancada-proto/cardapio";
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
  if (bebida === "lata" && sabor && Object.prototype.hasOwnProperty.call(SABORES_LATA, sabor)) pedido.bebida = { id: "lata", sabor: sabor as SaborLata };
  if (bebida === "soda" && sabor && Object.prototype.hasOwnProperty.call(SABORES_SODA, sabor)) pedido.bebida = { id: "soda", sabor: sabor as SaborSoda };
  const porcao = q.get("porcao");
  if (porcao && Object.prototype.hasOwnProperty.call(PORCOES, porcao)) pedido.porcao = porcao as PorcaoId;
  for (const id of Object.keys(ADICIONAIS) as AdicionalId[]) {
    const n = Number(q.get(`adicional.${id}`));
    if (Number.isInteger(n) && n > 0 && n <= ADICIONAIS[id].max) pedido.adicionais[id] = n;
  }
  for (const id of Object.keys(SEPARADOS) as SeparadoId[]) {
    const n = Number(q.get(`separado.${id}`));
    if (Number.isInteger(n) && n > 0 && n <= SEPARADOS[id].max) pedido.separados[id] = n;
  }
  pedido.combo = q.get("combo") === "1";
  const lataCombo = q.get("lataCombo");
  if (lataCombo && Object.prototype.hasOwnProperty.call(SABORES_LATA, lataCombo)) pedido.lataCombo = lataCombo as SaborLata;
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
  for (const [id, n] of Object.entries(pedido.adicionais)) if (n) q.set(`adicional.${id}`, String(n));
  for (const [id, n] of Object.entries(pedido.separados)) if (n) q.set(`separado.${id}`, String(n));
  if (pedido.combo) q.set("combo", "1");
  if (pedido.lataCombo) q.set("lataCombo", pedido.lataCombo);
  return `${caminho}?${q}`;
}
