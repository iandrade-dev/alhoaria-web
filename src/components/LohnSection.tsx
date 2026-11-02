"use client";

import menuData from "@/data/menu.json";
import { formatBRL } from "@/lib/money";

export default function LohnSection() {
  const lohnItems = menuData.items.filter((item) => item.category === "lohn");

  return (
    <section id="chopp-lohn" className="border-t border-carvao-borda bg-madeira-escura">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="max-w-2xl font-display text-3xl uppercase leading-tight tracking-wide text-osso sm:text-5xl">
          O melhor sanduíche agora tem o melhor chopp.
        </h2>
        <p className="mt-4 max-w-xl text-sm text-osso-muted sm:text-base">
          Chopp e cerveja Lohn pra acompanhar o pão de alho.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {lohnItems.map((lohn) => (
            <li
              key={lohn.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-carvao-borda bg-carvao p-4"
            >
              <div>
                <h3 className="font-display text-sm uppercase tracking-wide text-osso">
                  {lohn.name}
                </h3>
                <p className="mt-1 text-sm text-osso-muted">{lohn.description}</p>
              </div>
              <span className="shrink-0 text-base font-bold tabular-nums text-ouro">
                R$ {formatBRL(lohn.price)}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-osso-muted">
          Aprecie com moderação. Venda e consumo proibidos para menores de 18 anos.
        </p>
      </div>
    </section>
  );
}
