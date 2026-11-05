import type { Metadata } from "next";
import Bancada from "@/components/bancada/Bancada";

export const metadata: Metadata = {
  title: "Monte o seu — Alhoaria",
  description: "Monte o seu lanche camada por camada na bancada 3D da Alhoaria: pão de alho, Dogalho, bebida e porção.",
};

export default function PaginaBancada() {
  return <Bancada />;
}
