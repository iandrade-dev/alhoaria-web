export default function Bancada() {
  return (
    <section id="bancada" className="scroll-mt-[var(--header-height)] bg-creme px-5 py-16 text-carvao sm:px-10 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <p className="mb-3 font-hand text-3xl text-madeira">Feito na hora</p>
        <h2 className="font-display text-5xl uppercase leading-none sm:text-7xl">Monte o seu</h2>
        <div className="mt-8 flex aspect-[4/5] items-center justify-center border-2 border-dashed border-madeira/40 bg-[#f1e6cf] p-6 text-center sm:aspect-video">
          <p className="font-display text-3xl uppercase text-madeira sm:text-5xl">A bancada chega aqui.</p>
        </div>
      </div>
    </section>
  );
}
