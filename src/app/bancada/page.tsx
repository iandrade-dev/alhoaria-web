import type { Metadata } from "next";
import Bancada from "@/components/bancada/Bancada";

// Rota de trabalho: fora da home e fora dos buscadores enquanto a bancada 3D é feita.
export const metadata: Metadata = {
  title: "Monte o seu — Alhoaria",
  robots: { index: false, follow: false },
};

export default function PaginaBancada() {
  return <Bancada />;
}
