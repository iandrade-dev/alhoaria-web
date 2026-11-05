import type { Dispatch, HTMLAttributes, ReactNode } from "react";
import { PEDIDO_URL } from "@/lib/links";
import { IcCheck, IcCopiar, IcDesfazer, IcDireita, IcEsquerda, IcExterno, IcLimpar, IcMao } from "./Icones";
import { BEBIDAS, PORCOES, etapaAtual, progresso, receitaDe, resolvida, type Acao, type Estado } from "./passos";

const icone = (id: string) => `/assets/bancada/icones/${id}.webp`;

export function Progresso({ estado }: { estado: Estado }) {
  const p = progresso(estado);
  const seg = (i: number) => <span key={i} className={`h-1.5 flex-1 rounded-[3px] ${i < p.indice ? "bg-[#fff8e7]" : i === p.indice ? "bg-[#ff6a1a]" : "bg-[#4a3b33]"}`} />;
  const grupo = (nome: string, on: boolean, filhos: ReactNode, cls: string) => (
    <div className={`flex min-w-0 flex-col gap-[5px] ${cls}`}>
      <div className="flex gap-1">{filhos}</div>
      <small className={`text-[10px] font-bold uppercase leading-none tracking-[.08em] ${on ? "text-[#fff8e7]" : "text-[#fff8e7]/50"}`}>{nome}</small>
    </div>
  );
  return <div role="group" aria-label="Progresso da montagem" className="px-1 pt-0.5 min-[900px]:px-0.5 min-[900px]:pt-1 min-[900px]:[grid-column:2] min-[900px]:[grid-row:1]">
    <p data-testid="progresso" aria-live="polite" className="mb-2 whitespace-nowrap text-xs font-bold uppercase tracking-[.09em] text-[#fff8e7] min-[900px]:text-[13px]">{p.rotulo} <em className="font-semibold not-italic text-[#fff8e7]/70">· {p.detalhe}</em></p>
    <div className={`gap-2.5 ${p.grupo === "final" ? "hidden min-[900px]:flex" : "flex"}`}>
      {grupo("Lanche", p.grupo === "lanche", Array.from({ length: p.etapas }, (_, i) => seg(i)), "flex-1 basis-0")}
      {grupo("Bebida", p.grupo === "bebida", seg(p.etapas), "flex-none basis-[52px]")}
      {grupo("Porção", p.grupo === "porcao", seg(p.etapas + 1), "flex-none basis-[52px]")}
    </div>
  </div>;
}

type Cartao = { icone: string; nome: string; sub: string; selecionado?: boolean; largo?: boolean; testid: string; rotulo: string; dica?: boolean; desativado?: boolean } & Omit<HTMLAttributes<HTMLButtonElement>, "children">;
function Cartao({ icone: ic, nome, sub, selecionado, largo, testid, rotulo, dica, desativado, className = "", ...resto }: Cartao) {
  const geral = "relative flex touch-none select-none rounded-2xl border text-[#fff8e7] transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a] disabled:cursor-default";
  const estado = selecionado ? "translate-y-px border-[#fff8e7] bg-[#352820] shadow-[0_0_0_2px_#fff8e7]" : "border-[#3b2e27] bg-[#2e221c] hover:-translate-y-0.5 hover:border-[#fff8e7]/50";
  const forma = largo ? "flex-row items-center gap-3.5 p-3 pr-4 text-left" : "flex-col items-center gap-1.5 px-1.5 pb-2.5 pt-3 text-center min-h-[128px] min-[900px]:min-h-[164px] min-[900px]:px-2 min-[900px]:pb-3 min-[900px]:pt-3.5";
  return <button type="button" data-testid={testid} aria-label={rotulo} aria-pressed={selecionado} disabled={desativado} className={`${geral} ${estado} ${forma} ${className}`} {...resto}>
    {selecionado && <span aria-hidden="true" className={`absolute top-[7px] grid h-5 w-5 place-items-center rounded-full bg-[#fff8e7] text-[#0a0a0a] ${largo ? "left-[7px]" : "right-[7px]"}`}><IcCheck /></span>}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={icone(ic)} alt="" draggable={false} className={`flex-none object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,.45)] ${largo ? "h-[76px] w-[76px] min-[900px]:h-[84px] min-[900px]:w-[84px]" : "h-16 w-16 min-[900px]:h-[88px] min-[900px]:w-[88px]"}`} />
    <span className={`block min-w-0 ${largo ? "flex-1" : ""}`}>
      <span className={`block font-semibold leading-[1.2] ${largo ? "text-base" : "text-[13px] min-[900px]:text-sm"}`}>{nome}</span>
      <span className={`block leading-[1.25] text-[#fff8e7]/60 ${largo ? "mt-0.5 text-[13px]" : "-mt-0.5 text-[11px]"}`}>{sub}</span>
    </span>
    {dica && !selecionado && <span aria-hidden="true" className="flex flex-none items-center gap-1.5 whitespace-nowrap text-xs font-bold opacity-80"><IcMao /> Tocar</span>}
  </button>;
}

