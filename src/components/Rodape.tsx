import Image from "next/image";
import { INSTAGRAM_URL, PEDIDO_URL } from "@/lib/links";

export default function Rodape() {
  return (
    <footer className="border-t border-carvao-borda bg-carvao px-5 py-8 pb-[calc(2rem+env(safe-area-inset-bottom)+56px)] text-osso sm:px-10 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/assets/photos/logo-anota.webp" alt="Logo Alhoaria" width={48} height={48} className="h-10 w-10 object-contain" />
          <p className="text-sm text-osso-muted">Alhoaria · desde 2023</p>
        </div>
        <nav className="flex flex-wrap gap-5 text-sm font-semibold">
          <a href={PEDIDO_URL} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center hover:text-macarico">Anota Aí</a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center hover:text-macarico">Instagram</a>
        </nav>
      </div>
    </footer>
  );
}
