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
            <article key={unit.id} className="border border-carvao-borda bg-carvao-leve p-6">
              <h3 className="font-display text-3xl uppercase">{unit.name}</h3>
              <p className="mt-4 leading-6 text-osso-muted">{unit.address}</p>
              {"hours" in unit && unit.hours && <p className="mt-3 text-sm">{unit.hours}</p>}
              {"phone" in unit && unit.phone && <p className="mt-2 text-sm">{unit.phone}</p>}
              <a href={unit.maps_url} target="_blank" rel="noreferrer" className="group mt-5 inline-flex min-h-11 items-center gap-2 rounded border border-macarico px-4 font-semibold text-macarico transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso">Como chegar <span aria-hidden="true" className="inline-block transition-transform duration-150 group-hover:translate-x-[3px] group-focus-visible:translate-x-[3px]">→</span></a>
            </article>
          ))}
          {comingSoon && <article className="flex min-h-64 flex-col justify-center border border-dashed border-madeira bg-madeira-escura p-6 text-osso-muted"><h3 className="font-display text-3xl uppercase text-osso">{comingSoon.name}</h3><p className="mt-3">Próxima parada · em breve</p></article>}
        </div>
      </div>
    </section>
  );
}
