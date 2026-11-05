import { IcDireita } from "./Icones";
import { ORDEM_LANCHES, RECEITAS, type LancheId } from "./passos";

// Tela A: quatro cartões, um por lanche. Foto em cima no desktop; à esquerda do texto no celular.
export default function Escolha({ aoEscolher, aoPreparar }: { aoEscolher: (id: LancheId) => void; aoPreparar: (id: LancheId) => void }) {
  return <>
    <header className="px-2 pb-3.5 pt-2.5 min-[900px]:mb-4 min-[900px]:p-0 min-[900px]:text-center">
      <h1 className="font-display text-[38px] font-normal uppercase leading-none min-[900px]:text-[46px]">Escolha seu lanche</h1>
      <p className="mt-0.5 font-hand text-2xl leading-[1.15] text-[#5c3d2e]">a gente monta junto, camada por camada</p>
    </header>
    <ul className="grid gap-2.5 min-[900px]:grid-cols-2 min-[900px]:gap-5 min-[1100px]:grid-cols-4">
      {ORDEM_LANCHES.map((id) => {
        const r = RECEITAS[id];
        return <li key={id}>
          <button type="button" data-testid={`lanche-${id}`} onClick={() => aoEscolher(id)} onPointerEnter={() => aoPreparar(id)} onFocus={() => aoPreparar(id)}
            aria-label={`Montar ${r.nome}${r.assinatura ? ` ${r.assinatura}` : ""}`}
            className="group relative isolate block h-[138px] w-full overflow-hidden rounded-[20px] bg-[#1a1210] text-left text-[#fff8e7] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_0_2px_#fff8e7,0_14px_30px_rgba(36,24,22,.35)] focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_#fff8e7,0_0_0_5px_#e8b84a] min-[900px]:h-auto min-[900px]:min-h-[548px] min-[900px]:rounded-3xl">
            <span className="absolute inset-0 -z-20 min-[900px]:bottom-auto min-[900px]:h-[46%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.foto} alt="" loading="lazy" className="h-full w-full object-cover object-[60%_55%] min-[900px]:object-[50%_55%]" />
            </span>
            <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(18,12,10,.94)_0%,rgba(18,12,10,.8)_42%,rgba(18,12,10,0)_82%)] min-[900px]:bg-[linear-gradient(180deg,rgba(26,18,16,0)_24%,#1a1210_45%)]" />
            <span className="absolute inset-y-0 left-0 flex w-[64%] flex-col justify-between py-[13px] pl-4 min-[900px]:inset-x-0 min-[900px]:bottom-0 min-[900px]:top-auto min-[900px]:h-[56%] min-[900px]:w-auto min-[900px]:gap-3 min-[900px]:px-[22px] min-[900px]:pb-[22px] min-[900px]:pt-0">
              <span className="min-[900px]:flex-1">
                <span className="block font-display text-[28px] font-normal uppercase leading-none min-[900px]:text-[31px]">{r.nome}</span>
                <span className="mt-[5px] block text-[12.5px] leading-[1.35] text-[#fff8e7]/70 min-[900px]:mt-2.5 min-[900px]:text-[15px] min-[900px]:leading-[1.45]">{r.desc}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {r.tags.map((t) => <span key={t} className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[.04em] ${t === "Vegetariano" ? "bg-[#78aa5a]/30 text-[#d9f0c4]" : "bg-[#fff8e7]/10 text-[#fff8e7]"}`}>{t}</span>)}
              </span>
              <span aria-hidden="true" className="mt-1.5 hidden items-center justify-between gap-2 border-t border-[#3b2e27] pt-3 text-sm font-bold text-[#fff8e7] min-[900px]:flex">Montar este lanche <IcDireita /></span>
            </span>
          </button>
        </li>;
      })}
    </ul>
    <p className="mx-2 mt-3 text-[12.5px] leading-[1.4] text-[#5b4a40] min-[900px]:mt-[22px] min-[900px]:text-center min-[900px]:text-sm">Receita da casa, uma camada por etapa. Bebida e porção entram depois, na mesa.</p>
  </>;
}
