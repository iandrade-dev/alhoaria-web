import type { Pedido } from "../components/bancada-proto/cardapio";

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
