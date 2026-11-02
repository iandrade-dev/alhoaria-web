import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
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
        url: "/refs/menu-header.jpg",
        width: 1200,
        height: 630,
        alt: "Alhoaria Pão de Alho de Costela",
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
      <body className="bg-carvao text-osso antialiased min-h-screen flex flex-col selection:bg-macarico selection:text-white">
        <Header />
        <main className="flex-1">{children}</main>
        <CartDrawer />
        <Footer />
      </body>
    </html>
  );
}