const btnTexto = "inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-[#fff8e7]/85 transition-colors hover:bg-[#fff8e7]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

function Ajuste({ estado, enviar, podeDesfazer }: { estado: Estado; enviar: Dispatch<Acao>; podeDesfazer: boolean }) {
  const ocupado = !!estado.animando;
  const podeLimpar = estado.tela === "montar" ? estado.colocados.length + estado.pulados.length > 0 : estado.bebida !== null || estado.porcao !== null;
  return <div className="-mb-0.5 -ml-2 -mt-1 flex items-center gap-1">
    <button type="button" data-testid="desfazer" disabled={ocupado || !podeDesfazer} onClick={() => enviar({ type: "desfazer" })} className={btnTexto}><IcDesfazer />Desfazer</button>
    <button type="button" data-testid="limpar" disabled={ocupado || !podeLimpar} onClick={() => enviar({ type: "limpar" })} className={btnTexto}><IcLimpar />Limpar</button>
  </div>;
}

function Navegacao({ estado, enviar, proximo, legenda }: { estado: Estado; enviar: Dispatch<Acao>; proximo: string; legenda: string }) {
  const ok = resolvida(estado) && !estado.animando;
  return <>
    <div className="flex gap-2.5">
      <button type="button" data-testid="voltar" disabled={!!estado.animando} onClick={() => enviar({ type: "voltar" })}
        className="inline-flex min-h-12 w-[108px] max-[420px]:w-24 flex-none items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#ff6a1a]/75 px-3 text-base font-bold text-[#ff9a5c] transition hover:bg-[#ff6a1a]/10 active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] disabled:opacity-50"><IcEsquerda />Voltar</button>
      <button type="button" data-testid="proximo" disabled={!ok} onClick={() => enviar({ type: "proximo" })}
        className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#ff6a1a] px-[18px] max-[420px]:px-3 text-base max-[420px]:text-sm font-bold text-[#1a1210] transition hover:bg-[#ff7a33] active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] disabled:cursor-not-allowed disabled:bg-[#4a3b33] disabled:text-[#fff8e7]/50 disabled:hover:bg-[#4a3b33]">Próximo: {proximo}<span className="max-[420px]:hidden"><IcDireita /></span></button>
    </div>
    <p className="-mt-1 min-h-[15px] text-center text-xs text-[#fff8e7]/55">{ok ? "" : legenda}</p>
  </>;
}

