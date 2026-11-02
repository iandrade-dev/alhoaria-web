"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Instagram, MapPin, Heart, Flame } from "lucide-react";
import menuData from "@/data/menu.json";

export default function Footer() {
  return (
    <footer className="w-full bg-black border-t border-carvao-borda text-osso-muted py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Brand identity */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/20 bg-carvao flex-shrink-0">
            <Image
              src="/refs/logo-anota.jpg"
              alt="Alhoaria Selo"
              width={64}
              height={64}
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="font-display text-xl uppercase tracking-wider text-osso">
              ALHOARIA
            </h3>
            <p className="text-xs text-osso-muted">
              Pão de Alho Recheado · Santa Catarina · Desde 2023
            </p>
            <p className="text-[11px] text-osso-muted/60 mt-1">
              Pedra Branca (Palhoça) · Kobrasol (São José) · Em breve Praia de Fora
            </p>
          </div>
        </div>

        {/* Links & Social */}
        <div className="flex flex-col sm:flex-row items-center gap-6 text-xs">
          <a
            href={menuData.brand.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-osso transition-colors border border-white/10"
          >
            <Instagram className="w-4 h-4 text-macarico" />
            <span>@alhoaria (18,7k)</span>
          </a>

          <a
            href={menuData.brand.linktree}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-osso transition-colors"
          >
            Linktree Oficial
          </a>

          <a
            href={menuData.brand.anota_ai_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-osso transition-colors"
          >
            Anota AI
          </a>
        </div>

        {/* Credit */}
        <div className="text-center md:text-right text-xs text-osso-muted/70">
          <p>
            Lanche bom é no pão de alho. O resto é pão. 🔥
          </p>
          <p className="mt-1 text-[11px] text-osso-muted/50">
            Desenvolvido por{" "}
            <a
              href="https://instagram.com/iandradedev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ouro hover:underline"
            >
              @iandradedev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
