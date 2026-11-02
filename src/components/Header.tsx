"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/store/useCart";
import { useCartHydrated } from "@/store/useCartHydrated";
import { getOpeningStatus } from "@/lib/opening-hours";

export default function Header() {
  const setIsCartOpen = useCart((state) => state.setIsCartOpen);
  const totalItems = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const hydrated = useCartHydrated();
  const count = hydrated ? totalItems : 0;
  const [statusLabel, setStatusLabel] = useState("Seg a sáb · 18:30 às 00:00");
  const [isOpenNow, setIsOpenNow] = useState(false);

  useEffect(() => {
    const checkHours = () => {
      const status = getOpeningStatus();
      setIsOpenNow(status.open);
      setStatusLabel(status.label);
    };
    checkHours();
    const interval = setInterval(checkHours, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-carvao-borda bg-carvao">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-carvao-borda bg-black">
            <Image
              src="/assets/photos/logo-anota-w320.webp"
              alt="Selo Alhoaria"
              width={48}
              height={48}
              className="object-cover"
            />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-2xl uppercase tracking-wide text-osso">
              Alhoaria
            </span>
            <span className="block truncate text-sm font-semibold text-osso-muted">
              Lanches no pão de alho
            </span>
          </span>
        </Link>

        <p
          className={`hidden text-sm font-semibold md:block ${
            isOpenNow ? "text-ouro" : "text-osso"
          }`}
        >
          {statusLabel}
        </p>

        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-5 text-sm font-semibold text-osso-muted sm:flex">
            <a href="#monte-ao-vivo" className="hover:text-osso">
              Monte em 3D
            </a>
            <a href="#cardapio" className="hover:text-osso">
              Cardápio
            </a>
            <a href="#unidades" className="hover:text-osso">
              Unidades
            </a>
            <a href="#chopp-lohn" className="hover:text-osso">
              Chopp Lohn
            </a>
          </nav>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-macarico px-3 font-semibold text-carvao"
            aria-label={count > 0 ? `Ver sacola, ${count} ${count === 1 ? "item" : "itens"}` : "Ver sacola"}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Sacola</span>
            {count > 0 && (
              <span className="rounded bg-carvao px-1.5 text-sm font-semibold tabular-nums text-ouro">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
