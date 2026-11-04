"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { PEDIDO_URL } from "@/lib/links";

const CenaBancada3D = dynamic(() => import("./CenaBancada3D"), { ssr: false });
import IconeIngrediente from "./IconeIngrediente";
import { layouts, type LayoutBancada, type Ponto } from "./layout";
import { bancadaReducer, estadoInicial, PASSOS, type PassoId } from "./passos";

type Voo = { tipo: PassoId; origem: Ponto; destino: Ponto; volta: boolean; id: number };
type Arrasto = { pointer: number; origem: Ponto; toque: Ponto; ponto: Ponto; offset: Ponto; tipo: PassoId; iniciou: boolean };
const posicao = (p: Ponto, l: LayoutBancada) => ({ left: `${p.x / l.largura * 100}%`, top: `${p.y / l.altura * 100}%` });

export default function Bancada() {
  const [estado, enviar] = useReducer(bancadaReducer, estadoInicial);
  const [orientacao, setOrientacao] = useState<"retrato" | "paisagem">("retrato");
  const [anuncio, setAnuncio] = useState("");
  const [interagiu, setInteragiu] = useState(false);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [voo, setVoo] = useState<Voo | null>(null);
  const vooAtual = useRef<Voo | null>(null);
  const [anotacao, setAnotacao] = useState<PassoId | null>(null);
  const [geracao, novaGeracao] = useReducer((n: number) => n + 1, 0);
  const [previa, setPrevia] = useState(false);
  const [suporte, setSuporte] = useState<"neutro" | "3d" | "poster">("neutro");
  const quadro = useRef<HTMLDivElement>(null);
  const drag = useRef<Arrasto | null>(null);
  const vooId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisou = useRef(false);
  const reduzido = suporte === "poster";
  const layout = layouts[orientacao];
  const passo = PASSOS[estado.passoAtual];
  const terminou = estado.passoAtual === PASSOS.length;
  const completo = estado.colocados.size === PASSOS.length;
  const vazio = estado.colocados.size === 0;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const atualizar = () => setOrientacao(media.matches ? "paisagem" : "retrato");
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const verificar = () => {
      let disponivel = false;
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        disponivel = !!gl;
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch { /* WebGL can be blocked by the browser. */ }
      setSuporte(motion.matches || !disponivel ? "poster" : "3d");
    };
    verificar();
    motion.addEventListener("change", verificar);
    return () => motion.removeEventListener("change", verificar);
  }, []);
  useEffect(() => {
    if (revisou.current) return;
    revisou.current = true;
    const valor = new URLSearchParams(window.location.search).get("bancada");
    const alvo = valor === "final" ? 6 : /^[1-6]$/.test(valor ?? "") ? Number(valor) - 1 : 0;
    for (let i = 0; i < alvo; i++) {
      enviar({ type: "escolher", opcaoId: PASSOS[i].opcoes[0].id });
      enviar({ type: "fimAnimacao" });
    }
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const ponto = (e: { clientX: number; clientY: number }): Ponto => {
    const rect = quadro.current?.getBoundingClientRect();
    if (!rect) return layout.bandeja;
    return { x: (e.clientX - rect.left) / rect.width * layout.largura, y: (e.clientY - rect.top) / rect.height * layout.altura };
  };
  const dentro = (p: Ponto) => Math.abs(p.x - layout.pao.x) <= layout.raio.x && Math.abs(p.y - layout.pao.y) <= layout.raio.y;
  const agendarAnotacao = (id: PassoId) => {
    if (timer.current) clearTimeout(timer.current);
    setAnotacao(id);
    timer.current = setTimeout(() => setAnotacao(null), 2500);
  };
  const escolher = (id: PassoId) => {
    if (estado.animando || terminou || PASSOS[estado.passoAtual].id !== id) return;
    enviar({ type: "escolher", opcaoId: PASSOS[estado.passoAtual].opcoes[0].id });
    setAnuncio(id === "macarico" ? "Maçarico finalizado no pão" : `${PASSOS[estado.passoAtual].nome} no pão`);
    agendarAnotacao(id);

  };
  const finalizar = () => {
    if (!estado.animando) return;
    enviar({ type: "fimAnimacao" });
  };
  useEffect(() => {
    if (suporte !== "3d" && estado.animando) {
      const id = setTimeout(() => enviar({ type: "fimAnimacao" }), 140);
      return () => clearTimeout(id);
    }
  }, [suporte, estado.animando]);
  const reiniciar = () => {
    drag.current = null; vooAtual.current = null; setArrasto(null); setVoo(null); setAnotacao(null); setPrevia(false);
    if (timer.current) clearTimeout(timer.current);
    novaGeracao(); enviar({ type: "recomecar" }); setAnuncio("Montagem recomeçada");
  };
  const comecarVoo = (tipo: PassoId, origem: Ponto, destino: Ponto, volta = false) => {
    if (reduzido) { if (!volta) escolher(tipo); return; }
    const proximo = { tipo, origem, destino, volta, id: ++vooId.current };
    vooAtual.current = proximo;
    setVoo(proximo);
  };
  const toqueMacarico = () => comecarVoo("macarico", layout.bandeja, layout.pouso);
  const iniciar = (e: ReactPointerEvent<HTMLButtonElement>, tipo: PassoId) => {
    if (estado.animando || vooAtual.current || terminou) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = ponto(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const centro = ponto({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
    drag.current = { pointer: e.pointerId, origem: centro, toque: p, ponto: centro, offset: { x: p.x - centro.x, y: p.y - centro.y }, tipo, iniciou: false };
    setInteragiu(true);
  };
  const mover = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const p = ponto(e);
    if (!d.iniciou && Math.hypot(p.x - d.toque.x, p.y - d.toque.y) * (quadro.current?.clientWidth ?? 400) / layout.largura < 6) return;
    d.iniciou = true;
    d.ponto = { x: p.x - d.offset.x, y: p.y - d.offset.y };
    setArrasto({ ...d });
    setPrevia(dentro(d.ponto));
  };
  const soltar = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null; setArrasto(null); setPrevia(false);
    if (!d.iniciou) {
      if (d.tipo === "macarico") toqueMacarico();
      else comecarVoo(d.tipo, layout.bandeja, layout.pouso);
    } else if (dentro(d.ponto)) {
      comecarVoo(d.tipo, d.ponto, layout.pouso);
    } else comecarVoo(d.tipo, d.ponto, layout.bandeja, true);
  };
  const cancelar = () => { drag.current = null; setArrasto(null); setPrevia(false); };
  const desfazer = () => {
    if (estado.animando || vooAtual.current || !estado.colocados.size) return;
    const ultimo = [...PASSOS].reverse().find((p) => estado.colocados.has(p.id));
    if (!ultimo) return;
    enviar({ type: "desfazer" }); setAnotacao(null); novaGeracao(); setAnuncio(`Desfeito: ${ultimo.nome.toLowerCase()}`);
  };

  return <section id="bancada" className="scroll-mt-[var(--header-height)] bg-creme px-3 py-8 text-carvao sm:px-8 sm:py-14">
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 text-center sm:mb-7"><h2 className="font-display text-4xl uppercase leading-none sm:text-6xl">Monte o seu</h2><p className="font-hand text-2xl text-madeira sm:text-3xl">do seu jeito, na nossa bancada</p></header>
      <div ref={quadro} className="relative mx-auto aspect-[400/580] w-[min(100%,calc((100svh-var(--header-height)-24px)*400/580))] max-w-[640px] overflow-hidden rounded-xl border border-madeira bg-[#38251e] shadow-[0_18px_40px_rgba(36,24,18,.22)] md:aspect-video md:w-[min(100%,calc((100svh-var(--header-height)-24px)*16/9))] md:max-w-none">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#33231d,#1a1210)]" role="img" aria-label={terminou ? "Lanche finalizado na bancada da Alhoaria" : `Bancada: ${passo.pedido.toLowerCase()}. ${estado.colocados.size} de 6 etapas prontas.`} />
        {suporte === "3d" && <CenaBancada3D key={geracao} estado={estado} orientacao={orientacao} destacado={previa} aoTerminar={finalizar} />}
        {suporte === "poster" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1a1210] px-6 text-center text-osso"><img src="/assets/bancada/lanche-pronto.webp" alt="A Costela! pronta na tábua" className="max-h-[55%] w-full max-w-2xl rounded-lg object-contain" /><h3 className="font-display text-3xl">A COSTELA!</h3><p className="max-w-sm font-sans text-sm">Você pode montar com animação em outro dispositivo ou configuração com WebGL e movimento habilitados.</p><a href={PEDIDO_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-lg bg-macarico px-6 font-sans font-bold text-carvao">Peça agora<span className="sr-only"> (abre em nova aba)</span></a></div>}
        {suporte === "3d" && <div aria-hidden="true" className={orientacao === "retrato" ? "absolute inset-x-0 bottom-0 h-[18%] border-t-4 border-[#ddaa72] bg-gradient-to-b from-[#bd8958] to-[#71432f]" : "absolute right-[2%] top-1/2 h-[48%] w-[31%] -translate-y-1/2 rounded-xl border-4 border-[#d2a373] bg-gradient-to-b from-[#bd8958] to-[#71432f]"} />}
        {suporte === "3d" && <>
        <div className="absolute inset-x-0 top-0 flex h-[11%] flex-nowrap items-center justify-between gap-x-1 bg-[#261b19]/85 px-2 font-sans text-[8px] font-bold tracking-wide text-osso sm:px-5 sm:text-[9px] md:text-xs">
          <span className="whitespace-nowrap">ALHOARIA · COZINHA ABERTA</span><div className="flex shrink-0 items-center gap-1 sm:gap-2"><span className="hidden items-center gap-1 whitespace-nowrap text-[8px] sm:flex sm:text-xs"><span className="h-2 w-2 animate-pulse rounded-full bg-macarico" />PREPARANDO AGORA</span><ol className="flex gap-0.5" aria-label="Progresso da montagem">{PASSOS.map((item, i) => { const situacao = estado.colocados.has(item.id) ? "feito" : i < estado.passoAtual ? "pulado" : i === estado.passoAtual ? "atual" : "pendente"; return <li key={item.id} aria-label={`${item.nome}: ${situacao}`} aria-current={situacao === "atual" ? "step" : undefined} title={`${item.nome}: ${situacao}`} className={`flex h-5 w-5 items-center justify-center rounded-full border ${situacao === "atual" ? "border-queijo bg-macarico" : situacao === "feito" ? "border-queijo bg-madeira" : "border-osso/40 bg-carvao/50 opacity-60"}`}><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d={["M3 16q1-10 9-10t9 10q0 4-9 4T3 16Z", "M7 5h10l-2 15H9Z", "M3 16l4-8 9-2 5 10-7 4H7Z", "M4 9h16l-3 11H7Z", "M4 6l16 2-4 12H7Z", "M5 8h11l3 5-3 4H5Z"][i]} /></svg></li>; })}</ol></div>
        </div>
        {(!terminou || anotacao) && <motion.h3 aria-live="off" initial={reduzido ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduzido ? 0 : 0.15 }} className="pointer-events-none absolute z-10 w-[min(206px,54%)] -translate-x-1/2 -translate-y-1/2 text-center font-hand text-[clamp(20px,4vw,30px)] leading-tight text-[#fff0ce] drop-shadow-[0_2px_3px_#261b19] md:w-[min(250px,27%)] md:text-[clamp(22px,2.2vw,30px)]" style={posicao(layout.pedido, layout)} key={anotacao ?? passo.id}>{anotacao ? PASSOS.find((item) => item.id === anotacao)?.anotacao : passo.pedido}</motion.h3>}
        {!terminou && <>
          <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 gap-1 sm:gap-2" style={posicao(layout.controles, layout)}>
            <button type="button" disabled={estado.animando || !!voo || !estado.colocados.size} onClick={desfazer} className="min-h-11 rounded-full border border-[#e4b684] bg-[#37251f]/95 px-2 font-sans text-[11px] font-bold text-osso disabled:opacity-45 sm:px-3 sm:text-sm" aria-label="Desfazer última camada">↶ Desfazer</button>
            <button type="button" disabled={estado.animando || !!voo} onClick={() => { setInteragiu(true); setAnuncio(`${passo.nome} pulado`); enviar({ type: "pular" }); }} className="min-h-11 rounded-full border border-[#e4b684] bg-[#37251f]/95 px-2 font-sans text-[11px] font-bold text-osso disabled:opacity-45 sm:px-3 sm:text-sm" aria-label={`Pular ${passo.nome}`}>→ Pular</button>
            <button type="button" onClick={reiniciar} className="min-h-11 rounded-full border border-[#e4b684] bg-[#37251f]/95 px-2 font-sans text-[11px] font-bold text-osso sm:px-3 sm:text-sm" aria-label="Recomeçar montagem">⟲ Recomeçar</button>
          </div>
          <div className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-wrap justify-center gap-1 sm:gap-3" style={posicao(layout.bandeja, layout)}>
            {passo.opcoes.map((opcao) => <button key={opcao.id} type="button" disabled={estado.animando || !!voo} onPointerDown={(e) => iniciar(e, passo.id)} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={cancelar} onClick={(e) => { if (e.detail === 0 && !estado.animando && !voo) { setInteragiu(true); if (passo.id === "macarico") toqueMacarico(); else comecarVoo(passo.id, layout.bandeja, layout.pouso); } }} aria-label={`${opcao.nome}: toque ou arraste até o pão`} style={{ touchAction: "none" }} className="flex min-h-[90px] min-w-[108px] flex-col items-center justify-center rounded-xl p-1 font-sans text-[13px] font-bold leading-tight text-osso drop-shadow-[0_5px_4px_rgba(30,20,15,.7)] transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-queijo disabled:opacity-50 md:min-h-[114px] md:min-w-[152px] md:text-sm md:[&_svg]:h-[93px] md:[&_svg]:w-[126px]">
              <motion.span animate={!reduzido && !interagiu ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: 1.5, repeat: !interagiu && !reduzido ? Infinity : 0 }} className={arrasto?.tipo === passo.id ? "opacity-35" : ""}><IconeIngrediente tipo={passo.id} /></motion.span><span>{opcao.nome}</span>
            </button>)}
          </div>
          {!interagiu && estado.passoAtual === 0 && !reduzido && <motion.div aria-hidden="true" className="pointer-events-none absolute z-20 text-3xl drop-shadow-lg" style={posicao(layout.bandeja, layout)} animate={{ x: [0, (layout.pao.x - layout.bandeja.x) * (quadro.current?.clientWidth ?? 400) / layout.largura, 0], y: [0, (layout.pao.y - layout.bandeja.y) * (quadro.current?.clientHeight ?? 580) / layout.altura, 0], opacity: [0, 1, 0] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: .8 }}>☝️</motion.div>}
        </>}
        {arrasto?.iniciou && <motion.div aria-hidden="true" className="pointer-events-none absolute z-30" style={{ ...posicao(arrasto.ponto, layout), translate: "-50% -50%", touchAction: "none" }} animate={{ rotate: -12, scale: 1.1 }}><IconeIngrediente tipo={arrasto.tipo} /></motion.div>}
        {voo && <motion.div key={voo.id} aria-hidden="true" className="pointer-events-none absolute z-30" style={{ ...posicao(voo.origem, layout), translate: "-50% -50%", touchAction: "none" }} initial={{ x: 0, y: 0, rotate: -10, scale: 1.1 }} animate={{ x: (voo.destino.x - voo.origem.x) / layout.largura * (quadro.current?.clientWidth ?? 400), y: voo.volta ? (voo.destino.y - voo.origem.y) / layout.altura * (quadro.current?.clientHeight ?? 580) : [0, (voo.destino.y - voo.origem.y) / layout.altura * (quadro.current?.clientHeight ?? 580) - 45, (voo.destino.y - voo.origem.y) / layout.altura * (quadro.current?.clientHeight ?? 580)], rotate: 0, scale: voo.volta ? 1 : [1.1, 1.16, .85, 1] }} transition={voo.volta ? { type: "spring", stiffness: 300, damping: 24 } : { duration: .55, ease: "easeOut" }} onAnimationComplete={() => { if (vooAtual.current?.id !== voo.id) return; vooAtual.current = null; setVoo(null); if (!voo.volta) escolher(voo.tipo); }}><IconeIngrediente tipo={voo.tipo} /></motion.div>}
        {terminou && <div className="absolute inset-x-2 top-[76%] z-20 rounded-xl border border-[#e9b880] bg-[#f5e7ce]/95 px-2 py-1.5 text-center shadow-2xl backdrop-blur-sm md:inset-x-auto md:bottom-auto md:left-[67%] md:top-1/2 md:w-[31%] md:-translate-y-1/2 md:p-3"><div aria-hidden="true" className="hidden text-xl text-macarico sm:block">✦ ♨ ✦</div><p className="hidden font-hand text-xl text-madeira sm:block">Saindo da nossa cozinha</p><h3 className="font-display text-xl text-madeira md:text-2xl">{vazio ? "PULOU TUDO?" : completo ? "A COSTELA!" : "SUA MONTAGEM"}</h3><p className="my-1 font-sans text-xs text-[#3e2b22] sm:my-2 sm:text-sm">{vazio ? "Pulou tudo? Então peça do jeito da casa." : completo ? "Do jeitinho que sai da nossa chapa." : "Aqui foi brincadeira. O pedido de verdade é no Anota Aí."}</p><div className="flex gap-2"><a href={PEDIDO_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-macarico px-2 font-sans text-sm font-bold text-carvao">Peça agora<span className="sr-only"> (abre em nova aba)</span></a><button type="button" onClick={reiniciar} className="min-h-11 flex-1 rounded-lg border border-madeira px-2 font-sans text-sm font-bold text-madeira">Montar de novo</button></div></div>}
        </>}
        <p aria-live="polite" className="sr-only">{anuncio}</p>
      </div>
    </div>
  </section>;
}
