import type { Metadata } from "next";
import { restaurante } from "@/data/restaurante";

export function metadataDaPagina(titulo: string, descricao: string, caminho: string): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: { title: titulo, description: descricao, url: caminho, siteName: restaurante.nome, locale: "pt_BR", type: "website", images: [{ url: restaurante.imagemSocial, alt: restaurante.nome }] },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, images: [restaurante.imagemSocial] },
  };
}

export function jsonLdSeguro(dados: unknown) { return JSON.stringify(dados).replace(/</g, "\\u003c"); }
