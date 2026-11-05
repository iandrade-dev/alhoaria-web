// Tela de carregamento da cena 3D: foto do lanche escurecida, chapa acendendo e barra de progresso.
export default function Carregando({ foto, progresso }: { foto: string; progresso?: number }) {
  const pct = progresso === undefined ? undefined : Math.round(progresso);
  return <div role="status" aria-live="polite" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#120d0b]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={foto} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-[6px]" />
    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,106,26,.16),rgba(18,13,11,.92)_70%)]" />
    <div aria-hidden="true" className="relative h-12 w-12">
      <span className="absolute inset-0 rounded-full border-[3px] border-[#fff8e7]/15" />
      <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#ff6a1a] motion-reduce:animate-none" />
      <span className="absolute inset-[14px] animate-pulse rounded-full bg-[#ff6a1a]/80 motion-reduce:animate-none" />
    </div>
    <p className="relative font-hand text-2xl leading-none text-[#fff8e7]">Acendendo a chapa…</p>
    <div aria-hidden="true" className="relative h-1 w-36 overflow-hidden rounded-full bg-[#fff8e7]/15">
      <span className={`absolute inset-y-0 left-0 rounded-full bg-[#ff6a1a] transition-[width] duration-300 ${pct === undefined ? "w-1/3 animate-pulse" : ""}`} style={pct === undefined ? undefined : { width: `${Math.max(8, pct)}%` }} />
    </div>
    <span className="sr-only">Carregando a cena 3D{pct === undefined ? "" : `, ${pct}%`}</span>
  </div>;
}
