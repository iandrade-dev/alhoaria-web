import type { Metadata } from "next";
import Prototipo from "@/components/bancada-proto/Prototipo";

export const metadata: Metadata = {
  title: "Na sua mesa — Alhoaria",
  description: "Monte seu lanche na bancada ou em realidade aumentada, escolha bebidas e acompanhamentos e faça o pedido.",
};
export default function PaginaAR() { return <Prototipo />; }
