"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import type { ApiCena, Bus, Modo, Projecao } from "./Cena";
import { PASSOS, type EstacaoId, type Passo } from "./layout";

const Cena = dynamic(() => import("./Cena"), { ssr: false });

const ICONE: Record<Passo, string> = { pasta: "pasta", creme: "creme", costela: "costela", tampa: "pao", mussarela: "mussarela", macarico: "macarico" };
const NOME: Record<Passo, string> = { pasta: "Pasta de alho", creme: "Creme de alho", costela: "Costela", tampa: "Tampa", mussarela: "Mussarela", macarico: "Maçarico" };
const DICA: Record<Passo, string> = {
  pasta: "Arraste a bisnaga até o pão",
  creme: "Arraste a colher de creme até o pão",
  costela: "Arraste um punhado de costela até o pão",
  tampa: "Deslize no pão pra fechar a tampa",
  mussarela: "Arraste a mussarela até o lanche",
  macarico: "Arraste o maçarico até o lanche",
};
const FEITO: Record<Passo, string> = {
  pasta: "Pasta de alho no pão", creme: "Creme espalhado", costela: "Costela no lugar", tampa: "Tampa fechada", mussarela: "Mussarela derretendo", macarico: "Gratinado no maçarico",
};
const FOLGA = 56; // px de folga em volta do lanche para soltar a ferramenta

type Toque = { id: Passo; pointer: number; x: number; y: number; moveu: boolean };

