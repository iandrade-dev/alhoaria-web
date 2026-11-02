"use client";

import React, { useState } from "react";
import KitchenCanvas from "./KitchenCanvas";
import { useCart } from "@/store/useCart";
import menuData from "@/data/menu.json";
import { formatBRL } from "@/lib/money";
import FoodMedia from "./FoodMedia";

const fillings = [
  {
    id: "costela",
    menuId: "costela",
    root: "filling_costela",
    detail: "Cozida por 6 horas. Desfiada, bem suculenta.",
  },
  {
    id: "frango",
    menuId: "frango",
    root: "filling_frango",
    detail: "Sobrecoxa dourada, macia por dentro.",
  },
  {
    id: "alcatra",
    menuId: "mr-alcatra",
    root: "filling_alcatra",
    detail: "Tiras de alcatra nobre para uma fome caprichada.",
  },
  {
    id: "brocolis",
    menuId: "brocolis-queijo",
    root: "filling_brocolis",
    detail: "Verde, cremoso e vegetariano no alho e azeite.",
  },
  {
    id: "pork",
    menuId: "pulled-pork",
    root: "filling_pork",
    detail: "Pernil de 4 horas. Desmanchando no pão.",
  },
] as const;

const toppings = [
  {
    root: "stage_garlic",
    name: "Pasta de alho da casa",
    detail: "O ponto de partida.",
    without: "pasta de alho",
  },
  {
    root: "stage_cream",
    name: "Creme de queijo",
    detail: "Cremoso, do jeito da casa.",
    without: "creme de queijo",
  },
  {
    root: "stage_gratin",
    name: "Queijo gratinado no maçarico",
    detail: "Dourado no fogo, na sua frente.",
    without: "queijo gratinado",
  },
];

function menuProduct(menuId: string) {
  const item = menuData.items.find((entry) => entry.id === menuId);
  if (!item) throw new Error(`Item ausente no cardápio: ${menuId}`);
  return item;
}

export default function SandwichKitchen() {
  const [tab, setTab] = useState<"Pão" | "Recheio" | "Pastas e queijo">("Recheio");
  const [filling, setFilling] = useState<(typeof fillings)[number]["id"]>("costela");
  const [extras, setExtras] = useState<string[]>([
    "stage_garlic",
    "stage_cream",
    "stage_gratin",
  ]);
  const [replay, setReplay] = useState(0);
  const [status, setStatus] = useState("Escolha o recheio. A gente monta na sua frente.");
  const { addItem } = useCart();

  const selected = fillings.find((entry) => entry.id === filling) ?? fillings[0];
  const product = menuProduct(selected.menuId);

  const selection = [
    "stage_bread",
    ...(extras.includes("stage_garlic") ? ["stage_garlic"] : []),
    selected.root,
    ...extras.filter((extra) => extra !== "stage_garlic"),
  ];

  const toggleExtra = (root: string) => {
    setExtras((current) =>
      current.includes(root) ? current.filter((id) => id !== root) : [...current, root]
    );
  };

  const handleAddToCart = () => {
    const withoutList = toppings
      .filter((topping) => !extras.includes(topping.root))
      .map((topping) => topping.without);

    addItem({
      itemId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity: 1,
      image: product.image,
      notes: withoutList.length ? `sem ${withoutList.join(", ")}` : undefined,
    });
  };

  const tabClass = (active: boolean) =>
    `min-h-11 rounded px-3 text-sm font-semibold ${
      active ? "bg-macarico text-carvao" : "border border-carvao-borda bg-carvao text-osso"
    }`;

  return (
    <section
      id="monte-ao-vivo"
      className="mx-auto max-w-7xl border-t border-carvao-borda px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-wide text-osso sm:text-5xl">
            Monta o teu aí
          </h2>
          <p className="mt-2 max-w-xl text-sm text-osso-muted sm:text-base">
            O chef monta camada por camada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-osso">{status}</p>
          <button
            type="button"
            onClick={() => setReplay((value) => value + 1)}
            className="inline-flex min-h-11 items-center rounded border border-carvao-borda bg-carvao-leve px-4 text-sm font-semibold text-osso"
          >
            Ver de novo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <KitchenCanvas selection={selection} replayKey={replay} onStatus={setStatus} />
        </div>

        <div className="space-y-5 rounded-lg border border-carvao-borda bg-carvao-leve p-4 sm:p-6 lg:col-span-5">
          <div>
            <h3 className="font-display text-2xl uppercase tracking-wide text-osso">
              O que vai no seu?
            </h3>
            <p className="text-sm text-osso-muted">Recheio e pastas, do seu jeito.</p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-carvao-borda pb-4">
            {(["Pão", "Recheio", "Pastas e queijo"] as const).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTab(name)}
                aria-pressed={tab === name}
                className={tabClass(tab === name)}
              >
                {name}
              </button>
            ))}
          </div>

          {tab === "Pão" && (
            <div>
              <h4 className="font-display text-base uppercase text-osso">Pão da casa</h4>
              <p className="mt-1 text-sm text-osso-muted">
                Crosta dourada, selada na manteiga de alho, miolo macio.
              </p>
            </div>
          )}

          {tab === "Recheio" && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-osso-muted">Recheio</legend>
              <div className="space-y-2">
                {fillings.map((entry) => {
                  const menuItem = menuProduct(entry.menuId);
                  const isSelected = filling === entry.id;
                  return (
                    <label
                      key={entry.id}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded border p-2 focus-within:border-osso ${
                        isSelected
                          ? "border-macarico bg-macarico/15"
                          : "border-carvao-borda bg-carvao"
                      }`}
                    >
                      <input
                        type="radio"
                        name="recheio"
                        value={entry.id}
                        checked={isSelected}
                        onChange={() => setFilling(entry.id)}
                        className="sr-only"
                      />
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-madeira-escura">
                          <FoodMedia
                            src={menuItem.image}
                            name={menuItem.name}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-sm uppercase text-osso">
                            {menuItem.name}
                          </span>
                          <span className="block text-sm text-osso-muted">{entry.detail}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ouro">
                        R$ {formatBRL(menuItem.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {tab === "Pastas e queijo" && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-osso-muted">
                Pastas e queijo
              </legend>
              <div className="space-y-2">
                {toppings.map((topping) => {
                  const checked = extras.includes(topping.root);
                  return (
                    <label
                      key={topping.root}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded border p-3 focus-within:border-osso ${
                        checked
                          ? "border-queijo bg-queijo/10"
                          : "border-carvao-borda bg-carvao"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtra(topping.root)}
                        className="sr-only"
                      />
                      <span>
                        <span
                          className={`block font-display text-sm uppercase ${
                            checked ? "text-osso" : "text-osso-muted line-through"
                          }`}
                        >
                          {topping.name}
                        </span>
                        <span className="block text-sm text-osso-muted">{topping.detail}</span>
                      </span>
                      <span
                        aria-hidden
                        className={`h-4 w-4 shrink-0 border ${
                          checked ? "border-queijo bg-queijo" : "border-osso-muted"
                        }`}
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-carvao-borda pt-4">
            <div>
              <span className="block text-sm font-semibold text-osso-muted">Total do lanche</span>
              <span className="text-2xl font-bold tabular-nums text-ouro">
                R$ {formatBRL(product.price)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded bg-macarico px-4 text-sm font-semibold text-carvao"
            >
              Colocar na sacola
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
