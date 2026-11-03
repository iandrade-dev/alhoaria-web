import type { Metadata } from "next";
import "@fontsource/anton/400.css";
import "@fontsource-variable/inter";
import "@fontsource/caveat-brush/400.css";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  metadataBase: new URL("https://alhoaria-web.vercel.app"),
  title: "Alhoaria — Lanches no pão de alho",
  description: "O melhor lanche no pão de alho da Grande Floripa. Costela 6 horas e queijo gratinado no maçarico.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className="min-h-screen bg-carvao font-sans text-osso antialiased selection:bg-macarico selection:text-carvao">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