export default function Prototipo() {
  const [feitos, setFeitos] = useState(0);
  const [animando, setAnimando] = useState<Passo | null>(null);
  const [auto, setAuto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [proj, setProj] = useState<Projecao | null>(null);
  const [reduzido, setReduzido] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [segurando, setSegurando] = useState<Passo | null>(null);
  const [pop, setPop] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [congelar, setCongelar] = useState<{ id: Passo; t: number } | null>(null);
  const bus = useRef<Bus>({ drag: { ativo: false, id: null, x: 0, y: 0 } });
  const api = useRef<ApiCena | null>(null);
  const toque = useRef<Toque | null>(null);
  const suprimir = useRef(false);
  const autoRef = useRef(false);
  const animRef = useRef<Passo | null>(null);
  const feitosRef = useRef(0);
  const projRef = useRef<Projecao | null>(null);
  feitosRef.current = feitos; projRef.current = proj;

  const aoPronto = useCallback(() => setPronto(true), []);
  const ativo: Passo | null = feitos < PASSOS.length ? PASSOS[feitos] : null;
  const fim = feitos >= PASSOS.length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ver = () => setReduzido(media.matches);
    ver(); media.addEventListener("change", ver);
    const c = new URLSearchParams(window.location.search).get("congelar");
    if (c) { const [id, t] = c.split(":"); if ((PASSOS as readonly string[]).includes(id)) setCongelar({ id: id as Passo, t: Number(t) || 1 }); }
    return () => media.removeEventListener("change", ver);
  }, []);

  const disparar = useCallback((id: Passo, modo: Modo) => {
    if (animRef.current || !api.current) return;
    if (PASSOS[feitosRef.current] !== id) return;
    animRef.current = id;
    setAnimando(id);
    setAnuncio("");
    api.current.acao(id, modo);
  }, []);

  const aoFim = useCallback((id: Passo) => {
    animRef.current = null;
    const i = PASSOS.indexOf(id);
    feitosRef.current = i + 1;
    setFeitos(i + 1);
    setAnimando(null);
    setPop(i);
    setAnuncio(FEITO[id]);
    try { navigator.vibrate?.(12); } catch { /* sem vibração */ }
    const prox = PASSOS[i + 1];
    if (!prox) { autoRef.current = false; setAuto(false); return; }
    if (autoRef.current) setTimeout(() => { if (autoRef.current) disparar(prox, "auto"); }, 350);
  }, [disparar]);

  const montaPraMim = () => {
    if (fim || !ativo) return;
    autoRef.current = true; setAuto(true);
    if (!animRef.current) disparar(ativo, "auto");
  };
  const parar = () => { autoRef.current = false; setAuto(false); };
  const deNovo = () => {
    parar();
    api.current?.reiniciar();
    animRef.current = null; feitosRef.current = 0;
    setAnimando(null); setFeitos(0); setPop(null); setAnuncio("");
  };

  // ---------------------------------------------------- gesto: arrastar a ferramenta até o lanche, ou tocar
  const sobreLanche = (x: number, y: number) => {
    const z = projRef.current?.lanche;
    if (!z) return false;
    return x >= z.x0 - FOLGA && x <= z.x1 + FOLGA && y >= z.y0 - FOLGA && y <= z.y1 + FOLGA;
  };
  const gesto = (id: Passo) => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || animRef.current || !pronto || auto) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      toque.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, moveu: false };
      if (id !== "tampa") { bus.current.drag = { ativo: true, id: id as EstacaoId, x: e.clientX, y: e.clientY }; setSegurando(id); }
    },
    onPointerMove: (e: RPointerEvent<HTMLButtonElement>) => {
      const t = toque.current;
      if (!t || t.pointer !== e.pointerId) return;
      if (!t.moveu && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) t.moveu = true;
      bus.current.drag.x = e.clientX; bus.current.drag.y = e.clientY;
      if (id !== "tampa") { const s = t.moveu && sobreLanche(e.clientX, e.clientY); setSobre((v) => (v === s ? v : s)); }
    },
    onPointerUp: (e: RPointerEvent<HTMLButtonElement>) => {
      const t = toque.current;
      if (!t || t.pointer !== e.pointerId) return;
      toque.current = null;
      bus.current.drag.ativo = false;
      setSegurando(null); setSobre(false);
      suprimir.current = true; setTimeout(() => { suprimir.current = false; }, 0);
      if (id === "tampa") { disparar("tampa", "toque"); return; }
      if (!t.moveu) disparar(id, "toque");
      else if (sobreLanche(e.clientX, e.clientY)) disparar(id, "arraste");
      else api.current?.soltar(id as EstacaoId);
    },
    onPointerCancel: () => {
      const t = toque.current;
      toque.current = null; bus.current.drag.ativo = false; setSegurando(null); setSobre(false);
      if (t && t.id !== "tampa") api.current?.soltar(t.id as EstacaoId);
    },
    onClick: () => { if (!suprimir.current) disparar(id, "toque"); },
  });

  const lan = proj?.lanche;
  const dica = ativo ? DICA[ativo] : "";
  return <div className="fixed inset-0 z-[60] select-none overflow-clip bg-[#120c09] text-[#fff8e7]" style={{ WebkitTouchCallout: "none" }}>
    <style>{`
      @keyframes proto-pop { 0% { transform: scale(1) } 35% { transform: scale(1.42) } 65% { transform: scale(.92) } 100% { transform: scale(1) } }
      @keyframes proto-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(255,150,60,.55) } 50% { box-shadow: 0 0 0 7px rgba(255,150,60,0) } }
      @keyframes proto-sobe { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
      @media (prefers-reduced-motion: reduce) { .proto-anim { animation: none !important } }
    `}</style>
    <picture>
      <source media="(max-aspect-ratio: 1/1)" srcSet="/assets/bancada/proto/cozinha-retrato.webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/bancada/proto/cozinha-paisagem.webp" alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
    </picture>
    <Cena ativo={animando ? null : ativo} reduzido={reduzido} bus={bus} api={api} aoFim={aoFim} aoProjetar={setProj} aoPronto={aoPronto} congelar={congelar} />

    {/* zona de soltura: acende quando a ferramenta passa sobre o lanche */}
    {lan && segurando && <div aria-hidden="true" className="pointer-events-none absolute rounded-[50%] transition-opacity duration-200"
      style={{ left: lan.x0 - FOLGA / 2, top: lan.y0 - FOLGA / 2, width: lan.x1 - lan.x0 + FOLGA, height: lan.y1 - lan.y0 + FOLGA, opacity: sobre ? 1 : 0.35,
        background: "radial-gradient(closest-side, rgba(255,190,110,.22), rgba(255,150,60,.08) 70%, transparent)" }} />}

    {/* estações: botões acessíveis sobre cada uma (só a ativa responde) */}
    {proj && PASSOS.map((id) => {
      const vez = id === ativo && !animando && !auto && pronto;
      let style: CSSProperties;
      if (id === "tampa") {
        if (!lan) return null;
        style = { left: lan.x0, top: lan.y0, width: lan.x1 - lan.x0, height: lan.y1 - lan.y0, borderRadius: "40%" };
      } else {
        const p = proj.estacoes[id as EstacaoId];
        style = { left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2, borderRadius: "50%" };
      }
      return <button key={id} type="button" data-testid={`estacao-${id}`} disabled={!vez} aria-label={vez ? DICA[id] : NOME[id]}
        className={`absolute touch-none bg-transparent outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#e8b84a] ${vez ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${id === "tampa" ? "z-[1]" : "z-[2]"}`}
        style={style} {...(vez ? gesto(id) : {})} />;
    })}

    {/* topo: trilha + Monta pra mim */}
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-wrap items-start justify-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] min-[700px]:justify-between min-[700px]:px-6 min-[700px]:pt-5">
      <ol data-testid="trilha" aria-label="Camadas" className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#fff8e7]/10 bg-[#120c09]/70 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md min-[700px]:gap-2 min-[700px]:px-3 min-[700px]:py-2">
        {PASSOS.map((id, i) => {
          const estado = i < feitos ? "feito" : i === feitos ? "ativa" : "pendente";
          return <li key={id} data-estado={estado} aria-label={`${NOME[id]}: ${estado === "feito" ? "feito" : estado === "ativa" ? "agora" : "depois"}`}
            className={`relative grid h-10 w-10 place-items-center rounded-full transition-[background-color,opacity] duration-300 min-[700px]:h-11 min-[700px]:w-11 ${estado === "ativa" ? "proto-anim bg-[#ff6a1a]/25 ring-2 ring-[#ff9a4a] [animation:proto-pulso_1.6s_ease-in-out_infinite]" : estado === "feito" ? "bg-[#fff8e7]/10" : "opacity-40 grayscale"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/assets/bancada/icones/${ICONE[id]}.webp`} alt="" draggable={false}
              className={`h-8 w-8 object-contain min-[700px]:h-9 min-[700px]:w-9 ${pop === i ? "proto-anim [animation:proto-pop_.5s_cubic-bezier(.3,1.6,.5,1)]" : ""}`} />
            {estado === "feito" && <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#e8b84a] text-[10px] font-black text-[#120c09] ${pop === i ? "proto-anim [animation:proto-pop_.5s_cubic-bezier(.3,1.6,.5,1)]" : ""}`}>✓</span>}
          </li>;
        })}
      </ol>
      {!fim && <button type="button" data-testid="monta-pra-mim" onClick={auto ? parar : montaPraMim} disabled={!pronto}
        className="pointer-events-auto ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-[#fff8e7]/20 bg-[#120c09]/70 px-4 text-sm font-semibold text-[#fff8e7] shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md transition-colors hover:bg-[#241a16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] disabled:opacity-50 min-[700px]:ml-0 min-[700px]:h-11 min-[700px]:px-5">
        {auto ? "Parar" : "Monta pra mim"}
      </button>}
    </div>

    {/* toque em qualquer lugar interrompe o "Monta pra mim" */}
    {auto && <button type="button" aria-label="Parar a montagem automática" onPointerDown={parar} className="absolute inset-0 z-[4] cursor-pointer bg-transparent" />}

    {/* dica da vez */}
    {!fim && pronto && <p key={ativo ?? "x"} className={`proto-anim pointer-events-none absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] z-[5] px-6 text-center font-hand text-[30px] leading-[1.05] text-[#fff8e7] [animation:proto-sobe_.45s_ease-out] [text-shadow:0_2px_14px_rgba(0,0,0,.85)] transition-opacity duration-300 min-[700px]:bottom-8 min-[700px]:text-[38px] ${animando ? "opacity-0" : "opacity-100"}`}>
      {auto ? "Montando pra você… toque pra parar" : dica}
    </p>}

    {/* fim */}
    {fim && !animando && <div data-testid="pronto" role="status"
      className="proto-anim absolute inset-x-4 bottom-[max(18px,env(safe-area-inset-bottom))] z-[6] mx-auto flex max-w-[420px] items-center justify-between gap-4 rounded-2xl bg-[#fff8e7]/95 px-5 py-4 text-[#120c09] shadow-[0_18px_50px_rgba(0,0,0,.5)] [animation:proto-sobe_.5s_cubic-bezier(.2,1.3,.4,1)] min-[700px]:bottom-8">
      <div>
        <p className="whitespace-nowrap font-hand text-[27px] leading-none text-[#c2410c] min-[700px]:text-[32px]">Ficou com capricho!</p>
        <p className="mt-1 text-sm text-[#5c3d2e]">A Costela, montada do seu jeito.</p>
      </div>
      <button type="button" data-testid="montar-de-novo" onClick={deNovo}
        className="shrink-0 rounded-full bg-[#120c09] px-4 py-2.5 text-sm font-semibold text-[#fff8e7] transition-colors hover:bg-[#2a1d18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Montar de novo</button>
    </div>}

    {!pronto && <div className="absolute inset-0 z-[7] grid place-items-center bg-[#120c09]/70 backdrop-blur-sm">
      <p className="font-hand text-3xl text-[#fff8e7]">Acendendo a chapa…</p>
    </div>}
    <p aria-live="polite" className="sr-only">{anuncio}</p>
  </div>;
}
