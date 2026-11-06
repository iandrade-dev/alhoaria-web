import type { Metadata } from "next";
import Prototipo from "@/components/bancada-proto/Prototipo";

export const metadata: Metadata = {
  title: "Monte o seu — Alhoaria",
  description: "Monte o lanche na cozinha da Alhoaria, turbine, escolha bebida e combo e peça pelo WhatsApp.",
};

export default function PaginaBancada() {
  return <Prototipo />;
}
