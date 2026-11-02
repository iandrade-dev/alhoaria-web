import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Utensils, Flame } from "lucide-react";
import ChefLiveExperience from "@/components/ChefLiveExperience";
import FeaturedCombos from "@/components/FeaturedCombos";
import LohnSection from "@/components/LohnSection";
import UnitsSection from "@/components/UnitsSection";

export const metadata = {
  title: "Alhoaria — Lanches no Pão de Alho | Palhoça e São José",
  description: "A verdadeira experiência do pão de alho recheado, gratinado no maçarico. Monte ao vivo em 3D e peça direto no WhatsApp.",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-carvao text-osso">
      {/* Interactive 3D Chef Assembly Experience */}
      <ChefLiveExperience />

      {/* Combos em Destaque */}
      <FeaturedCombos />

      {/* Discovery Banner para o Cardápio Tradicional Completo */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-carvao-borda bg-gradient-to-r from-[#170f0a] via-carvao-leve to-[#1a120c] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-black/40">
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ouro">
              <Utensils className="h-3.5 w-3.5" />
              <span>Cardápio Completo da Loja</span>
            </span>
            <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-osso">
              Pizzalho, Dogalho, Mac Cheese & Porções
            </h3>
            <p className="max-w-xl text-xs sm:text-sm text-osso-muted leading-relaxed">
              Além dos sanduíches montados na bancada, temos pizzas no pão de alho, burgers artesanais,
              dadinhos de tapioca e nosso Mac Cheese monte-o-seu.
            </p>
          </div>

          <Link
            href="/cardapio"
            className="shrink-0 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-macarico hover:bg-[#ff7a2e] px-7 font-bold text-sm text-carvao shadow-lg shadow-macarico/20 active:scale-95 transition-all"
          >
            <span>Ver Cardápio Completo</span>
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </Link>
        </div>
      </section>

      {/* Chopp Lohn Partnership */}
      <LohnSection />

      {/* Units & Opening Hours */}
      <UnitsSection />
    </div>
  );
}
