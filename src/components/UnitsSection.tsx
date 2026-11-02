"use client";

import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import menuData from "@/data/menu.json";
import { getOpeningStatus } from "@/lib/opening-hours";
import { unitShortName } from "@/lib/order-message";

export default function UnitsSection() {
  const [statusLabel, setStatusLabel] = useState("Seg a sáb · 18:30 às 00:00");
  const [isOpenNow, setIsOpenNow] = useState(false);

  useEffect(() => {
    const check = () => {
      const status = getOpeningStatus();
      setIsOpenNow(status.open);
      setStatusLabel(status.label);
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="unidades" className="border-t border-carvao-borda">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-display text-3xl uppercase tracking-wide text-osso sm:text-4xl">
          Nossas unidades
        </h2>
        <p className="mt-2 max-w-xl text-sm text-osso-muted sm:text-base">
          Retira no balcão ou pede pra chegar quente em casa.
        </p>

        <ul className="mt-8 divide-y divide-carvao-borda border-y border-carvao-borda">
          {menuData.units.map((unit) => {
            if ("is_coming_soon" in unit && unit.is_coming_soon) {
              return (
                <li key={unit.id} className="py-6">
                  <h3 className="font-display text-2xl uppercase tracking-wide text-osso">
                    {unitShortName(unit.name)}: em breve
                  </h3>
                  {"teaser" in unit && unit.teaser && (
                    <p className="mt-2 max-w-xl text-sm text-osso-muted">{unit.teaser}</p>
                  )}
                  <a
                    href={`https://wa.me/${menuData.brand.whatsapp_default}?text=${encodeURIComponent(
                      "Oi, Alhoaria! Quero saber quando a unidade Praia de Fora abre."
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center rounded border border-carvao-borda bg-carvao-leve px-4 text-sm font-semibold text-osso"
                  >
                    Me avise na abertura
                  </a>
                </li>
              );
            }

            return (
              <li key={unit.id} className="grid gap-3 py-6 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h3 className="font-display text-2xl uppercase tracking-wide text-osso">
                    {unitShortName(unit.name)}
                  </h3>
                  <p className={`mt-1 text-sm font-semibold ${isOpenNow ? "text-ouro" : "text-osso"}`}>
                    {statusLabel}
                  </p>
                  {"address" in unit && unit.address && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-osso-muted">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-osso-muted" aria-hidden />
                      <span>{unit.address}</span>
                    </p>
                  )}
                  {"hours" in unit && unit.hours && (
                    <p className="mt-1 text-sm text-osso-muted">{unit.hours}</p>
                  )}
                  {"phone" in unit && unit.phone && (
                    <p className="mt-1 text-sm text-osso-muted">{unit.phone}</p>
                  )}
                </div>
                {"maps_url" in unit && unit.maps_url && (
                  <a
                    href={unit.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-osso"
                  >
                    Como chegar
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
