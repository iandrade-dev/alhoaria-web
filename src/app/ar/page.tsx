import type { Metadata } from "next";
import Prototipo from "@/components/bancada-proto/Prototipo";
import { restaurante } from "@/data/restaurante";
import { metadataDaPagina } from "@/lib/seo";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  ...metadataDaPagina(`Na sua mesa — ${restaurante.nome}`, "Monte seu lanche em realidade aumentada e guarde na mesma sacola do cardápio simples.", "/ar"),
  robots: { index: false, follow: true },
};
export default function PaginaAR() { if (!restaurante.experiencias.montagem3D) redirect("/cardapio"); return <Prototipo />; }
