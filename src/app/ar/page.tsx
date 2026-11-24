import type { Metadata } from "next";
import { restaurante } from "@/data/restaurante";
import { metadataDaPagina } from "@/lib/seo";
export { default } from "../bancada/page";

export const metadata: Metadata = {
  ...metadataDaPagina(`Na sua mesa — ${restaurante.nome}`, "Monte seu lanche em realidade aumentada e guarde na mesma sacola do cardápio simples.", "/ar"),
  robots: { index: false, follow: true },
};
