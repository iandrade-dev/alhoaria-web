"use client";

import React from "react";
import { MapPin, Clock, Phone, Navigation, Sparkles } from "lucide-react";
import menuData from "@/data/menu.json";

export default function UnitsSection() {
  return (
    <section id="unidades" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-carvao-borda">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-ouro mb-3 inline-block">
          Presença Física
        </span>
        <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-wide text-osso mb-3">
          Nossas Unidades
        </h2>
        <p className="text-sm sm:text-base text-osso-muted">
          Passe para retirar no balcão ou peça para entrega quentinha na sua casa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {menuData.units.map((unit) => {
          if (unit.is_coming_soon) {
            return (
              <div
                key={unit.id}
                className="relative bg-gradient-to-b from-carvao-leve to-carvao border border-dashed border-carvao-borda rounded-3xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden"
              >
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-macarico/15 text-macarico border border-macarico/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Em Breve
                    </span>
                  </div>
                  <h3 className="font-display text-2xl uppercase tracking-wide text-osso mb-2">
                    {unit.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-osso-muted leading-relaxed mb-6">
                    {unit.teaser}
                  </p>
                </div>

                <a
                  href={`https://wa.me/${menuData.brand.whatsapp_default}?text=${encodeURIComponent(
                    "Oi, Alhoaria! Quero saber quando a unidade Praia de Fora vai abrir!"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-osso text-xs font-semibold border border-white/10 text-center transition-colors"
                >
                  Me avise na abertura
                </a>
              </div>
            );
          }

          return (
            <div
              key={unit.id}
              className="bg-carvao-leve border border-carvao-borda rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-ouro/40 transition-colors shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Atendimento Ativo
                  </span>
                </div>

                <h3 className="font-display text-2xl uppercase tracking-wide text-osso mb-3">
                  {unit.name}
                </h3>

                <div className="space-y-3 text-xs sm:text-sm text-osso-muted mb-8">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-ouro flex-shrink-0 mt-0.5" />
                    <span>{unit.address}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-queijo flex-shrink-0" />
                    <span>{unit.hours}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-macarico flex-shrink-0" />
                    <span>{unit.phone}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <a
                  href={unit.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-osso text-xs font-bold transition-all"
                >
                  <Navigation className="w-4 h-4 text-ouro" />
                  <span>Como Chegar (Google Maps)</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
