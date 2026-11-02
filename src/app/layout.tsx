import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import StickyCartBar from "@/components/StickyCartBar";

export const metadata: Metadata = {
  metadataBase: new URL("https://alhoaria-web.vercel.app"),
  title: "Alhoaria — Lanches no Pão de Alho · Palhoça e São José",
  description:
    "Sanduíches artesanais no pão de alho recheados com costela 6h, queijo gratinado no maçarico, burgers, Mac Cheese e chopp Lohn. Pedra Branca e Kobrasol.",
  keywords: [
    "Alhoaria",
    "Pão de Alho Recheado",
    "Costela 6 horas",
    "Queijo Maçaricado",
    "Palhoça",
    "Pedra Branca",
    "São José",
    "Kobrasol",
    "Sanduíche artesanal",
    "Chopp Lohn",
  ],
  openGraph: {
    title: "Alhoaria — Lanches no Pão de Alho",
    description:
      "Lanche bom é no pão de alho. O resto é pão. Queijo gratinado no maçarico, costela 6h e chopp artesanal.",
    url: "https://alhoaria.com.br",
    siteName: "Alhoaria",
    images: [
      {
        url: "/assets/posters/alhoaria-costela-hero-w1600.webp",
        width: 1600,
        height: 1600,
        alt: "Pão de alho da Costela, aberto, com costela desfiada e queijo",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className="flex min-h-screen flex-col bg-carvao text-osso antialiased selection:bg-macarico selection:text-carvao">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <StickyCartBar />
        <CartDrawer />
      </body>
    </html>
  );
}
