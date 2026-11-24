"use client";

import { Bancada, type DadosDaBancada } from "@cardapios/bancada-3d/react";
import Link from "next/link";
import { useMemo } from "react";
import { useCatalogo } from "@/components/CatalogoProvider";
import { restaurante } from "@/data/restaurante";
import { dispositivoLeve } from "@/lib/desempenho";
import { urlDoPedido } from "@/lib/pedido-url";
import BotaoSacola from "../pedido/BotaoSacola";
import { useSacola } from "../pedido/SacolaProvider";
import * as layout from "./layout";

export default function BancadaRestaurante() {
  const cardapio = useCatalogo();
  const sacola = useSacola();
  const dados = useMemo<DadosDaBancada | null>(() => {
    if (!cardapio) return null;
    const disponiveis = cardapio.lanches.filter((produto) => produto.experiencia3D);
    if (!disponiveis.length) return null;
    const ORDEM_LANCHES = disponiveis.map((produto) => produto.id);
    const LANCHES = { ...layout.LANCHES };
    for (const produto of disponiveis) {
      const receita = LANCHES[produto.id];
      LANCHES[produto.id] = { ...receita, nome: produto.nome, foto: produto.foto || receita.foto };
    }
    return {
      cardapio, restaurante, BotaoSacola, dispositivoLeve, pedidoDaURL: cardapio.pedidoDaURL, urlDoPedido,
      layout: {
        ...layout, LANCHES, ORDEM_LANCHES,
        ehLanche: (id): id is (typeof ORDEM_LANCHES)[number] => layout.ehLanche(id) && ORDEM_LANCHES.includes(id),
        estacoesDaOpcao: (passo, grupo) => layout.estacoesDaOpcao(passo, grupo).filter((estacao) =>
          cardapio.opcaoDe(grupo, layout.opcaoDaEstacao(estacao)) !== null),
      },
    };
  }, [cardapio]);

  if (!dados) {
    return <div className="mx-auto max-w-xl space-y-3 px-6 py-16">
      <h1 className="font-display text-3xl">Montagem 3D indisponível</h1>
      <Link href="/cardapio" className="text-macarico underline">Abrir cardápio</Link>
    </div>;
  }
  return <Bancada dados={dados} sacola={sacola} />;
}
