"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, MapPin, Clock, Flame, Sparkles } from "lucide-react";
import { useCart } from "@/store/useCart";

export default function Header() {
  const { getTotalItems, setIsCartOpen } = useCart();
  const [totalItems, setTotalItems] = useState(0);
  const [isOpenNow, setIsOpenNow] = useState(false);

  useEffect(() => {
    setTotalItems(getTotalItems());
  }, [getTotalItems]);

  useEffect(() => {
    // Check operating hours: Mon-Sat 18:30 - 00:00 (America/Sao_Paulo)
    const checkHours = () => {
      const now = new Date();
      // UTC to BRT (UTC-3)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const brt = new Date(utc - 3600000 * 3);
      const day = brt.getDay(); // 0 is Sunday
      const hour = brt.getHours();
      const min = brt.getMinutes();
      const totalMin = hour * 60 + min;

      // Closed Sunday (0)
      if (day === 0) {
        setIsOpenNow(false);
        return;
      }
      // 18:30 is 18*60 + 30 = 1110. Closes at midnight (1440)
      if (totalMin >= 1110 || totalMin < 30) {
        setIsOpenNow(true);
      } else {
        setIsOpenNow(false);
      }
    };
    checkHours();
    const interval = setInterval(checkHours, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-carvao/90 backdrop-blur-md border-b border-carvao-borda">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-macarico transition-colors bg-black flex-shrink-0">
            <Image
              src="/refs/logo-anota.jpg"
              alt="Alhoaria Logo"
              width={48}
              height={48}
              className="object-cover"
              priority
            />
          </div>
          <div>
            <span className="font-display text-2xl tracking-wide uppercase text-osso group-hover:text-macarico transition-colors flex items-center gap-1.5">
              ALHOARIA
            </span>
            <p className="text-[11px] uppercase tracking-wider text-osso-muted font-medium -mt-1">
              Lanches no Pão de Alho
            </p>
          </div>
        </Link>

        {/* Operating status badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-carvao-leve border border-carvao-borda text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isOpenNow ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="text-osso font-medium">
            {isOpenNow ? "Aberto agora" : "Abre às 18:30"}
          </span>
          <span className="text-osso-muted">· Seg a Sáb até 00h</span>
        </div>

        {/* Navigation & Cart button */}
        <div className="flex items-center gap-3 sm:gap-4">
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-osso-muted">
            <a href="#monte-ao-vivo" className="text-ouro hover:text-macarico transition-colors flex items-center gap-1 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-macarico" />
              Monte em 3D
            </a>
            <a href="#cardapio" className="hover:text-osso transition-colors">
              Cardápio
            </a>
            <a href="#unidades" className="hover:text-osso transition-colors">
              Unidades
            </a>
            <a href="#chopp-lohn" className="hover:text-osso transition-colors">
              Chopp Lohn
            </a>
          </nav>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-macarico text-white font-medium hover:bg-macarico-glow transition-all shadow-macarico-glow active:scale-95"
            aria-label="Ver sacola de pedidos"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="hidden sm:inline font-semibold text-sm">Sacola</span>
            {totalItems > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-carvao text-ouro rounded-full border border-ouro/40 animate-bounce">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
