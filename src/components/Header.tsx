"use client";

import Image from "next/image";
import Link from "next/link";
import { restaurante } from "@/data/restaurante";
import BotaoSacola from "./pedido/BotaoSacola";

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 sm:h-[72px] border-b border-carvao-borda bg-carvao">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2" aria-label={`${restaurante.nome}, início`}>
          <Image src={restaurante.logo} alt={`Logo ${restaurante.nome}`} width={48} height={48} className="h-10 w-10 shrink-0 object-contain" priority />
          <span className="min-w-0">
            <span className="block font-display text-base uppercase leading-5 tracking-wide sm:text-lg">{restaurante.nome}</span>
            <span className="hidden text-xs text-osso-muted sm:block">{restaurante.subtitulo}</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link href="/cardapio" prefetch={false} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold hover:text-ouro">Cardápio</Link>
          <Link href="/bancada" prefetch={false} className="hidden min-h-11 items-center px-2 text-sm font-semibold hover:text-ouro md:inline-flex">Montar em 3D</Link>
          <BotaoSacola />
        </nav>
      </div>
    </header>
  );
}
