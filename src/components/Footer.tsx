"use client";

import Image from "next/image";
import menuData from "@/data/menu.json";

export default function Footer() {
  return (
    <footer className="w-full border-t border-carvao-borda bg-black px-4 py-12 text-osso-muted sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-carvao-borda bg-carvao">
            <Image
              src="/assets/photos/logo-anota-w320.webp"
              alt="Selo Alhoaria"
              width={64}
              height={64}
              className="object-cover"
            />
          </span>
          <div>
            <h2 className="font-display text-xl uppercase tracking-wider text-osso">
              Alhoaria
            </h2>
            <p className="text-sm text-osso-muted">
              Pão de alho recheado · Santa Catarina · Desde 2023
            </p>
            <p className="mt-1 text-sm text-osso-muted">
              Pedra Branca (Palhoça) · Kobrasol (São José) · Praia de Fora: em breve
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 text-sm sm:flex-row">
          <a
            href={menuData.brand.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded border border-carvao-borda bg-carvao-leve px-3 font-semibold text-osso"
          >
            @alhoaria
          </a>
          <a
            href={menuData.brand.linktree}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:text-osso"
          >
            Linktree
          </a>
          <a
            href={menuData.brand.anota_ai_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:text-osso"
          >
            Anota AI
          </a>
        </div>

        <div className="text-center text-sm text-osso-muted md:text-right">
          <p>Lanche bom é no pão de alho. O resto é pão.</p>
          <p className="mt-1">
            Desenvolvido por{" "}
            <a
              href="https://instagram.com/iandradedev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ouro"
            >
              @iandradedev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
