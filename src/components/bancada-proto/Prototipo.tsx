"use client";

import { Bancada } from "@cardapios/bancada-3d/react";
import { catalogoDaBancadaAlhoaria } from "@cardapios/bancada-3d/react/alhoaria";
import { burgerRecipe, type Product } from "@cardapios/bancada-3d/react/model";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCatalogo } from "@/components/CatalogoProvider";
import type { PublicacaoAlhoaria } from "@/lib/publicacao-alhoaria";
import { useSacola } from "../pedido/SacolaProvider";

const semModelo = () => "";

export default function BancadaRestaurante({ publicacao, consulta }: {
  publicacao: PublicacaoAlhoaria; consulta: string;
}) {
  const router = useRouter();
  const cardapio = useCatalogo();
  const sacola = useSacola();
  const menu = useMemo(() => catalogoDaBancadaAlhoaria(publicacao), [publicacao]);
  const parametros = useMemo(() => new URLSearchParams(consulta), [consulta]);
  const [escolhido, escolher] = useState<Product>();
  const indicado = menu.produtoPorReferencia(parametros.get("lanche"));
  const product = escolhido ?? indicado ?? menu.produtos[0];
  const recipe = product && burgerRecipe(product);

  if (!recipe || !product) return null;
  return <Bancada
    key={product.id + (escolhido ? ":escolhido" : "")}
    modo="hamburguer"
    restaurant={menu.restaurant}
    product={product}
    recipe={recipe}
    menuHref="/cardapio"
    start={!escolhido && !indicado ? "escolha" : undefined}
    initialSelection={indicado === product ? {
      optionIds: menu.opcoesDaConsulta(product, parametros), choices: menu.escolhasDaConsulta(parametros),
    } : undefined}
    craft={{ products: () => menu.produtos, modelURL: semModelo, posterURL: (produto) => produto.image }}
    onChooseProduct={escolher}
    count={sacola.itens.reduce((total, item) => total + item.quantidade, 0)}
    bagOpen={sacola.aberta}
    onBag={sacola.abrirSacola}
    onClose={() => router.push("/cardapio")}
    onSave={(itens, abrir) => {
      const compra = menu.pedidoDaMontagem(itens);
      if (!compra || !cardapio || cardapio.publicationId !== publicacao.publicationId) return false;
      const { pedido, quantidade } = compra;
      const total = itens.reduce((soma, item) => soma + item.unitPriceCents * item.quantity, 0);
      if (cardapio.totalDoPedido(pedido) * quantidade !== total) return false;
      if (!sacola.adicionar({ tipo: "lanche", pedido }, quantidade)) return false;
      if (abrir) sacola.abrirSacola();
      return true;
    }}
  />;
}
