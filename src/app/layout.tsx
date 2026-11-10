import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "@fontsource/anton/400.css";
import "@fontsource-variable/inter";
import "@fontsource/caveat-brush/400.css";
import "./globals.css";
import Header from "@/components/Header";
import { SacolaProvider } from "@/components/pedido/SacolaProvider";
import Sacola from "@/components/pedido/Sacola";
import { restaurante } from "@/data/restaurante";
import { metadataDaPagina } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(restaurante.siteUrl),
  ...metadataDaPagina(`${restaurante.nome} — ${restaurante.subtitulo}`, restaurante.descricao, "/"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: restaurante.cores.fundo };

const cores = {
  "--carvao": restaurante.cores.fundo, "--carvao-leve": restaurante.cores.superficie, "--carvao-borda": restaurante.cores.borda,
  "--osso": restaurante.cores.texto, "--osso-muted": restaurante.cores.textoSecundario, "--creme": restaurante.cores.creme,
  "--macarico": restaurante.cores.destaque, "--ouro": restaurante.cores.ouro, "--queijo": restaurante.cores.queijo,
  "--madeira": restaurante.cores.madeira, "--madeira-escura": restaurante.cores.madeiraEscura,
};
const tema = Object.fromEntries(Object.entries(cores).flatMap(([nome, cor]) => [[nome, cor], [`${nome}-rgb`, `${parseInt(cor.slice(1, 3), 16)} ${parseInt(cor.slice(3, 5), 16)} ${parseInt(cor.slice(5, 7), 16)}`]])) as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={restaurante.idioma} className="scroll-smooth" style={tema}>
      <body className="min-h-screen bg-carvao font-sans text-osso antialiased selection:bg-macarico selection:text-carvao">
        <SacolaProvider>
          <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
          <Header />
          <main id="conteudo">{children}</main>
          <Sacola />
        </SacolaProvider>
      </body>
    </html>
  );
}
