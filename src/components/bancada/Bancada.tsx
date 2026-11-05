"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type ComponentType, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import Carregando from "./Carregando";
import Escolha from "./Escolha";
import { IcGirar } from "./Icones";
import { PainelCombo, PainelFinal, PainelMontar, Progresso } from "./Painel";
import {
  BEBIDAS, PORCOES, RECEITAS, bancadaReducer, estadoFinalDe, estadoInicial, etapaAtual, receitaDe, textoPedido,
  type BebidaId, type Estado, type LancheId, type PorcaoId,
} from "./passos";
import type { Zona } from "./CenaBancada3D";

type CenaProps = {
  estado: Estado; reduzido: boolean; destacado: boolean; bloqueado: boolean; pronto: boolean;
  aoTerminar: () => void; aoMudarZona: (z: Zona) => void; aoPronto: () => void; aoFalhar: () => void; voltar: MutableRefObject<() => void>;
};
type Arrasto = { x: number; y: number; icone: string; sobre: boolean };

// A cena 3D (three.js) fica num chunk à parte: carrega junto com a página, mas fora do caminho da escolha.
const carregarCena = () => import("./CenaBancada3D");

function estadoDaUrl(): Estado | null {
  const q = new URLSearchParams(window.location.search);
  const lanche = q.get("lanche") as LancheId | null;
  const valido = lanche && lanche in RECEITAS ? lanche : null;
  if (q.get("bancada") === "final") {
    const bebida = BEBIDAS.find((b) => b.id === q.get("bebida"))?.id ?? null;
    const porcao = PORCOES.find((p) => p.id === q.get("porcao"))?.id ?? null;
    return estadoFinalDe(valido ?? "costela", bebida as BebidaId | null, porcao as PorcaoId | null);
  }
  return valido ? { ...estadoInicial, tela: "montar", lanche: valido } : null;
}

