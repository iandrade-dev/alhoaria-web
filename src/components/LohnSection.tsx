"use client";

import React from "react";
import Image from "next/image";
import { Beer, ShieldAlert } from "lucide-react";
import menuData from "@/data/menu.json";

export default function LohnSection() {
  const lohnItems = menuData.items.filter((item) => item.category === "lohn");

  return (
    <section id="chopp-lohn" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-carvao-borda">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-madeira-escura via-carvao-leve to-carvao border border-carvao-borda p-8 sm:p-12 lg:p-16">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-ouro/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-ouro/15 border border-ouro/30 text-ouro text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Beer className="w-3.5 h-3.5" />
              Parceria Oficial
            </span>
          </div>

          <h2 className="font-display text-3xl sm:text-5xl uppercase tracking-wide text-osso mb-4 leading-tight">
            O melhor sanduíche agora tem o melhor chopp.
          </h2>

          <p className="text-sm sm:text-base text-osso-muted leading-relaxed mb-8">
            Direto das torneiras de Santa Catarina para a sua mesa. O chopp artesanal Lohn é puro malte, fresco e servido trincando de gelado para harmonizar perfeitamente com a crosta tostada do pão de alho.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {lohnItems.map((lohn) => (
              <div
                key={lohn.id}
                className="bg-carvao/80 border border-white/10 rounded-2xl p-4 flex items-center justify-between backdrop-blur-sm"
              >
                <div>
                  <h4 className="font-display text-sm uppercase text-osso tracking-wide">
                    {lohn.name}
                  </h4>
                  <p className="text-xs text-osso-muted line-clamp-1">{lohn.description}</p>
                </div>
                <span className="font-sans font-bold text-base text-ouro tabular-nums">
                  R$ {lohn.price.toFixed(2).replace(".", ",")}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-osso-muted/80">
            <ShieldAlert className="w-4 h-4 text-ouro flex-shrink-0" />
            <span>Aprecie com moderação. Venda e consumo proibidos para menores de 18 anos.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
