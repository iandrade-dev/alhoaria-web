import type { Metadata, Viewport } from "next";
import { CatalogoDaRota } from "@/components/CatalogoProvider";
import Garcom from "@/components/garcom/Garcom";
import { restaurante } from "@/data/restaurante";
import { carregarPublicacao } from "@/lib/catalogo-publicado";

/** Área da equipe: fora da navegação pública, do sitemap e dos buscadores. */
export const metadata: Metadata = {
  title: `Modo garçom — ${restaurante.nome}`,
  description: "Área da equipe para lançar pedidos das mesas.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: restaurante.cores.fundo, interactiveWidget: "resizes-content" };

export default async function PaginaGarcom() {
  const publicacao = await carregarPublicacao();
  return <><CatalogoDaRota publicacao={publicacao} /><Garcom /></>;
}
