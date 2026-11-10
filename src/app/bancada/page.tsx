import type { Metadata } from "next";
import Prototipo from "@/components/bancada-proto/Prototipo";
import { restaurante } from "@/data/restaurante";
import { metadataDaPagina } from "@/lib/seo";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  ...metadataDaPagina(`Monte o seu — ${restaurante.nome}`, "Monte seu lanche em 3D, escolha bebidas e acompanhamentos e guarde na sua sacola.", "/bancada"),
  robots: { index: false, follow: true },
};

export default function PaginaBancada() {
  if (!restaurante.experiencias.montagem3D) redirect("/cardapio");
  return <Prototipo />;
}
