"use client";

import React, { useState } from "react";
import menuData from "@/data/menu.json";
import ProductCard, { MenuItem } from "./ProductCard";
import ProductDrawer from "./ProductDrawer";

export default function MenuSection() {
  const [activeCategory, setActiveCategory] = useState<string>("sanduiches");
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);

  const categories = menuData.categories;
  const filteredItems = (menuData.items as MenuItem[]).filter(
    (item) => item.category === activeCategory
  );

  return (
    <section id="cardapio" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mb-8 max-w-xl">
        <h2 className="font-display text-3xl uppercase tracking-wide text-osso sm:text-5xl">
          Escolha o seu lanche
        </h2>
        <p className="mt-2 text-sm text-osso-muted sm:text-base">
          Pão da casa, pasta de alho, creme de queijo e queijo no maçarico.
        </p>
      </div>

      <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              aria-pressed={isActive}
              className={`min-h-11 shrink-0 rounded border px-4 text-sm font-semibold ${
                isActive
                  ? "border-macarico bg-macarico text-carvao"
                  : "border-carvao-borda bg-carvao-leve text-osso"
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onSelect={(selected) => setSelectedProduct(selected)}
          />
        ))}
      </div>

      <ProductDrawer item={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </section>
  );
}
