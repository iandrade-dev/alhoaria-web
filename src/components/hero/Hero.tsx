import { PEDIDO_URL } from "@/lib/links";

export default function Hero() {
  return (
    <section id="inicio" className="relative flex min-h-[78vh] scroll-mt-[var(--header-height)] items-center overflow-visible bg-carvao px-5 pb-20 pt-28 sm:min-h-[82vh] sm:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <p className="mb-5 text-sm font-semibold tracking-wide text-ouro">Palhoça · São José · Grande Floripa</p>
        <h1 className="max-w-4xl font-display text-6xl uppercase leading-[0.88] tracking-wide text-osso sm:text-8xl lg:text-[112px]">Lanches no<br />pão de alho</h1>
        <p className="mt-5 font-hand text-4xl text-macarico sm:text-5xl">O resto é pão.</p>
        <p className="mt-4 max-w-lg text-base leading-7 text-osso-muted sm:text-lg">o melhor lanche no pão de alho da Grande Floripa</p>
        <a href="#bancada" className="mt-8 inline-flex min-h-12 items-center rounded bg-macarico px-6 font-bold text-carvao hover:bg-queijo focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso">Monte seu lanche</a>
        <a className="sr-only" href={PEDIDO_URL}>Peça no Anota Aí</a>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-5 w-full bg-creme [clip-path:polygon(0_35%,8%_70%,15%_30%,24%_65%,33%_25%,41%_70%,52%_30%,62%_70%,72%_25%,83%_65%,92%_30%,100%_65%,100%_100%,0_100%)]" />
    </section>
  );
}
