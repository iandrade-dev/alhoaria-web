"use client";

import React, { useState } from "react";
import Image from "next/image";
import { RotateCcw, Check, ShoppingBag, Sparkles, Flame } from "lucide-react";
import KitchenCanvas from "./KitchenCanvas";
import { useCart } from "@/store/useCart";

export const fillings = [
  {
    id: "costela",
    root: "filling_costela",
    name: "Costela 6 Horas",
    detail: "Cozida por 6 horas. Desfiada, bem suculenta.",
    price: 44.9,
    image: "/assets/posters/alhoaria-ingrediente-filling_costela-w320.webp",
  },
  {
    id: "frango",
    root: "filling_frango",
    name: "Frango Marinado",
    detail: "Sobrecoxa dourada, macia por dentro.",
    price: 33.9,
    image: "/assets/posters/alhoaria-ingrediente-filling_frango-w320.webp",
  },
  {
    id: "alcatra",
    root: "filling_alcatra",
    name: "Mr. Alcatra",
    detail: "Tiras de alcatra nobre para uma fome caprichada.",
    price: 48.9,
    image: "/assets/posters/alhoaria-ingrediente-filling_alcatra-w320.webp",
  },
  {
    id: "brocolis",
    root: "filling_brocolis",
    name: "Brócolis & Queijo",
    detail: "Verde, cremoso e vegetariano no alho e azeite.",
    price: 33.9,
    image: "/assets/posters/alhoaria-ingrediente-filling_brocolis-w320.webp",
  },
  {
    id: "pork",
    root: "filling_pork",
    name: "Pulled Pork",
    detail: "Pernil de 4 horas. Desmanchando no pão especial.",
    price: 35.9,
    image: "/assets/posters/alhoaria-ingrediente-filling_pork-w320.webp",
  },
];

export const toppings = [
  {
    root: "stage_garlic",
    name: "Pasta de Alho da Casa",
    detail: "O nosso ponto de partida exclusivo.",
    without: "pasta de alho",
  },
  {
    root: "stage_cream",
    name: "Creme Artesanal de Queijo",
    detail: "Bem cremoso, do jeito que tem que ser.",
    without: "creme de queijo",
  },
  {
    root: "stage_gratin",
    name: "Queijo Gratinado no Maçarico",
    detail: "Douradinho no fogo na sua frente.",
    without: "queijo gratinado",
  },
];

