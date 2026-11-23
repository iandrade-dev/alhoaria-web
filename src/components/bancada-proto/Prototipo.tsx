"use client";

import { Bancada, type DadosDaBancada } from "@cardapios/bancada-3d/react";
import { restaurante } from "@/data/restaurante";
import { dispositivoLeve } from "@/lib/desempenho";
import { pedidoDaURL, urlDoPedido } from "@/lib/pedido-url";
import BotaoSacola from "../pedido/BotaoSacola";
import { useSacola } from "../pedido/SacolaProvider";
import * as cardapio from "./cardapio";
import * as layout from "./layout";

const dados: DadosDaBancada = {
  cardapio, layout, restaurante, BotaoSacola, dispositivoLeve, pedidoDaURL, urlDoPedido,
};

export default function BancadaRestaurante() {
  const sacola = useSacola();
  return <Bancada dados={dados} sacola={sacola} />;
}
