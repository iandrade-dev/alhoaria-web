"use client";

import { useState } from "react";
import menuData from "@/data/menu.json";
import { formatBRL } from "@/lib/money";
import FoodMedia from "./FoodMedia";
import ProductDrawer from "./ProductDrawer";
import { MenuItem } from "./ProductCard";

export default function FeaturedCombos() {
  const combos = menuData.items.filter((item) => item.category === "combos").slice(0, 3);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  return (
    <section className="border-y border-carvao-borda bg-madeira-escura">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl uppercase tracking-wide text-osso sm:text-3xl">
            Peça com acompanhamento e bebida
          </h2>
          <a href="#cardapio" className="hidden text-sm font-semibold text-macarico sm:inline">
            Ver todos os combos
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => (
            <button
              key={combo.id}
              type="button"
              onClick={() => setSelected(combo as MenuItem)}
              className="flex w-full items-center gap-3 rounded-lg border border-carvao-borda bg-carvao p-3 text-left hover:border-macarico/50"
            >
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-madeira-escura">
                <FoodMedia
                  src={combo.image}
                  name={combo.name}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base uppercase tracking-wide text-osso">
                  {combo.name}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-osso-muted">
                  {combo.description}
                </span>
                <span className="mt-1 block text-sm font-semibold tabular-nums text-ouro">
                  R$ {formatBRL(combo.price)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <ProductDrawer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
