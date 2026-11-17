import { restaurante } from "@/data/restaurante";

export default function Unidades() {
  const locations = restaurante.unidades.filter((unit) => !unit.is_coming_soon);
  const comingSoon = restaurante.unidades.find((unit) => unit.is_coming_soon);
  return (
    <section id="unidades" className="scroll-mt-[var(--header-height)] bg-carvao px-5 py-16 text-osso sm:px-10 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <p className="mb-3 font-hand text-3xl text-macarico">Por aqui</p>
        <h2 className="font-display text-5xl uppercase sm:text-7xl">Nossas unidades</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {locations.map((unit) => (
            <article key={unit.id} className="flex flex-col justify-between rounded-xl border border-carvao-borda bg-carvao-leve p-6">
              <div>
                <h3 className="font-display text-3xl uppercase">{unit.name}</h3>
                <p className="mt-4 leading-6 text-osso-muted">{unit.address}</p>
                {"hours" in unit && unit.hours && <p className="mt-3 text-sm">{unit.hours}</p>}
                {"phone" in unit && unit.phone && <p className="mt-1.5 text-sm text-osso-muted tabular-nums">{unit.phone}</p>}
              </div>
              <a href={unit.maps_url} target="_blank" rel="noreferrer" className="group mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded border border-macarico px-4 font-semibold text-macarico transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso">Como chegar <span aria-hidden="true" className="inline-block transition-transform duration-150 group-hover:translate-x-[3px] group-focus-visible:translate-x-[3px]">→</span></a>
            </article>
          ))}
          {comingSoon && <article className="flex min-h-56 flex-col justify-center rounded-xl border border-carvao-borda bg-madeira-escura/60 p-6 text-osso-muted"><p className="text-xs font-bold uppercase tracking-wider text-ouro">Em breve</p><h3 className="mt-2 font-display text-3xl uppercase text-osso">{comingSoon.name}</h3><p className="mt-3 text-sm leading-6">Próxima unidade em abertura.</p></article>}
        </div>
      </div>
    </section>
  );
}
