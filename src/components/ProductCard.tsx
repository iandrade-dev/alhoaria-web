"use client";

import React from "react";
import Image from "next/image";
import { Plus, Box, Flame } from "lucide-react";

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  startingPrice?: boolean;
  description: string;
  ingredients?: string[];
  image: string;
  isHero?: boolean;
  has3D?: boolean;
  isConfigurable?: boolean;
  options?: {
    pasta?: string[];
    sauce?: string[];
    proteins?: { name: string; price: number }[];
  };
}

interface ProductCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}

export default function ProductCard({ item, onSelect }: ProductCardProps) {
  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex flex-col justify-between bg-carvao-leve hover:bg-[#191512] border border-carvao-borda hover:border-macarico/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-card-dark cursor-pointer transform hover:-translate-y-1"
    >
      {/* Top Image & Badges */}
      <div className="relative w-full aspect-[4/3] bg-carvao overflow-hidden">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-carvao-leve via-transparent to-black/30" />

        {/* 3D Model Badge */}
        {item.has3D && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-carvao/90 border border-ouro/40 text-[11px] font-semibold text-ouro shadow-md backdrop-blur-md">
            <Box className="w-3.5 h-3.5" />
            <span>3D</span>
          </div>
        )}

        {item.isHero && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-macarico text-white text-[11px] font-bold shadow-macarico-glow">
            <Flame className="w-3 h-3" />
            <span>Mais Pedido</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-display text-lg sm:text-xl uppercase tracking-wide text-osso group-hover:text-macarico transition-colors">
              {item.name}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-osso-muted line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Bottom Price & Action */}
        <div className="mt-4 pt-3 border-t border-carvao-borda/60 flex items-center justify-between">
          <div>
            {item.startingPrice && (
              <span className="block text-[10px] uppercase font-bold tracking-wider text-osso-muted">
                A partir de
              </span>
            )}
            <span className="font-sans font-bold text-lg sm:text-xl text-ouro tracking-tight tabular-nums">
              R$ {item.price.toFixed(2).replace(".", ",")}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 group-hover:bg-macarico text-osso group-hover:text-white border border-white/10 group-hover:border-macarico transition-all shadow-sm active:scale-90"
            aria-label={`Ver detalhes de ${item.name}`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
