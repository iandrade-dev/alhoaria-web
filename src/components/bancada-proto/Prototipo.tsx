"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import type { ApiCena, Bus, Modo, Projecao } from "./Cena";
import { LANCHES, ORDEM_LANCHES, ehLanche, type LancheDef, type LancheId, type Passo } from "./layout";

const Cena = dynamic(() => import("./Cena"), { ssr: false });

const FOLGA = 56; // px de folga em volta do lanche para soltar a ferramenta

type Toque = { id: Passo; pointer: number; x: number; y: number; moveu: boolean };

export default function Prototipo() {
  // undefined = ainda lendo a URL; null = tela de escolha
  const [lanche, setLanche] = useState<LancheId | null | undefined>(undefined);
  const [feitos, setFeitos] = useState(0);
  const [pulados, setPulados] = useState<readonly Passo[]>([]);
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

  const def: LancheDef | null = lanche ? LANCHES[lanche] : null;
  const PASSOS = def?.passos ?? [];
  const passosRef = useRef(PASSOS); passosRef.current = PASSOS;
  const aoPronto = useCallback(() => setPronto(true), []);
  const ativoDef = feitos < PASSOS.length ? PASSOS[feitos] : null;
  const ativo: Passo | null = ativoDef?.id ?? null;
  const fim = !!def && feitos >= PASSOS.length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ver = () => setReduzido(media.matches);
    ver(); media.addEventListener("change", ver);
    const q = new URLSearchParams(window.location.search);
    const l = q.get("lanche");
    const inicial = ehLanche(l) ? l : null;
    setLanche(inicial);
    const c = q.get("congelar");
    if (c && inicial) { const [id, t] = c.split(":"); if (LANCHES[inicial].passos.some((p) => p.id === id)) setCongelar({ id, t: Number(t) || 1 }); }
    return () => media.removeEventListener("change", ver);
  }, []);

  const disparar = useCallback((id: Passo, modo: Modo) => {
    if (animRef.current || !api.current) return;
    if (passosRef.current[feitosRef.current]?.id !== id) return;
    animRef.current = id;
    setAnimando(id);
    setAnuncio("");
    api.current.acao(id, modo);
  }, []);

  /** Vai para a etapa seguinte (depois de fazer ou pular a etapa `i`). */
  const avancar = useCallback((i: number) => {
    feitosRef.current = i + 1;
    setFeitos(i + 1);
    setPop(i);
    const prox = passosRef.current[i + 1];
    if (!prox) { autoRef.current = false; setAuto(false); return; }
    if (autoRef.current) setTimeout(() => { if (autoRef.current) disparar(prox.id, "auto"); }, 350);
  }, [disparar]);

  const aoFim = useCallback((id: Passo) => {
    animRef.current = null;
    const i = passosRef.current.findIndex((p) => p.id === id);
    setAnimando(null);
    setAnuncio(passosRef.current[i].feito);
    try { navigator.vibrate?.(12); } catch { /* sem vibração */ }
    avancar(i);
  }, [avancar]);

  const montaPraMim = () => {
    if (fim || !ativo) return;
    autoRef.current = true; setAuto(true);
    if (!animRef.current) disparar(ativo, "auto");
  };
  const parar = () => { autoRef.current = false; setAuto(false); };
  const pular = () => {
    if (animRef.current || !ativoDef?.opcional) return;
    setPulados((p) => [...p, ativoDef.id]);
    setAnuncio(`${ativoDef.nome}: pulado`);
    avancar(feitosRef.current);
  };
  const zerarHud = () => {
    parar();
    animRef.current = null; feitosRef.current = 0;
    setAnimando(null); setFeitos(0); setPulados([]); setPop(null); setAnuncio(""); setSegurando(null); setSobre(false);
    bus.current.drag.ativo = false; toque.current = null;
  };
  const deNovo = () => { zerarHud(); api.current?.reiniciar(); };
  const escolher = (id: LancheId | null) => {
    zerarHud();
    setCongelar(null); setProj(null); setPronto(false);
    setLanche(id);
  };

  // ---------------------------------------------------- gesto: arrastar a ferramenta até o lanche, ou tocar
  const sobreLanche = (x: number, y: number) => {
    const z = projRef.current?.lanche;
    if (!z) return false;
    return x >= z.x0 - FOLGA && x <= z.x1 + FOLGA && y >= z.y0 - FOLGA && y <= z.y1 + FOLGA;
  };
  const gesto = (id: Passo, temEstacao: boolean) => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || animRef.current || !pronto || auto) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      toque.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, moveu: false };
      if (temEstacao) { bus.current.drag = { ativo: true, id, x: e.clientX, y: e.clientY }; setSegurando(id); }
    },
    onPointerMove: (e: RPointerEvent<HTMLButtonElement>) => {
      const t = toque.current;
      if (!t || t.pointer !== e.pointerId) return;
      if (!t.moveu && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) t.moveu = true;
      bus.current.drag.x = e.clientX; bus.current.drag.y = e.clientY;
      if (temEstacao) { const s = t.moveu && sobreLanche(e.clientX, e.clientY); setSobre((v) => (v === s ? v : s)); }
    },
    onPointerUp: (e: RPointerEvent<HTMLButtonElement>) => {
      const t = toque.current;
      if (!t || t.pointer !== e.pointerId) return;
      toque.current = null;
      bus.current.drag.ativo = false;
      setSegurando(null); setSobre(false);
      suprimir.current = true; setTimeout(() => { suprimir.current = false; }, 0);
      if (!temEstacao) { disparar(id, "toque"); return; }
      if (!t.moveu) disparar(id, "toque");
      else if (sobreLanche(e.clientX, e.clientY)) disparar(id, "arraste");
      else api.current?.soltar(id);
    },
    onPointerCancel: () => {
      const t = toque.current;
      toque.current = null; bus.current.drag.ativo = false; setSegurando(null); setSobre(false);
      if (t && temEstacao) api.current?.soltar(t.id);
    },
    onClick: () => { if (!suprimir.current) disparar(id, "toque"); },
  });

  const lan = proj?.lanche;
  const dica = ativoDef?.dica ?? "";
  const podePular = !!ativoDef?.opcional && !animando && !auto && pronto;
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
    {lanche !== undefined && <Cena def={def} ativo={animando ? null : ativo} reduzido={reduzido} bus={bus} api={api} aoFim={aoFim} aoProjetar={setProj} aoPronto={aoPronto} congelar={congelar} />}

    {/* escolha do lanche */}
    {lanche === null && <Escolha aoEscolher={escolher} />}

    {def && <>
      {/* zona de soltura: acende quando a ferramenta passa sobre o lanche */}
      {lan && segurando && <div aria-hidden="true" className="pointer-events-none absolute rounded-[50%] transition-opacity duration-200"
        style={{ left: lan.x0 - FOLGA / 2, top: lan.y0 - FOLGA / 2, width: lan.x1 - lan.x0 + FOLGA, height: lan.y1 - lan.y0 + FOLGA, opacity: sobre ? 1 : 0.35,
          background: "radial-gradient(closest-side, rgba(255,190,110,.22), rgba(255,150,60,.08) 70%, transparent)" }} />}

      {/* estações: botões acessíveis sobre cada uma (só a ativa responde) */}
      {proj && PASSOS.map(({ id, dica: d, nome }) => {
        const vez = id === ativo && !animando && !auto && pronto;
        const p = proj.estacoes[id];
        let style: CSSProperties;
        if (!p) {
          if (!lan) return null;
          style = { left: lan.x0, top: lan.y0, width: lan.x1 - lan.x0, height: lan.y1 - lan.y0, borderRadius: "40%" };
        } else {
          style = { left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2, borderRadius: "50%" };
        }
        return <button key={id} type="button" data-testid={`estacao-${id}`} disabled={!vez} aria-label={vez ? d : nome}
          className={`absolute touch-none bg-transparent outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#e8b84a] ${vez ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${p ? "z-[2]" : "z-[1]"}`}
          style={style} {...(vez ? gesto(id, !!p) : {})} />;
      })}

      {/* topo: trilha + Monta pra mim */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-wrap items-start justify-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] min-[700px]:justify-between min-[700px]:px-6 min-[700px]:pt-5">
        <ol data-testid="trilha" aria-label="Camadas" className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#fff8e7]/10 bg-[#120c09]/70 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md min-[700px]:gap-2 min-[700px]:px-3 min-[700px]:py-2">
          {PASSOS.map(({ id, icone, nome }, i) => {
            const pulou = pulados.includes(id);
            const estado = i < feitos ? (pulou ? "pulada" : "feito") : i === feitos ? "ativa" : "pendente";
            const rotulo = estado === "feito" ? "feito" : estado === "pulada" ? "pulado" : estado === "ativa" ? "agora" : "depois";
            return <li key={id} data-estado={estado} aria-label={`${nome}: ${rotulo}`}
              className={`relative grid h-10 w-10 place-items-center rounded-full transition-[background-color,opacity] duration-300 min-[700px]:h-11 min-[700px]:w-11 ${estado === "ativa" ? "proto-anim bg-[#ff6a1a]/25 ring-2 ring-[#ff9a4a] [animation:proto-pulso_1.6s_ease-in-out_infinite]" : estado === "feito" ? "bg-[#fff8e7]/10" : estado === "pulada" ? "opacity-45 grayscale" : "opacity-40 grayscale"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/assets/bancada/icones/${icone}.webp`} alt="" draggable={false}
                className={`h-8 w-8 object-contain min-[700px]:h-9 min-[700px]:w-9 ${pop === i ? "proto-anim [animation:proto-pop_.5s_cubic-bezier(.3,1.6,.5,1)]" : ""}`} />
              {estado === "feito" && <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#e8b84a] text-[10px] font-black text-[#120c09] ${pop === i ? "proto-anim [animation:proto-pop_.5s_cubic-bezier(.3,1.6,.5,1)]" : ""}`}>✓</span>}
              {estado === "pulada" && <span aria-hidden="true" className="absolute left-1.5 right-1.5 top-1/2 h-[2px] -rotate-45 rounded-full bg-[#fff8e7]/80" />}
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

      {/* dica da vez (e "Pular" nas etapas opcionais) */}
      {!fim && pronto && <div key={ativo ?? "x"} className={`proto-anim pointer-events-none absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] z-[5] flex flex-col items-center gap-2 px-6 text-center [animation:proto-sobe_.45s_ease-out] transition-opacity duration-300 min-[700px]:bottom-8 ${animando ? "opacity-0" : "opacity-100"}`}>
        <p className="font-hand text-[30px] leading-[1.05] text-[#fff8e7] [text-shadow:0_2px_14px_rgba(0,0,0,.85)] min-[700px]:text-[38px]">
          {auto ? "Montando pra você… toque pra parar" : dica}
        </p>
        {podePular && <button type="button" data-testid="pular" onClick={pular}
          className="pointer-events-auto rounded-full border border-[#fff8e7]/25 bg-[#120c09]/55 px-4 py-1.5 text-sm font-semibold text-[#fff8e7]/85 backdrop-blur-md transition-colors hover:bg-[#241a16] hover:text-[#fff8e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a]">
          Pular
        </button>}
      </div>}

      {/* fim */}
      {fim && !animando && <div data-testid="pronto" role="status"
        className="proto-anim absolute inset-x-4 bottom-[max(18px,env(safe-area-inset-bottom))] z-[6] mx-auto max-w-[420px] rounded-2xl bg-[#fff8e7]/95 px-5 py-4 text-[#120c09] shadow-[0_18px_50px_rgba(0,0,0,.5)] [animation:proto-sobe_.5s_cubic-bezier(.2,1.3,.4,1)] min-[700px]:bottom-8">
        <p className="font-hand text-[27px] leading-none text-[#c2410c] min-[700px]:text-[32px]">Ficou com capricho!</p>
        <p className="mt-1 text-sm text-[#5c3d2e]">{def.fim}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" data-testid="montar-de-novo" onClick={deNovo}
            className="flex-1 rounded-full bg-[#120c09] px-4 py-2.5 text-sm font-semibold text-[#fff8e7] transition-colors hover:bg-[#2a1d18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Montar de novo</button>
          <button type="button" data-testid="outro-lanche" onClick={() => escolher(null)}
            className="flex-1 rounded-full border border-[#120c09]/25 px-4 py-2.5 text-sm font-semibold text-[#120c09] transition-colors hover:bg-[#120c09]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Outro lanche</button>
        </div>
      </div>}

      {!pronto && <div className="absolute inset-0 z-[7] grid place-items-center bg-[#120c09]/70 backdrop-blur-sm">
        <p className="font-hand text-3xl text-[#fff8e7]">Acendendo a chapa…</p>
      </div>}
    </>}
    <p aria-live="polite" className="sr-only">{anuncio}</p>
  </div>;
}

/** Tela leve de escolha: os 4 lanches sobre o fundo da cozinha. */
function Escolha({ aoEscolher }: { aoEscolher: (id: LancheId) => void }) {
  return <div className="proto-anim absolute inset-0 z-[8] flex flex-col items-center justify-center gap-5 overflow-y-auto bg-[#120c09]/55 px-4 py-8 backdrop-blur-[2px] [animation:proto-sobe_.45s_ease-out] min-[700px]:gap-8">
    <h1 className="text-center font-hand text-[38px] leading-none text-[#fff8e7] [text-shadow:0_2px_14px_rgba(0,0,0,.85)] min-[700px]:text-[52px]">Qual vai montar hoje?</h1>
    <ul className="grid w-full max-w-[380px] grid-cols-2 gap-3 min-[700px]:max-w-[1040px] min-[700px]:grid-cols-4 min-[700px]:gap-5">
      {ORDEM_LANCHES.map((id) => {
        const l = LANCHES[id];
        return <li key={id}>
          <button type="button" data-testid={`lanche-${id}`} onClick={() => aoEscolher(id)}
            className="group flex w-full flex-col overflow-hidden rounded-2xl border border-[#fff8e7]/12 bg-[#120c09]/70 text-left shadow-[0_14px_36px_rgba(0,0,0,.45)] backdrop-blur-md transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#ff9a4a]/60 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.foto} alt="" draggable={false} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            <span className="px-3 py-2.5 font-hand text-[24px] leading-none text-[#fff8e7] min-[700px]:px-4 min-[700px]:py-3 min-[700px]:text-[28px]">{l.nome}</span>
          </button>
        </li>;
      })}
    </ul>
  </div>;
}