type Arrasto = { ativo: boolean; props: Pick<HTMLAttributes<HTMLButtonElement>, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onClick"> };

export function PainelMontar({ estado, enviar, arrasto, pronto }: { estado: Estado; enviar: Dispatch<Acao>; arrasto: Arrasto; pronto: boolean }) {
  const r = receitaDe(estado)!;
  const etapa = etapaAtual(estado)!;
  const colocado = estado.colocados.includes(etapa.id);
  const ultima = estado.passo === r.etapas.length - 1;
  const proximo = ultima ? "Bebida" : r.etapas[estado.passo + 1].nome;
  const listadas = r.etapas.filter((e, i) => estado.colocados.includes(e.id) || i === estado.passo);
  return <>
    <div>
      {etapa.opcional && <span className="mb-1 block text-[11px] font-bold uppercase tracking-[.07em] text-[#e8b84a]">Opcional</span>}
      <h2 className="font-hand text-[28px] font-normal leading-[1.05] text-[#fff8e7] min-[900px]:text-[32px]">{etapa.pede}</h2>
      <div className="mt-1 flex min-h-6 items-center justify-between gap-2.5">
        <p className="text-sm leading-[1.3] text-[#fff8e7]/70">{etapa.dica}</p>
        {etapa.opcional && !colocado && <button type="button" data-testid="pular" disabled={!!estado.animando} onClick={() => enviar({ type: "pular" })}
          className="-my-2.5 -mr-1 inline-flex min-h-11 items-center whitespace-nowrap px-1 text-sm font-semibold text-[#fff8e7] underline decoration-[#fff8e7]/55 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] disabled:opacity-50">Pular esta etapa</button>}
      </div>
    </div>
    <Cartao largo icone={etapa.id} nome={etapa.opcao.nome} sub={etapa.opcao.sub} selecionado={colocado} testid={`camada-${etapa.id}`}
      rotulo={colocado ? `${etapa.opcao.nome}: já está na tábua` : `${etapa.opcao.nome}: toque ou arraste até a tábua`} dica desativado={!pronto || !!estado.animando}
      className={`${arrasto.ativo ? "opacity-60" : ""} cursor-grab`} {...arrasto.props} />
    <section aria-label="Camadas na tábua" className="hidden min-[900px]:block">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-[#fff8e7]/55">{r.lista}</h3>
      <ol className="flex flex-col gap-1">
        {listadas.map((e) => {
          const feito = estado.colocados.includes(e.id);
          return <li key={e.id} className={`flex min-h-7 items-center gap-2.5 text-sm ${feito ? "text-[#fff8e7]" : "font-semibold text-[#e8b84a]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icone(e.id)} alt="" className="h-7 w-7 object-contain" />
            <span>{e.opcao.nome}</span>
            <span aria-label={feito ? "colocado" : "da vez"} className={`ml-auto grid h-[18px] w-[18px] place-items-center rounded-full ${feito ? "bg-[#fff8e7]/15 text-[#fff8e7]" : "border-[1.5px] border-dashed border-[#e8b84a]"}`}>{feito && <IcCheck t={11} />}</span>
          </li>;
        })}
      </ol>
    </section>
    <div className="flex-1" />
    <Ajuste estado={estado} enviar={enviar} podeDesfazer={estado.colocados.length > 0} />
    <Navegacao estado={estado} enviar={enviar} proximo={proximo} legenda={!pronto ? "Preparando a bancada…" : etapa.opcional ? "Coloque a camada ou pule a etapa" : "Escolha uma opção para continuar"} />
  </>;
}

export function PainelCombo({ estado, enviar }: { estado: Estado; enviar: Dispatch<Acao> }) {
  const beb = estado.tela === "bebida";
  const lista = beb ? BEBIDAS : PORCOES;
  const sel = beb ? estado.bebida : estado.porcao;
  return <>
    <div>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[.07em] text-[#e8b84a]">Opcional</span>
      <h2 className="font-hand text-[28px] font-normal leading-[1.05] text-[#fff8e7] min-[900px]:text-[32px]">{beb ? "Quer uma bebida?" : "Quer uma porção?"}</h2>
      <div className="mt-1 flex min-h-6 items-center justify-between gap-2.5">
        <p className="text-sm leading-[1.3] text-[#fff8e7]/70">{beb ? "Ela aparece na mesa, ao lado da tábua." : "Entra na mesa com uma quedinha."}</p>
        <button type="button" data-testid={beb ? "sem-bebida" : "sem-porcao"} disabled={!!estado.animando} onClick={() => enviar({ type: "pular" })}
          className="-my-2.5 -mr-1 inline-flex min-h-11 items-center whitespace-nowrap px-1 text-sm font-semibold text-[#fff8e7] underline decoration-[#fff8e7]/55 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a]">{beb ? "Sem bebida" : "Sem porção"}</button>
      </div>
    </div>
    <div role="group" aria-label={beb ? "Bebidas" : "Porções"} className={`grid gap-2 ${beb ? "grid-cols-3" : "grid-cols-2"}`}>
      {lista.map((o) => <Cartao key={o.id} icone={o.icone} nome={o.nome} sub={o.sub} selecionado={sel === o.id} testid={`${beb ? "bebida" : "porcao"}-${o.id}`} rotulo={`${o.nome}, ${o.sub}`}
        onClick={() => enviar(beb ? { type: "bebida", id: o.id as never } : { type: "porcao", id: o.id as never })} />)}
    </div>
    <div className="flex-1" />
    <Ajuste estado={estado} enviar={enviar} podeDesfazer={sel !== null} />
    <Navegacao estado={estado} enviar={enviar} proximo={beb ? "Porção" : "Sacola"} legenda="Escolha uma opção ou siga sem" />
  </>;
}

export function PainelFinal({ estado, enviar, copia, aoCopiar, textoManual }: { estado: Estado; enviar: Dispatch<Acao>; copia: "idle" | "ok" | "manual"; aoCopiar: () => void; textoManual: string }) {
  const r = receitaDe(estado)!;
  const beb = BEBIDAS.find((b) => b.id === estado.bebida);
  const por = PORCOES.find((p) => p.id === estado.porcao);
  const receita = r.etapas.filter((e) => estado.colocados.includes(e.id)).map((e) => e.opcao.nome.toLowerCase()).join(", ");
  return <>
    <div>
      <h2 className="font-display text-[32px] font-normal uppercase leading-none text-[#fff8e7] min-[900px]:text-[42px]">{r.nome.replace(/!$/, "")}!</h2>
      <p className="mt-[3px] font-hand text-[22px] leading-[1.1] text-[#e8b84a] min-[900px]:text-[26px]">pronto pra viagem, do jeito da casa</p>
    </div>
    <dl data-testid="resumo" className="m-0 grid grid-cols-[78px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-y border-[#3b2e27] py-2.5 text-[13.5px] leading-[1.35] min-[900px]:grid-cols-[90px_minmax(0,1fr)] min-[900px]:gap-y-2 min-[900px]:py-3 min-[900px]:text-[15px]">
      <dt className="font-medium text-[#fff8e7]/60">Lanche</dt>
      <dd className="m-0 font-semibold text-[#fff8e7]">{r.nome}{r.assinatura ? ` ${r.assinatura}` : ""}<span className="block text-xs font-normal text-[#fff8e7]/70 min-[900px]:text-[13px]">{receita}</span></dd>
      <dt className="font-medium text-[#fff8e7]/60">Bebida</dt>
      <dd className="m-0 font-semibold text-[#fff8e7]">{beb ? beb.nome : "sem bebida"}</dd>
      <dt className="font-medium text-[#fff8e7]/60">Porção</dt>
      <dd className="m-0 font-semibold text-[#fff8e7]">{por ? por.nome : "sem porção"}</dd>
    </dl>
    <div className="flex-1" />
    <div className="flex flex-col gap-2">
      <a data-testid="peca-agora" href={PEDIDO_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#ff6a1a] px-[18px] text-[17px] font-bold text-[#1a1210] transition hover:bg-[#ff7a33] active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a] min-[900px]:min-h-[52px]">Peça agora<IcExterno /><span className="sr-only"> (abre o Anota Aí em nova aba)</span></a>
      <button type="button" data-testid="copiar-pedido" onClick={aoCopiar}
        className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#fff8e7]/40 px-[18px] text-base font-bold text-[#fff8e7] transition hover:bg-[#fff8e7]/10 active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] min-[900px]:min-h-12">
        {copia === "ok" ? <><IcCheck t={18} />Copiado!</> : <><IcCopiar />Copiar pedido</>}</button>
      {copia === "manual" && <textarea readOnly aria-label="Texto do pedido para copiar" value={textoManual} rows={5} onFocus={(e) => e.currentTarget.select()} className="w-full resize-none rounded-xl border border-[#3b2e27] bg-[#1a1210] p-3 text-[13px] text-[#fff8e7]" />}
    </div>
    <div className="-mx-2 -my-1 flex items-center justify-between">
      <button type="button" data-testid="mudar-algo" onClick={() => enviar({ type: "voltar" })} className={btnTexto}><IcEsquerda />Mudar algo</button>
      <button type="button" data-testid="montar-outro" onClick={() => enviar({ type: "montarOutro" })} className={btnTexto}>Montar outro</button>
    </div>
    <p className="m-0 text-center text-xs leading-[1.4] text-[#fff8e7]/55 max-[899px]:hidden">{copia === "manual" ? "Selecione o texto e copie para colar na observação." : "O pedido de verdade é feito no Anota Aí. Cole o texto copiado na observação."}</p>
  </>;
}
