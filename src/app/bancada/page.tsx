import type { Metadata } from "next";
import { CatalogoDaRota } from "@/components/CatalogoProvider";
import Prototipo from "@/components/bancada-proto/Prototipo";
import { criarCardapio } from "@/components/bancada-proto/cardapio";
import { restaurante } from "@/data/restaurante";
import { carregarPublicacao } from "@/lib/catalogo-publicado";
import { metadataDaPagina } from "@/lib/seo";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  ...metadataDaPagina(`Monte o seu — ${restaurante.nome}`, "Monte seu lanche em 3D, escolha bebidas e acompanhamentos e guarde na sua sacola.", "/bancada"),
  robots: { index: false, follow: true },
};

export default async function PaginaBancada() {
  const publicacao = await carregarPublicacao();
  if (!restaurante.experiencias.montagem3D || !publicacao || !criarCardapio(publicacao).lanches.some((produto) => produto.experiencia3D)) redirect("/cardapio");
  return <><CatalogoDaRota publicacao={publicacao} /><Prototipo /></>;
}
