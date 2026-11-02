"use client";

import React, { useState } from "react";
import menuData from "@/data/menu.json";
import ProductCard, { MenuItem } from "./ProductCard";
import ProductDrawer from "./ProductDrawer";
import { Sparkles, Utensils } from "lucide-react";

export default function MenuSection() {
  const [activeCategory, setActiveCategory] = useState<string>("sanduiches");
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);

  const categories = menuData.categories;
  const filteredItems = (menuData.items as MenuItem[]).filter(
    (item) => item.category === activeCategory
  );

  return (
    <section id="cardapio" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <span className="px-3 py-1 rounded-full bg-macarico/15 border border-macarico/30 text-macarico text-xs font-bold uppercase tracking-wider mb-3 inline-block">
            Cardápio Artesanal
          </span>
          <h2 className="font-display text-3xl sm:text-5xl uppercase tracking-wide text-osso">
            Escolha o Seu Lanche
          </h2>
          <p className="text-sm sm:text-base text-osso-muted mt-2 max-w-xl">
            Todo sanduíche no pão de alho leva: pão especial artesanal, pasta de alho exclusiva, creme de queijo e muito queijo maçaricado.
          </p>
        </div>
      </div>

      {/* Category Tabs (Horizontal Scrollable) */}
      <div className="relative mb-10">
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 border ${
                  isActive
                    ? "bg-macarico text-white border-macarico shadow-macarico-glow scale-105"
                    : "bg-carvao-leve text-osso-muted hover:text-osso border-carvao-borda hover:border-white/20"
                }`}
              >
                <span>{cat.label}</span>
                {cat.tag && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                      isActive ? "bg-white/20 text-white" : "bg-black/40 text-ouro"
                    }`}
                  >
                    {cat.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {filteredItems.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onSelect={(selected) => setSelectedProduct(selected)}
          />
        ))}
      </div>

      {/* Product Details Drawer */}
      <ProductDrawer
        item={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  );
}
