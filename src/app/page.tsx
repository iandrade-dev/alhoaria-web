import Image from "next/image";
import Hero3D from "@/components/Hero3D";
import SandwichKitchen from "@/components/SandwichKitchen";
import MenuSection from "@/components/MenuSection";
import LohnSection from "@/components/LohnSection";
import UnitsSection from "@/components/UnitsSection";
import FeaturedCombos from "@/components/FeaturedCombos";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <section className="mx-auto w-full max-w-7xl px-4 pb-12 pt-4 sm:px-6 sm:pt-8 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-carvao-borda bg-madeira-escura sm:aspect-square">
            <Image
              src="/assets/posters/alhoaria-costela-hero-w1024.webp"
              alt="Pão de alho da Costela, aberto, com costela desfiada e queijo"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>
          <div className="flex flex-col items-start gap-4 text-left">
            <h1 className="font-display text-5xl uppercase leading-[0.95] tracking-tight text-osso sm:text-6xl">
              Pão de alho.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-osso-muted">
              Costela de 6 horas, queijo no maçarico e chopp Lohn. O resto é pão.
            </p>
            <a
              href="#cardapio"
              className="inline-flex min-h-11 w-full items-center justify-center rounded bg-macarico px-6 text-base font-semibold text-carvao sm:w-auto"
            >
              Montar meu pedido
            </a>
          </div>
        </div>
        <div className="mt-8">
          <Hero3D />
        </div>
      </section>

      <FeaturedCombos />
      <SandwichKitchen />
      <MenuSection />
      <LohnSection />
      <UnitsSection />
    </div>
  );
}
