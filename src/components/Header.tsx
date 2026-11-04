import Image from "next/image";
import { PEDIDO_URL } from "@/lib/links";

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 sm:h-[72px] border-b border-carvao-borda bg-carvao">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <a href="#inicio" className="flex min-w-0 items-center gap-2" aria-label="Alhoaria, início">
          <Image src="/assets/photos/logo-anota.webp" alt="Logo Alhoaria" width={48} height={48} className="h-10 w-10 shrink-0 object-contain" priority />
          <span className="min-w-0">
            <span className="block font-display text-lg leading-5 tracking-wide">ALHOARIA</span>
            <span className="hidden text-xs text-osso-muted sm:block">pão de alho recheado</span>
          </span>
        </a>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          <a href={PEDIDO_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold transition-colors duration-150 hover:text-ouro focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Cardápio</a>
          <a href={PEDIDO_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded bg-macarico px-3 text-sm font-bold text-carvao transition-colors duration-150 hover:bg-queijo active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso">Peça agora</a>
        </nav>
      </div>
    </header>
  );
}
