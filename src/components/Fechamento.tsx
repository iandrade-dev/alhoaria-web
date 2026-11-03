import { INSTAGRAM_URL, PEDIDO_URL } from "@/lib/links";

export default function Fechamento() {
  return (
    <section className="relative bg-creme px-5 py-20 text-carvao sm:px-10 sm:py-28">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-5 bg-carvao [clip-path:polygon(0_0,100%_0,100%_50%,92%_25%,82%_70%,70%_30%,60%_70%,49%_25%,38%_70%,27%_30%,16%_75%,7%_35%,0_65%)]" />
      <div className="mx-auto max-w-7xl pt-4">
        <h2 className="font-display text-5xl uppercase leading-[0.95] sm:text-8xl">O fogo já tá aceso.</h2>
        <p className="mt-5 text-lg sm:text-2xl">Costela 6 horas. Paciência a gente tem.</p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <a href={PEDIDO_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded bg-macarico px-6 font-bold text-carvao hover:bg-ouro focus-visible:outline focus-visible:outline-2 focus-visible:outline-carvao">Peça no Anota Aí</a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold underline decoration-macarico underline-offset-4 hover:text-madeira focus-visible:outline focus-visible:outline-2 focus-visible:outline-carvao">Instagram @alhoaria</a>
        </div>
      </div>
    </section>
  );
}
