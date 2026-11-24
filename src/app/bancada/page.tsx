import type { Metadata } from "next";
import { CatalogoDaRota } from "@/components/CatalogoProvider";
import Prototipo from "@/components/bancada-proto/Prototipo";
import { catalogoDaBancadaAlhoaria } from "@cardapios/bancada-3d/react/alhoaria";
import { restaurante } from "@/data/restaurante";
import { carregarPublicacao } from "@/lib/catalogo-publicado";
import { metadataDaPagina } from "@/lib/seo";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  ...metadataDaPagina(`Monte o seu — ${restaurante.nome}`, "Monte seu lanche em 3D, escolha bebidas e acompanhamentos e guarde na sua sacola.", "/bancada"),
  robots: { index: false, follow: true },
};

export default async function PaginaBancada({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [publicacao, parametros] = await Promise.all([carregarPublicacao(), searchParams]);
  const consulta = new URLSearchParams();
  for (const [nome, valor] of Object.entries(parametros)) {
    for (const item of typeof valor === "string" ? [valor] : valor ?? []) consulta.append(nome, item);
  }
  const personalizacaoDaSacola = consulta.get("combo") === "1"
    || [...consulta].some(([nome, valor]) => /^(adicional|separado)\./.test(nome) && Number(valor) > 1);
  const montagem = publicacao && catalogoDaBancadaAlhoaria(publicacao);
  if (!restaurante.experiencias.montagem3D || !publicacao || !montagem
    || !montagem.produtos.length || personalizacaoDaSacola) {
    redirect(consulta.size ? `/cardapio?${consulta}` : "/cardapio");
  }
  return <><CatalogoDaRota publicacao={publicacao} /><Prototipo key={`${publicacao.publicationId}:${consulta}`} publicacao={publicacao} consulta={consulta.toString()} /></>;
}
