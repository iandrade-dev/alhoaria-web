import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Flame, ArrowRight, Sparkles, Utensils, MessageCircle } from "lucide-react";
import Hero3D from "@/components/Hero3D";
import MenuSection from "@/components/MenuSection";
import LohnSection from "@/components/LohnSection";
import UnitsSection from "@/components/UnitsSection";
import menuData from "@/data/menu.json";

export default function Home() {
  const combos = menuData.items.filter((item) => item.category === "combos");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Text & CTA */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-ouro backdrop-blur-md">
              <Flame className="w-3.5 h-3.5 text-macarico" />
              <span>O Verdadeiro Pão de Alho Recheado</span>
            </div>

            <h1 className="font-display text-4xl sm:text-6xl xl:text-7xl uppercase tracking-tight text-osso leading-[0.95]">
              Lanche bom é no{" "}
              <span className="text-macarico underline decoration-ouro/40 underline-offset-8">
                Pão de Alho.
              </span>{" "}
              O resto é pão.
            </h1>

            <p className="text-base sm:text-lg text-osso-muted leading-relaxed max-w-xl mx-auto lg:mx-0">
              Pão especial crocante, pasta de alho exclusiva, creme de queijo artesanal e muito queijo gratinado com o fogo do maçarico na sua frente.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#cardapio"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-macarico hover:bg-macarico-glow text-white font-bold text-base transition-all shadow-macarico-glow active:scale-95"
              >
                <Utensils className="w-5 h-5" />
                <span>Ver Cardápio</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href={`https://wa.me/${menuData.brand.whatsapp_default}?text=${encodeURIComponent(
                  "Oi, Alhoaria! Quero pedir pelo WhatsApp 🧄"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-osso font-semibold text-base border border-white/15 transition-all text-center"
              >
                <MessageCircle className="w-5 h-5 text-macarico" />
                <span>Pedir no WhatsApp</span>
              </a>
            </div>

            {/* Micro Highlights */}
            <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-xs text-osso-muted font-medium border-t border-carvao-borda/60">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ouro" />
                <span>Costela Cozida 6 Horas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-macarico" />
                <span>Queijo Maçaricado</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-queijo" />
                <span>Chopp Lohn</span>
              </div>
            </div>
          </div>

          {/* Right 3D Interactive Hero */}
          <div className="lg:col-span-6 w-full flex justify-center">
            <Hero3D />
          </div>
        </div>
      </section>

      {/* Featured Combos Ribbon */}
      <section className="py-12 bg-[#120d09] border-y border-carvao-borda">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-ouro">
                Combos do Chef
              </span>
              <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-osso">
                Peça com Acompanhamento e Bebida
              </h3>
            </div>
            <a
              href="#cardapio"
              className="text-xs font-bold uppercase tracking-wider text-macarico hover:underline hidden sm:inline-flex items-center gap-1"
            >
              Ver todos os combos <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {combos.slice(0, 3).map((combo) => (
              <div
                key={combo.id}
                className="bg-carvao border border-carvao-borda rounded-2xl p-4 flex gap-4 items-center hover:border-ouro/30 transition-colors"
              >
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black flex-shrink-0">
                  <Image
                    src={combo.image}
                    alt={combo.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-base uppercase text-osso tracking-wide truncate">
                    {combo.name}
                  </h4>
                  <p className="text-xs text-osso-muted line-clamp-2 mt-0.5">
                    {combo.description}
                  </p>
                  <span className="text-sm font-bold text-ouro mt-1 block tabular-nums">
                    R$ {combo.price.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Interactive Menu */}
      <MenuSection />

      {/* Chopp Lohn Partnership */}
      <LohnSection />

      {/* Units & Opening Hours */}
      <UnitsSection />
    </div>
  );
}
