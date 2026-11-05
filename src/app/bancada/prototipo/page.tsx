import type { Metadata } from "next";
import Prototipo from "@/components/bancada-proto/Prototipo";

export const metadata: Metadata = {
  title: "Monte o seu, protótipo",
  description: "Protótipo da bancada gamificada: arraste a ferramenta até o lanche e a mão de luva faz o resto.",
  robots: { index: false },
};

export default function PaginaPrototipo() {
  return <Prototipo />;
}
