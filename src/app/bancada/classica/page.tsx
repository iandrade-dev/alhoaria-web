import type { Metadata } from "next";
import Bancada from "@/components/bancada/Bancada";

export const metadata: Metadata = {
  title: "Monte o seu, versão clássica — Alhoaria",
  description: "A bancada 3D clássica da Alhoaria: monte o seu lanche camada por camada.",
  robots: { index: false },
};

export default function PaginaBancadaClassica() {
  return <Bancada />;
}