export default function Bancada() {
  const [estado, enviar] = useReducer(bancadaReducer, estadoInicial);
  const [Cena, setCena] = useState<{ C: ComponentType<CenaProps> } | null>(null);
  const [modo, setModo] = useState<"3d" | "sem3d" | null>(null);
  const [reduzido, setReduzido] = useState(false);
  const [prontoPara, setProntoPara] = useState<LancheId | null>(null);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [copia, setCopia] = useState<"idle" | "ok" | "manual">("idle");
  const [anuncio, setAnuncio] = useState("");
  const cenaRef = useRef<HTMLDivElement>(null);
  const zona = useRef<Zona | null>(null);
  const voltar = useRef<() => void>(() => {});
  const drag = useRef<{ pointer: number; x: number; y: number; ativo: boolean } | null>(null);
  const suprimir = useRef(false);
  const receita = receitaDe(estado);
  const final = estado.tela === "final";
  const pronto = modo === "sem3d" || (!!estado.lanche && prontoPara === estado.lanche);

  // URL de QA, WebGL e movimento reduzido.
  useEffect(() => {
    const url = estadoDaUrl();
    if (url) enviar({ type: "definir", estado: url });
    carregarCena().then((m) => setCena({ C: m.default as ComponentType<CenaProps> }));
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const verificar = () => setReduzido(media.matches);
    verificar();
    media.addEventListener("change", verificar);
    let gl3d = false;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      gl3d = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { /* WebGL pode estar bloqueado. */ }
    setModo(gl3d ? "3d" : "sem3d");
    return () => media.removeEventListener("change", verificar);
  }, []);

  useEffect(() => { if (!estado.lanche) setProntoPara(null); }, [estado.lanche]);
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    if (estado.tela === "escolha" || estado.tela === "montar") cenaRef.current?.closest("section")?.scrollIntoView({ block: "start" });
  }, [estado.tela === "escolha", estado.lanche]); // eslint-disable-line react-hooks/exhaustive-deps

  const terminou = useCallback(() => enviar({ type: "fimAnimacao" }), []);
  // Sem 3D (ou se a cena travar) as animações não terminam sozinhas: o estado não pode ficar preso.
  useEffect(() => {
    if (!estado.animando) return;
    const id = setTimeout(terminou, modo === "3d" ? 8000 : 140);
    return () => clearTimeout(id);
  }, [estado.animando, modo, terminou]);
  useEffect(() => {
    if (!estado.anterior) return;
    const id = setTimeout(() => enviar({ type: "descartarAnterior" }), 5000);
    return () => clearTimeout(id);
  }, [estado.anterior]);
  useEffect(() => {
    if (copia !== "ok") return;
    const id = setTimeout(() => setCopia("idle"), 2500);
    return () => clearTimeout(id);
  }, [copia]);
  useEffect(() => { if (estado.tela !== "final") setCopia("idle"); }, [estado.tela]);
  useEffect(() => {
    const etapa = etapaAtual(estado);
    if (estado.animando && etapa && estado.animando === etapa.id) setAnuncio(`${etapa.opcao.nome} colocado na tábua`);
    else if (estado.animando === "sacola") setAnuncio("Lanche na sacola, pronto pra viagem");
  }, [estado.animando]); // eslint-disable-line react-hooks/exhaustive-deps

  const preparar = useCallback((id: LancheId) => { carregarCena().then((m) => m.preCarregar(id)); }, []);
  const escolher = (id: LancheId) => { preparar(id); enviar({ type: "escolherLanche", id }); };

  // Arrastar a camada até a cena (zona = lanche projetado) ou simplesmente tocar/Enter.
  const sobreCena = (x: number, y: number) => {
    const r = cenaRef.current?.getBoundingClientRect();
    if (!r) return false;
    const z = zona.current, p = 20;
    const px = x - r.left, py = y - r.top;
    if (px < 0 || py < 0 || px > r.width || py > r.height) return false;
    return !z || (px >= z.x0 - p && px <= z.x1 + p && py >= z.y0 - p && py <= z.y1 + p);
  };
  const etapa = estado.tela === "montar" ? etapaAtual(estado) : null;
  const colocar = () => { if (etapa) enviar({ type: "colocar", id: etapa.id }); };
  const propsArrasto = {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || estado.animando || !pronto) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, ativo: false };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      if (!d || d.pointer !== e.pointerId || !etapa) return;
      if (!d.ativo && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      d.ativo = true;
      setArrasto({ x: e.clientX, y: e.clientY, icone: etapa.id, sobre: sobreCena(e.clientX, e.clientY) });
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      if (!d || d.pointer !== e.pointerId) return;
      drag.current = null;
      if (!d.ativo) return;
      suprimir.current = true;
      setTimeout(() => { suprimir.current = false; }, 0);
      setArrasto(null);
      if (sobreCena(e.clientX, e.clientY)) colocar();
    },
    onPointerCancel: () => { drag.current = null; setArrasto(null); },
    onClick: () => { if (!suprimir.current) colocar(); },
  };

  const copiar = async () => {
    const texto = textoPedido(estado);
    try {
      await navigator.clipboard.writeText(texto);
      setCopia("ok");
    } catch {
      let ok = false;
      try {
        const area = document.createElement("textarea");
        area.value = texto; area.setAttribute("readonly", ""); area.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(area); area.select();
        ok = document.execCommand("copy");
        area.remove();
      } catch { /* cai no texto manual */ }
      setCopia(ok ? "ok" : "manual");
    }
  };

  if (estado.tela === "escolha" || !receita) {
    return <section id="bancada" className="min-h-[100svh] bg-[#fff8e7] px-2 pb-5 pt-[calc(var(--header-height)+8px)] text-[#0a0a0a] min-[900px]:px-6 min-[900px]:pb-10 min-[900px]:pt-[calc(var(--header-height)+20px)]">
      <div className="mx-auto max-w-[1264px]"><Escolha aoEscolher={escolher} aoPreparar={preparar} /></div>
    </section>;
  }

  const combo = estado.tela === "bebida" || estado.tela === "porcao";
  const bebida = BEBIDAS.find((b) => b.id === estado.bebida);
  const porcao = PORCOES.find((p) => p.id === estado.porcao);
  const Scene = Cena?.C;
  return <section id="bancada" className="min-h-[100svh] bg-[#fff8e7] px-2 pb-5 pt-[calc(var(--header-height)+8px)] text-[#0a0a0a] min-[900px]:px-6 min-[900px]:pb-10 min-[900px]:pt-[calc(var(--header-height)+20px)]">
    <div className="mx-auto max-w-[1264px]">
      <header className="max-[899px]:sr-only min-[900px]:mb-3.5 min-[900px]:text-center">
        <h1 className="font-display text-[46px] font-normal uppercase leading-none">Monte o seu</h1>
        <p className="font-hand text-2xl text-[#5c3d2e]">do seu jeito, na nossa bancada</p>
      </header>
      <div aria-label="Bancada Monte o seu" role="region"
        className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-3xl bg-[#1a1210] p-3 text-[#fff8e7] shadow-[0_24px_60px_-24px_rgba(36,24,22,.6)] min-[900px]:grid-cols-[minmax(0,1fr)_380px] min-[900px]:grid-rows-[auto_1fr] min-[900px]:gap-5 min-[900px]:rounded-[32px] min-[900px]:p-5">
        <Progresso estado={estado} />
        <div ref={cenaRef} className={`relative isolate overflow-hidden rounded-2xl bg-[#120d0b] min-[900px]:min-h-[600px] min-[900px]:rounded-[22px] min-[900px]:[grid-column:1] min-[900px]:[grid-row:1/span_2] ${final ? "h-[276px] min-[900px]:h-auto" : "h-[250px] min-[900px]:h-auto"}`}>
          {modo === "3d" && Scene && <Scene estado={estado} reduzido={reduzido} destacado={!!arrasto?.sobre} bloqueado={!!arrasto} pronto={pronto}
            aoTerminar={terminou} aoMudarZona={(z) => { zona.current = z; }} aoPronto={() => setProntoPara(estado.lanche)} aoFalhar={() => setModo("sem3d")} voltar={voltar} />}
          {modo === "sem3d" && <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receita.foto} alt={`${receita.nome} na tábua`} className="absolute inset-0 h-full w-full object-cover" />
            <p className="absolute inset-x-3 top-3 rounded-lg bg-[#120d0b]/75 px-3 py-2 text-center text-xs text-[#fff8e7]">A cena 3D não está disponível neste aparelho, mas a montagem funciona igual.</p>
          </>}
          {(modo === null || (modo === "3d" && !Scene)) && <Carregando foto={receita.foto} />}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] shadow-[inset_0_0_60px_rgba(10,6,5,.55)]" />
          {combo && <div aria-label="Na mesa" className="absolute bottom-2.5 left-2.5 z-[2] flex max-w-[calc(100%-70px)] flex-wrap gap-1.5 min-[900px]:bottom-4 min-[900px]:left-4 min-[900px]:max-w-[calc(100%-190px)]">
            {[receita.nome.replace(/!$/, ""), bebida?.curto, estado.tela === "porcao" ? porcao?.curto : undefined].filter(Boolean).map((t) => <span key={t} className="rounded-full border border-[#fff8e7]/20 bg-[#120d0b]/80 px-2.5 py-[5px] text-xs font-semibold text-[#fff8e7] backdrop-blur-sm">{t}</span>)}
          </div>}
          {modo === "3d" && <button type="button" data-testid="ver-de-frente" onClick={() => voltar.current()} aria-label="Ver de frente"
            className="absolute bottom-2.5 right-2.5 z-[2] inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[#fff8e7]/30 bg-[#120d0b]/75 px-3 text-sm font-semibold text-[#fff8e7] backdrop-blur-sm transition-colors hover:bg-[#120d0b]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] min-[900px]:bottom-4 min-[900px]:right-4 min-[900px]:pl-3 min-[900px]:pr-4">
            <IcGirar /><span className="hidden min-[900px]:inline">Ver de frente</span></button>}
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 rounded-[18px] bg-[#241a16] px-3.5 pb-3 pt-3.5 min-[900px]:gap-3 min-[900px]:rounded-[22px] min-[900px]:px-[18px] min-[900px]:py-4 min-[900px]:[grid-column:2] min-[900px]:[grid-row:2]">
          {estado.tela === "montar" && <PainelMontar estado={estado} enviar={enviar} pronto={pronto} arrasto={{ ativo: !!arrasto, props: propsArrasto }} />}
          {combo && <PainelCombo estado={estado} enviar={enviar} />}
          {final && <PainelFinal estado={estado} enviar={enviar} copia={copia} aoCopiar={copiar} textoManual={textoPedido(estado)} />}
        </div>
      </div>
    </div>
    {arrasto && etapa && <div aria-hidden="true" className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2" style={{ left: arrasto.x, top: arrasto.y }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/assets/bancada/icones/${arrasto.icone}.webp`} alt="" className={`h-[84px] w-[84px] -rotate-6 object-contain drop-shadow-[0_10px_8px_rgba(0,0,0,.55)] transition-transform ${arrasto.sobre ? "scale-[1.2]" : "scale-110"}`} />
    </div>}
    {estado.anterior && <div role="status" className="fixed bottom-[18px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3.5 rounded-xl bg-[#fff8e7] px-4 py-3 text-sm font-semibold text-[#0a0a0a] shadow-[0_10px_30px_rgba(0,0,0,.4)] min-[900px]:bottom-7">
      Limpado.<button type="button" data-testid="restaurar" onClick={() => enviar({ type: "restaurar" })} className="min-h-8 font-bold text-[#5c3d2e] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a]">Desfazer</button>
    </div>}
    <p aria-live="polite" className="sr-only">{anuncio}</p>
  </section>;
}
