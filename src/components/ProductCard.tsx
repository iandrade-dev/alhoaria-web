"use client";

import { formatBRL } from "@/lib/money";
import FoodMedia from "./FoodMedia";

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
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full flex-col overflow-hidden rounded-lg border border-carvao-borda bg-carvao-leve text-left hover:border-macarico/50"
    >
      <div className="relative aspect-[4/3] w-full bg-madeira-escura" aria-hidden>
        <FoodMedia
          src={item.image}
          name={item.name}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-display text-xl uppercase tracking-wide text-osso">
            {item.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-osso-muted">
            {item.description}
          </p>
        </div>

        <div className="mt-4 border-t border-carvao-borda pt-3">
          {item.startingPrice && (
            <span className="block text-sm font-semibold text-osso-muted">
              A partir de
            </span>
          )}
          <span className="text-lg font-bold tabular-nums text-ouro">
            R$ {formatBRL(item.price)}
          </span>
        </div>
      </div>
    </button>
  );
}