export default function SandwichKitchen() {
  const [tab, setTab] = useState<"Pão" | "Recheio" | "Pastas & queijo">("Recheio");
  const [filling, setFilling] = useState<string>("costela");
  const [extras, setExtras] = useState<string[]>([
    "stage_garlic",
    "stage_cream",
    "stage_gratin",
  ]);
  const [replay, setReplay] = useState<number>(0);
  const [status, setStatus] = useState<string>(
    "Escolha o recheio. A gente monta na sua frente."
  );

  const { addItem, setIsCartOpen } = useCart();

  const selectedFilling = fillings.find((f) => f.id === filling) || fillings[0];

  const selection = [
    "stage_bread",
    ...(extras.includes("stage_garlic") ? ["stage_garlic"] : []),
    selectedFilling.root,
    ...extras.filter((e) => e !== "stage_garlic"),
  ];

  const toggleExtra = (root: string) => {
    setExtras((prev) =>
      prev.includes(root) ? prev.filter((id) => id !== root) : [...prev, root]
    );
  };

  const handleAddToCart = () => {
    const withoutList = toppings
      .filter((t) => !extras.includes(t.root))
      .map((t) => t.without);

    addItem({
      itemId: selectedFilling.id,
      name: `Pão de Alho — ${selectedFilling.name}`,
      unitPrice: selectedFilling.price,
      quantity: 1,
      image: selectedFilling.image,
      notes: withoutList.length ? `Sem ${withoutList.join(", ")}` : undefined,
    });
    setIsCartOpen(true);
  };

  return (
    <section id="monte-ao-vivo" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-carvao-borda">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-macarico/15 border border-macarico/30 text-macarico text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Bancada 3D do Chef
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-5xl uppercase tracking-wide text-osso">
            Sua fome. Suas escolhas.
          </h2>
          <p className="text-sm sm:text-base text-osso-muted mt-2 max-w-xl">
            Acompanhe o chef montando o seu lanche camada por camada em 3D com física real.
          </p>
        </div>

        {/* Live Status Pill & Replay */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-carvao-leve border border-carvao-borda text-xs text-osso font-medium flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-macarico animate-pulse" />
            <span>{status}</span>
          </div>

          <button
            type="button"
            onClick={() => setReplay((r) => r + 1)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-osso text-xs font-bold border border-white/10 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-ouro" />
            <span>Ver montagem de novo</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 3D Canvas + Interactive Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: 3D Kitchen Canvas with Physics */}
        <div className="lg:col-span-7 w-full">
          <KitchenCanvas
            selection={selection}
            replayKey={replay}
            onStatus={setStatus}
          />
        </div>

        {/* Right: Choices & Steps Panel */}
        <div className="lg:col-span-5 bg-carvao-leve border border-carvao-borda rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h3 className="font-display text-2xl uppercase tracking-wide text-osso">
              O que vai no seu?
            </h3>
            <p className="text-xs text-osso-muted">
              Escolha o recheio e personalize as pastas à vontade.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-carvao-borda pb-4">
            {(["Pão", "Recheio", "Pastas & queijo"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  tab === t
                    ? "bg-macarico text-white shadow-macarico-glow"
                    : "bg-carvao text-osso-muted hover:text-osso border border-carvao-borda"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab 1: Pão */}
          {tab === "Pão" && (
            <div className="space-y-4">
              <p className="text-xs text-osso-muted">
                Nosso pão especial artesanal é o ponto central de toda receita.
              </p>
              <div className="p-4 rounded-2xl bg-carvao border border-carvao-borda flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-ouro/10 border border-ouro/30 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-ouro" />
                </div>
                <div>
                  <h4 className="font-display text-base uppercase text-osso">
                    Pão Artesanal Especial
                  </h4>
                  <p className="text-xs text-osso-muted">
                    Crosta dourada e crocante, selada com manteiga de alho e miolo macio.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Recheio */}
          {tab === "Recheio" && (
            <div className="space-y-3">
              <p className="text-xs text-osso-muted">
                Escolha o recheio principal. O chef coloca na hora:
              </p>
              <div className="space-y-2.5">
                {fillings.map((f) => {
                  const isSelected = filling === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setFilling(f.id)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "bg-macarico/15 border-macarico text-osso shadow-md"
                          : "bg-carvao border-carvao-borda text-osso-muted hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black flex-shrink-0">
                          <Image
                            src={f.image}
                            alt={f.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="font-display text-sm uppercase text-osso">
                            {f.name}
                          </h4>
                          <p className="text-[11px] text-osso-muted line-clamp-1">
                            {f.detail}
                          </p>
                        </div>
                      </div>
                      <span className="font-sans font-bold text-sm text-ouro tabular-nums">
                        R$ {f.price.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Pastas & Queijo */}
          {tab === "Pastas & queijo" && (
            <div className="space-y-3">
              <p className="text-xs text-osso-muted">
                Ingredientes tradicionais inclusos (clique para remover se desejar):
              </p>
              <div className="space-y-2.5">
                {toppings.map((top) => {
                  const isChecked = extras.includes(top.root);
                  return (
                    <div
                      key={top.root}
                      onClick={() => toggleExtra(top.root)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? "bg-queijo/10 border-queijo/50 text-osso"
                          : "bg-carvao border-carvao-borda text-osso-muted/60 opacity-60"
                      }`}
                    >
                      <div>
                        <h4 className="font-display text-sm uppercase text-osso">
                          {top.name}
                        </h4>
                        <p className="text-[11px] text-osso-muted">
                          {top.detail}
                        </p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                          isChecked
                            ? "bg-queijo border-queijo text-black font-bold"
                            : "border-carvao-borda bg-carvao"
                        }`}
                      >
                        {isChecked && <Check className="w-4 h-4" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary & Add to Cart */}
          <div className="pt-4 border-t border-carvao-borda flex items-center justify-between gap-4">
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-osso-muted">
                Total do Lanche
              </span>
              <span className="font-sans font-bold text-2xl text-ouro tabular-nums">
                R$ {selectedFilling.price.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <button
              onClick={handleAddToCart}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-macarico hover:bg-macarico-glow text-white font-bold text-sm shadow-macarico-glow active:scale-[0.98] transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Colocar na Sacola</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
