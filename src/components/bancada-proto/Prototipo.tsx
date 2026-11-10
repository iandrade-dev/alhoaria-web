"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import type { ApiCena, Bus, Modo, Projecao } from "./Cena";
import {
  LANCHES, ORDEM_LANCHES, ehLanche, opcaoDaEstacao, passoDe, type EstacaoId, type LancheDef, type LancheId, type PassoDef,
} from "./layout";
import type { EstadoSacola, FasePedido, ProjPedido } from "./Pedido3D";
import type { ApiCamara } from "./Camara";
import PedidoHud, { PainelTurbinar, TrilhaPedido, somarAdicional, type FasePos } from "./PedidoHud";
import {
  ADICIONAIS, OPCOES, OPCOES_PADRAO, SEM_OPCAO, brl, novoPedido, opcaoDe, textoDasOpcoes, type GrupoOpcao, type Pedido,
} from "./cardapio";
import { pedidoDaURL, urlDoPedido } from "@/lib/pedido-url";
import { useSacola } from "../pedido/SacolaProvider";
import BotaoSacola from "../pedido/BotaoSacola";
import { restaurante } from "@/data/restaurante";
import { dispositivoLeve } from "@/lib/desempenho";
import { ESTADO_3D, type EstadoAR, type SessaoMesa } from "../ar/sessao";
import { EntradaMesa, ControlesMesa } from "../ar/ModoMesa";

const Cena = dynamic(() => import("./Cena"), { ssr: false });

const FOLGA = 56; // px de folga em volta do lanche para soltar a ferramenta

type Toque = { id: EstacaoId; pointer: number; x: number; y: number; moveu: boolean };

/** Estação que o "Monta pra mim" usa na etapa: a primeira opção do grupo, ou a própria etapa. */
const estacaoAuto = (p: PassoDef, pedido: Pedido | null) => (p.grupo ? `${p.id}:${pedido?.opcoes?.[p.grupo] || OPCOES[p.grupo][0].id}` : p.id);
const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]";
/** Amostra de cor de cada opção (bolinha nos rótulos e nos botões do pão). */
const AMOSTRA: Record<string, string> = {
  parmesao: "radial-gradient(circle at 30% 35%, #f6e6ae 0 12%, transparent 13%), radial-gradient(circle at 65% 60%, #f6e6ae 0 11%, transparent 12%), radial-gradient(circle at 60% 25%, #f6e6ae 0 9%, transparent 10%), #c98a3f",
  roseta: "radial-gradient(circle at 30% 35%, #3d6a22 0 12%, transparent 13%), radial-gradient(circle at 65% 60%, #3d6a22 0 11%, transparent 12%), radial-gradient(circle at 60% 25%, #3d6a22 0 9%, transparent 10%), #c98a3f",
  tradicional: "#f1e6c6",
  ervas: "radial-gradient(circle at 35% 40%, #3f6e24 0 13%, transparent 14%), radial-gradient(circle at 65% 62%, #3f6e24 0 12%, transparent 13%), #c3d58a",
  cheddar: "#e2791f",
  "4-queijos": "#f2e2b0",
  mucarela: "#f6eed4",
  colonial: "#f1c23a",
};

export default function Prototipo() {
  const sacola = useSacola();
  const guardado = useRef<string | null>(null);
  const [leve, setLeve] = useState(true);
  const [oculto, setOculto] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const aoProgresso = useCallback((n: number) => setProgresso(n), []);
  const overlay = useRef<HTMLDivElement>(null), gestosAR = useRef<HTMLDivElement>(null);
  const sessaoAR = useRef<SessaoMesa | null>(null);
  const [ambiente, setAmbiente] = useState<"bancada" | "ar" | null>(null);
  const [suporteAR, setSuporteAR] = useState<boolean | null>(null);
  const [xrPronto, setXrPronto] = useState(false);
  const [ar, setAR] = useState<EstadoAR>(ESTADO_3D);
  const aoEstadoAR = useCallback((e: EstadoAR) => {
    setAR(e);
    if (e.fase === "3d") setAmbiente((v) => v === null ? null : "bancada");
  }, []);
  const [zoomAR, setZoomAR] = useState(1), [giroAR, setGiroAR] = useState(0);
  const aoXrPronto = useCallback(() => setXrPronto(true), []);
  const mudarZoomAR = useCallback((n: number) => setZoomAR(Math.max(0.5, Math.min(2.5, n))), []);
  const emAR = ar.fase !== "3d" && ar.fase !== "iniciando";
  const bloqueioAR = ar.fase !== "3d" && (ar.fase !== "colocado" || !ar.rastreando);
  const bloqueioRef = useRef(false); bloqueioRef.current = bloqueioAR || !ambiente || oculto || sacola.aberta;
  // undefined = ainda lendo a URL; null = tela de escolha
  const [lanche, setLanche] = useState<LancheId | null | undefined>(undefined);
  const [feitos, setFeitos] = useState(0);
  const [pulados, setPulados] = useState<readonly string[]>([]);
  const [animando, setAnimando] = useState<EstacaoId | null>(null);
  const [auto, setAuto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [proj, setProj] = useState<Projecao | null>(null);
  const [reduzido, setReduzido] = useState(false);
  // sem WebGL (ou contexto perdido com a cena montada): aviso leve no lugar da cena
  const [semGl, setSemGl] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [segurando, setSegurando] = useState<EstacaoId | null>(null);
  const [pop, setPop] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [congelar, setCongelar] = useState<{ id: string; t: number } | null>(null);
  // pedido: nasce com o lanche (opções e adicionais entram na montagem; bebida e acompanhamento depois do lanche pronto)
  const [fase, setFase] = useState<"montagem" | FasePos>("montagem");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const pedidoRef = useRef(pedido); pedidoRef.current = pedido;
  const [projPed, setProjPed] = useState<ProjPedido | null>(null);
  const [sacolaPronta, setSacolaPronta] = useState(false);
  // a mão do pedido (potinhos, queijo em dobro) está trabalhando: a montagem espera
  const [ocupado, setOcupado] = useState(false);
  // "Fechar o lanche" com a mão ainda soltando um adicional: fecha quando ela terminar
  const [fechando, setFechando] = useState(false);
  const [rodada, setRodada] = useState(0);
  // câmera girada/afastada (mostra "Centralizar")
  const [camFora, setCamFora] = useState(false);
  // sacola: a pessoa pôs o lanche nela (arrastou ou tocou) e o andamento da cena
  const [ensacar, setEnsacar] = useState(false);
  const [sacolaEstado, setSacolaEstado] = useState<EstadoSacola>("nada");
  const camApi = useRef<ApiCamara | null>(null);
  const bus = useRef<Bus>({ drag: { ativo: false, id: null, x: 0, y: 0 } });
  const api = useRef<ApiCena | null>(null);
  const toque = useRef<Toque | null>(null);
  const suprimir = useRef(false);
  const autoRef = useRef(false);
  const animRef = useRef<EstacaoId | null>(null);
  const feitosRef = useRef(0);
  const projRef = useRef<Projecao | null>(null);
  const ocupadoRef = useRef(false);
  feitosRef.current = feitos; projRef.current = proj;

  const def: LancheDef | null = lanche ? LANCHES[lanche] : null;
  const PASSOS = def?.passos ?? [];
  const passosRef = useRef(PASSOS); passosRef.current = PASSOS;
  const aoPronto = useCallback(() => setPronto(true), []);
  const aoSacola = useCallback(() => setSacolaPronta(true), []);
  const aoFalhar = useCallback(() => setSemGl(true), []);
  const aoOcupado = useCallback((o: boolean) => { ocupadoRef.current = o; setOcupado(o); }, []);
  const ativoDef = feitos < PASSOS.length ? PASSOS[feitos] : null;
  const ativo = ativoDef?.id ?? null;
  const fim = !!def && feitos >= PASSOS.length;
  const ehPao = def?.forma === "pao";
  const escolhendoPao = ehPao && !!pedido?.opcoes && !pedido.opcoes.pao && feitos === 0 && !auto;
  const turbinando = fase === "montagem" && ativoDef?.tipo === "turbinar";
  const fase3d: FasePedido = fase !== "montagem" ? fase : turbinando ? "turbinar" : "montagem";

  useEffect(() => {
    setLeve(dispositivoLeve(navigator));
    const visibilidade = () => setOculto(document.hidden);
    visibilidade(); document.addEventListener("visibilitychange", visibilidade);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ver = () => setReduzido(media.matches);
    ver(); media.addEventListener("change", ver);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) setSemGl(true);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { setSemGl(true); }
    const q = new URLSearchParams(window.location.search);
    const l = q.get("lanche");
    const inicial = ehLanche(l) ? l : null;
    setLanche(inicial);
    setPedido(inicial ? pedidoDaURL(q, inicial) : null);
    const c = q.get("congelar");
    if (c && inicial) { const [id, t] = c.split(":"); if (LANCHES[inicial].passos.some((p) => p.id === id)) setCongelar({ id, t: Number(t) || 1 }); }
    return () => { media.removeEventListener("change", ver); document.removeEventListener("visibilitychange", visibilidade); };
  }, []);

  useEffect(() => {
    let vivo = true;
    if (window.isSecureContext && navigator.xr) void navigator.xr.isSessionSupported("immersive-ar")
      .then((v) => { if (vivo) setSuporteAR(v); }).catch(() => { if (vivo) setSuporteAR(false); });
    else setSuporteAR(false);
    const alvo = overlay.current;
    const bloquear = (e: Event) => e.preventDefault();
    alvo?.addEventListener("beforexrselect", bloquear);
    const cabecalho = document.querySelector<HTMLElement>("body > header"), inerteAntes = cabecalho?.inert;
    if (cabecalho) cabecalho.inert = true;
    return () => {
      vivo = false; alvo?.removeEventListener("beforexrselect", bloquear);
      if (cabecalho) cabecalho.inert = inerteAntes ?? false;
    };
  }, []);

  useEffect(() => {
    if (suporteAR === false) setAmbiente((v) => v ?? "bancada");
  }, [suporteAR]);

  useEffect(() => {
    if (!bloqueioAR) return;
    const t = toque.current;
    bus.current.drag.ativo = false; toque.current = null;
    if (t) api.current?.soltar(t.id);
    setSegurando(null); setSobre(false);
  }, [bloqueioAR]);

  const escolherAmbiente = (usarAR: boolean) => {
    if (usarAR && !sessaoAR.current) return;
    setAmbiente(usarAR ? "ar" : "bancada");
    if (usarAR && def) void sessaoAR.current?.iniciar();
  };

  useEffect(() => {
    if (semGl) {
      const timer = setTimeout(() => {
        window.location.replace(pedidoRef.current ? urlDoPedido(pedidoRef.current, "/cardapio") : "/cardapio");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [semGl]);

  const muda = useCallback((f: (p: Pedido) => Pedido) => setPedido((p) => (p ? f(p) : p)), []);
  const escolherOpcao = useCallback((g: GrupoOpcao, v: string) => setPedido((p) => (p?.opcoes ? { ...p, opcoes: { ...p.opcoes, [g]: v } } : p)), []);

  /** Começa a ação da estação `est` (a etapa, ou uma opção dela). */
  const disparar = useCallback((est: EstacaoId, modo: Modo) => {
    if (bloqueioRef.current || animRef.current || !api.current || ocupadoRef.current) return;
    const passo = passosRef.current[feitosRef.current];
    if (!passo || passo.id !== passoDe(est)) return;
    const op = opcaoDaEstacao(est);
    if (passo.grupo && op) escolherOpcao(passo.grupo, op);
    animRef.current = est;
    setAnimando(est);
    setAnuncio("");
    api.current.acao(est, modo);
  }, [escolherOpcao]);

  /** "Monta pra mim": faz a etapa atual (Turbinar: fecha sem adicionais). */
  const autoPasso = useCallback(() => {
    if (!autoRef.current || bloqueioRef.current) return;
    const p = passosRef.current[feitosRef.current];
    if (!p) return;
    if (p.tipo === "turbinar") { avancarRef.current(feitosRef.current); return; }
    // Escolhas vindas do /ar também valem no "Monta pra mim".
    if (p.grupo && pedidoRef.current?.opcoes?.[p.grupo] === "sem") {
      const n = p.grupo === "queijo" && passosRef.current[feitosRef.current + 1]?.tipo === "macarico" ? 2 : 1;
      setPulados((ids) => [...ids, ...passosRef.current.slice(feitosRef.current, feitosRef.current + n).map((p) => p.id)]);
      avancarRef.current(feitosRef.current, n); return;
    }
    disparar(estacaoAuto(p, pedidoRef.current), "auto");
  }, [disparar]);

  useEffect(() => {
    if (bloqueioAR || !autoRef.current || animRef.current) return;
    const timer = setTimeout(autoPasso, 350);
    return () => clearTimeout(timer);
  }, [bloqueioAR, autoPasso]);

  /** Vai para a etapa seguinte (depois de fazer ou pular a etapa `i`; `n` etapas de uma vez). */
  const avancar = useCallback((i: number, n = 1) => {
    feitosRef.current = i + n;
    setFeitos(i + n);
    setPop(i);
    const prox = passosRef.current[i + n];
    if (!prox) { autoRef.current = false; setAuto(false); return; }
    if (autoRef.current) setTimeout(autoPasso, 350);
  }, [autoPasso]);
  const avancarRef = useRef(avancar); avancarRef.current = avancar;

  const aoFim = useCallback((est: EstacaoId) => {
    animRef.current = null;
    const i = passosRef.current.findIndex((p) => p.id === passoDe(est));
    setAnimando(null);
    setAnuncio(passosRef.current[i].feito);
    try { navigator.vibrate?.(12); } catch { /* sem vibração */ }
    avancar(i);
  }, [avancar]);

  // "Fechar o lanche": espera a mão soltar o último adicional e segue para a tampa
  useEffect(() => {
    if (!fechando || ocupado) return;
    setFechando(false);
    const i = passosRef.current.findIndex((p) => p.tipo === "turbinar");
    if (i === feitosRef.current) { setAnuncio("Lanche turbinado. Agora a tampa"); avancar(i); }
  }, [fechando, ocupado, avancar]);
  const fecharLanche = () => { if (turbinando) setFechando(true); };

  const montaPraMim = () => {
    if (fim || !ativo) return;
    autoRef.current = true; setAuto(true);
    if (escolhendoPao) escolherOpcao("pao", OPCOES_PADRAO.pao!);
    if (turbinando) { fecharLanche(); return; }
    if (!animRef.current) autoPasso();
  };
  const parar = () => { autoRef.current = false; setAuto(false); };
  const pular = () => {
    if (animRef.current || !ativoDef?.opcional) return;
    setPulados((p) => [...p, ativoDef.id]);
    setAnuncio(`${ativoDef.nome}: pulado`);
    avancar(feitosRef.current);
  };
  /** Chip "Sem ...": a etapa fica pulada na trilha. Sem queijo, o maçarico também é pulado. */
  const semOpcao = () => {
    const g = ativoDef?.grupo;
    if (animRef.current || ocupadoRef.current || !g) return;
    const i = feitosRef.current;
    const ids = [ativoDef.id];
    if (g === "queijo" && PASSOS[i + 1]?.tipo === "macarico") ids.push(PASSOS[i + 1].id);
    escolherOpcao(g, "sem");
    setPulados((p) => [...p, ...ids]);
    setAnuncio(`${SEM_OPCAO[g].nome}${ids.length > 1 ? " (sem maçarico)" : ""}`);
    avancar(i, ids.length);
  };
  const zerarHud = (l: LancheId | null) => {
    guardado.current = null;
    parar();
    setFase("montagem"); setPedido(l ? novoPedido(l) : null); setProjPed(null); setSacolaPronta(false); setFechando(false); setRodada((r) => r + 1);
    setEnsacar(false); setSacolaEstado("nada");
    animRef.current = null; feitosRef.current = 0;
    setAnimando(null); setFeitos(0); setPulados([]); setPop(null); setAnuncio(""); setSegurando(null); setSobre(false);
    bus.current.drag.ativo = false; toque.current = null;
  };
  const deNovo = () => { zerarHud(lanche ?? null); api.current?.reiniciar(); };
  const guardarPedido = (abrir = true) => {
    if (!pedido || !sacola.pronta) return false;
    if (!guardado.current || !sacola.itens.some((i) => i.id === guardado.current)) {
      const id = sacola.adicionar({ tipo: "lanche", pedido });
      if (!id) { setAnuncio("Confira as escolhas do lanche e o sabor da lata do combo antes de guardar."); return false; }
      guardado.current = id;
    }
    setAnuncio("Lanche guardado na sacola. Você pode escolher outro.");
    if (abrir) {
      escolher(null);
      void (sessaoAR.current?.sair() ?? Promise.resolve()).then(sacola.abrirSacola);
    }
    return true;
  };
  const seguirPedido = () => { setFase("bebida"); setAnuncio("Escolha a bebida"); };
  const seguir = () => {
    const ordem: FasePos[] = ["bebida", "acomp", "sacola"];
    const prox = fase === "montagem" ? null : ordem[ordem.indexOf(fase) + 1];
    if (prox) setFase(prox);
  };
  const escolher = (id: LancheId | null) => {
    zerarHud(id);
    setCongelar(null); setProj(null); setPronto(false);
    setLanche(id);
    if (id && ambiente === "ar" && ar.fase === "3d") void sessaoAR.current?.iniciar();
  };

  // ---------------------------------------------------- gesto: arrastar a ferramenta até o lanche, ou tocar
  const sobreLanche = (x: number, y: number) => {
    const z = projRef.current?.lanche;
    if (!z) return false;
    return x >= z.x0 - FOLGA && x <= z.x1 + FOLGA && y >= z.y0 - FOLGA && y <= z.y1 + FOLGA;
  };
  const gesto = (id: EstacaoId, temEstacao: boolean) => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || animRef.current || !pronto || auto || ocupadoRef.current) return;
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
  const livre = !animando && !auto && pronto && !ocupado && !bloqueioAR;
  const podePular = !!ativoDef?.opcional && livre;
  // queijo em dobro: aparece depois da primeira dose de queijo (na etapa seguinte, antes do maçarico ou da palha)
  const iQueijo = PASSOS.findIndex((p) => p.tipo === "mussarela" || p.tipo === "dog-mussarela");
  const podeDobro = fase === "montagem" && iQueijo >= 0 && feitos === iQueijo + 1 && !fim && !pulados.includes(PASSOS[iQueijo].id) && !auto;
  const nDobro = pedido?.adicionais["queijo-dobro"] ?? 0;
  const dobro = (d: number) => { if (pedido && !animando) somarAdicional(pedido, muda, setAnuncio, "queijo-dobro", d); };
  const resumoAuto = ehPao ? `${textoDasOpcoes({ ...OPCOES_PADRAO, ...Object.fromEntries(Object.entries(pedido?.opcoes ?? {}).filter(([, v]) => v)) })} · sem adicionais` : "Sem adicionais";
  return <div ref={overlay} data-testid="bancada-unificada" data-ar={emAR} className="fixed inset-0 z-[60] select-none overflow-clip text-[#fff8e7]" style={{ WebkitTouchCallout: "none", background: emAR ? "transparent" : "#120c09" }}>
    <style>{`
      @keyframes proto-pop { 0% { transform: scale(1) } 35% { transform: scale(1.42) } 65% { transform: scale(.92) } 100% { transform: scale(1) } }
      @keyframes proto-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(255,150,60,.55) } 50% { box-shadow: 0 0 0 7px rgba(255,150,60,0) } }
      @keyframes proto-sobe { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
      @keyframes proto-comanda { 0% { transform: translateY(-115%) rotate(-1.5deg) } 70% { transform: translateY(2%) rotate(.4deg) } 100% { transform: none } }
      @keyframes proto-carimbo { 0%,60% { opacity: 0; transform: rotate(-14deg) scale(2.3) } 78% { opacity: 1; transform: rotate(-14deg) scale(.92) } 100% { opacity: 1; transform: rotate(-14deg) scale(1) } }
      @keyframes proto-fechou { 0% { opacity: 0; transform: translate(-50%, 6px) scale(.7) } 25% { opacity: 1; transform: translate(-50%, -6px) scale(1.06) } 75% { opacity: 1; transform: translate(-50%, -14px) scale(1) } 100% { opacity: 0; transform: translate(-50%, -26px) scale(1) } }
      @keyframes proto-chama { 0%,100% { box-shadow: 0 0 0 0 rgba(255,170,80,.55), inset 0 0 18px rgba(255,170,80,.25) } 50% { box-shadow: 0 0 0 10px rgba(255,170,80,0), inset 0 0 26px rgba(255,170,80,.4) } }
      @media (prefers-reduced-motion: reduce) { .proto-anim { animation: none !important } }
      [data-ar="true"] [data-topo-bancada] { top:124px; }
      [data-ar="true"] [data-testid="resumo"] { top:76px; max-height:calc(100dvh - 92px); }
    `}</style>
    <LimiteCena aoFalhar={aoFalhar}>{lanche !== undefined && !semGl && <Cena aoFalhar={aoFalhar} def={def} ativo={animando || escolhendoPao ? null : ativo} reduzido={reduzido} bus={bus} api={api} aoFim={aoFim} aoProjetar={setProj} aoPronto={aoPronto} congelar={congelar}
      leve={leve} suspenso={oculto || sacola.aberta} aoProgresso={aoProgresso}
      opcoes={pedido?.opcoes ?? null} camApi={camApi} aoCamFora={setCamFora}
      modoMesa={{ estado: ar, overlay, gestos: gestosAR, sessao: sessaoAR, aoEstado: aoEstadoAR, aoDisponivel: aoXrPronto, zoom: zoomAR, giro: giroAR, aoZoom: mudarZoomAR }}
      pedido={{ fase: fase3d, atual: pedido, rodada, aoProjetar: setProjPed, aoSacola, aoOcupado, ensacar, aoSacolaEstado: setSacolaEstado }} />}</LimiteCena>

    <div ref={gestosAR} className="absolute inset-0 touch-none" style={{ pointerEvents: emAR ? "auto" : "none" }} aria-hidden="true" />
    <nav aria-label="Pedido e visualização" className={`absolute left-3 right-3 z-[10] flex items-center justify-between gap-2 ${emAR ? "top-16" : "top-[112px] min-[700px]:top-[84px]"}`}>
      <Link href={pedido ? urlDoPedido(pedido, "/cardapio") : "/cardapio"} prefetch={false} onClick={() => { void sessaoAR.current?.sair(); }} className="inline-flex min-h-11 items-center rounded-full border border-[#fff8e7]/25 bg-[#120c09]/90 px-3 text-xs text-[#fff8e7]">Modo simples</Link>
      <div className="flex items-center gap-2"><button type="button" onClick={() => setLeve((v) => !v)} aria-pressed={leve} className="min-h-11 rounded-full border border-[#fff8e7]/25 bg-[#120c09]/90 px-3 text-xs text-[#fff8e7]">{leve ? "Leve ✓" : "Modo leve"}</button><BotaoSacola aoAbrir={() => sessaoAR.current?.sair()} /></div>
    </nav>
    <div data-hud-bancada inert={!ambiente || bloqueioAR} aria-hidden={!ambiente || bloqueioAR ? true : undefined}>

    {/* câmera fora da posição padrão: volta para a frente */}
    {camFora && !emAR && def && !semGl && pronto && <button type="button" data-testid="centralizar" onClick={() => camApi.current?.centralizar()} aria-label="Centralizar a câmera"
      className={`proto-anim absolute right-3 top-[166px] z-[5] inline-flex h-9 items-center gap-1.5 rounded-full border border-[#fff8e7]/20 bg-[#120c09]/65 px-3 text-[12.5px] font-semibold text-[#fff8e7]/90 shadow-[0_6px_18px_rgba(0,0,0,.35)] backdrop-blur-md [animation:proto-sobe_.3s_ease-out] hover:bg-[#241a16] min-[700px]:right-6 min-[700px]:top-[136px] ${foco}`}>
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4"><path d="M10 3.5a6.5 6.5 0 1 1-6.1 4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M3 4.2v3.9h3.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="10" r="1.7" fill="currentColor" /></svg>
      Centralizar
    </button>}

    {/* escolha do lanche */}
    {lanche === null && <Escolha aoEscolher={escolher} />}

    {def && semGl && <SemWebGL def={def} pedido={pedido} />}

    {def && !semGl && <>
      {/* zona de soltura: acende quando a ferramenta passa sobre o lanche */}
      {lan && segurando && <div aria-hidden="true" className="pointer-events-none absolute rounded-[50%] transition-opacity duration-200"
        style={{ left: lan.x0 - FOLGA / 2, top: lan.y0 - FOLGA / 2, width: lan.x1 - lan.x0 + FOLGA, height: lan.y1 - lan.y0 + FOLGA, opacity: sobre ? 1 : 0.35,
          background: "radial-gradient(closest-side, rgba(255,190,110,.22), rgba(255,150,60,.08) 70%, transparent)" }} />}

      {/* estações: botões acessíveis sobre cada uma (só as da etapa ativa respondem); nas etapas com opções, um por opção */}
      {proj && fase === "montagem" && PASSOS.map((pd) => {
        if (pd.tipo === "turbinar") return null;
        const vez = pd.id === ativo && livre && !escolhendoPao;
        const ests = Object.keys(proj.estacoes).filter((e) => passoDe(e) === pd.id);
        if (!ests.length) {
          if (pd.tipo !== "tampa" && pd.tipo !== "dog-tampa") return null;
          if (!lan) return null;
          const style: CSSProperties = { left: lan.x0, top: lan.y0, width: lan.x1 - lan.x0, height: lan.y1 - lan.y0, borderRadius: "40%" };
          return <button key={pd.id} type="button" data-testid={`estacao-${pd.id}`} disabled={!vez} aria-label={vez ? pd.dica : pd.nome}
            className={`absolute z-[1] touch-none bg-transparent outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#e8b84a] ${vez ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={style} {...(vez ? gesto(pd.id, false) : {})} />;
        }
        return ests.map((e) => {
          const p = proj.estacoes[e];
          const op = opcaoDaEstacao(e);
          const opc = op && pd.grupo ? opcaoDe(pd.grupo, op) : null;
          const style: CSSProperties = { left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2, borderRadius: "50%" };
          return <button key={e} type="button" data-testid={opc ? `opcao-${pd.grupo}-${op}` : `estacao-${e}`} disabled={!vez}
            aria-label={opc ? `${pd.nome}: ${opc.sub}${vez ? ". Toque ou arraste até o lanche" : ""}` : vez ? pd.dica : pd.nome}
            className={`absolute z-[2] touch-none bg-transparent outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#e8b84a] ${vez ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={style} {...(vez ? gesto(e, true) : {})}>
            {opc && vez && segurando !== e && <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full mt-0.5 flex w-max max-w-[118px] -translate-x-1/2 items-center gap-1 rounded-lg bg-[#120c09]/80 px-2 py-1 text-[11px] font-semibold leading-tight text-[#fff8e7] shadow-[0_6px_16px_rgba(0,0,0,.45)] backdrop-blur-md min-[700px]:text-[12px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#fff8e7]/40" style={{ background: AMOSTRA[op!] }} />{opc.nome}
            </span>}
          </button>;
        });
      })}

      {/* topo: trilha + Monta pra mim (no pedido: trilha das fases com o total) */}
      {fase !== "montagem" && pedido && <TrilhaPedido fase={fase} pedido={pedido} />}
      {fase === "montagem" && <div data-topo-bancada className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-wrap items-start justify-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] min-[700px]:justify-between min-[700px]:px-6 min-[700px]:pt-5">
        <ol data-testid="trilha" aria-label="Camadas" className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#fff8e7]/10 bg-[#120c09]/70 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md min-[700px]:gap-2 min-[700px]:px-3 min-[700px]:py-2">
          {PASSOS.map(({ id, icone, nome }, i) => {
            const pulou = pulados.includes(id);
            const estado = i < feitos ? (pulou ? "pulada" : "feito") : i === feitos ? "ativa" : "pendente";
            const rotulo = estado === "feito" ? "feito" : estado === "pulada" ? "pulado" : estado === "ativa" ? "agora" : "depois";
            const popa = pop === i ? "proto-anim [animation:proto-pop_.5s_cubic-bezier(.3,1.6,.5,1)]" : "";
            return <li key={id} data-estado={estado} data-etapa={id} aria-label={`${nome}: ${rotulo}`}
              className={`relative grid h-9 w-9 place-items-center rounded-full transition-[background-color,opacity] duration-300 min-[700px]:h-11 min-[700px]:w-11 ${estado === "ativa" ? "proto-anim bg-[#ff6a1a]/25 ring-2 ring-[#ff9a4a] [animation:proto-pulso_1.6s_ease-in-out_infinite]" : estado === "feito" ? "bg-[#fff8e7]/10" : estado === "pulada" ? "opacity-45 grayscale" : "opacity-40 grayscale"}`}>
              {icone
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/assets/bancada/icones/${icone}.webp`} alt="" draggable={false} className={`h-7 w-7 object-contain min-[700px]:h-9 min-[700px]:w-9 ${popa}`} />
                : <IconeTurbinar className={`h-6 w-6 min-[700px]:h-7 min-[700px]:w-7 ${popa}`} />}
              {estado === "feito" && <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#e8b84a] text-[10px] font-black text-[#120c09] ${popa}`}>✓</span>}
              {estado === "pulada" && <span aria-hidden="true" className="absolute left-1.5 right-1.5 top-1/2 h-[2px] -rotate-45 rounded-full bg-[#fff8e7]/80" />}
            </li>;
          })}
        </ol>
        {!fim && <button type="button" data-testid="monta-pra-mim" onClick={auto ? parar : montaPraMim} disabled={!pronto}
          className="pointer-events-auto ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-[#fff8e7]/20 bg-[#120c09]/70 px-4 text-sm font-semibold text-[#fff8e7] shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md transition-colors hover:bg-[#241a16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b84a] disabled:opacity-50 min-[700px]:ml-0 min-[700px]:h-11 min-[700px]:px-5">
          {auto ? "Parar" : "Monta pra mim"}
        </button>}
      </div>}

      {/* toque em qualquer lugar interrompe o "Monta pra mim" */}
      {auto && <button type="button" aria-label="Parar a montagem automática" onPointerDown={parar} className="absolute inset-0 z-[4] cursor-pointer bg-transparent" />}

      {/* qual pão? (lanches de pão de alho, antes da primeira ação) */}
      {escolhendoPao && pronto && <div data-testid="escolha-pao" role="group" aria-label="Qual pão?"
        className="proto-anim absolute inset-x-0 bottom-[max(18px,env(safe-area-inset-bottom))] z-[6] flex flex-col items-center gap-2.5 px-4 text-center [animation:proto-sobe_.45s_ease-out] min-[700px]:bottom-8">
        <p className="font-hand text-[32px] leading-none text-[#fff8e7] [text-shadow:0_2px_14px_rgba(0,0,0,.85)] min-[700px]:text-[40px]">Qual pão?</p>
        <div className="flex w-full max-w-[420px] gap-2.5">
          {OPCOES.pao.map((o) => <button key={o.id} type="button" data-testid={`opcao-pao-${o.id}`} onClick={() => { escolherOpcao("pao", o.id); setAnuncio(`${o.texto}. Agora a pasta`); }}
            className={`flex flex-1 items-center gap-2.5 rounded-2xl border border-[#fff8e7]/15 bg-[#120c09]/80 px-3 py-2.5 text-left shadow-[0_14px_36px_rgba(0,0,0,.45)] backdrop-blur-md transition-colors hover:border-[#ff9a4a]/70 hover:bg-[#241a16] ${foco}`}>
            <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full border border-[#fff8e7]/25" style={{ background: AMOSTRA[o.id] }} />
            <span className="min-w-0"><span className="block font-hand text-[24px] leading-none">{o.nome}</span><span className="block text-[11.5px] leading-tight text-[#fff8e7]/70">{o.sub}</span></span>
          </button>)}
        </div>
      </div>}

      {/* dica da vez ("Pular" nas etapas opcionais, "Sem ..." nas etapas com opções, queijo em dobro depois do queijo) */}
      {!fim && pronto && !escolhendoPao && !turbinando && <div key={ativo ?? "x"} className={`proto-anim pointer-events-none absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] z-[5] flex flex-col items-center gap-2 px-6 text-center [animation:proto-sobe_.45s_ease-out] transition-opacity duration-300 min-[700px]:bottom-8 ${animando ? "opacity-0" : "opacity-100"}`}>
        <p className="font-hand text-[30px] leading-[1.05] text-[#fff8e7] [text-shadow:0_2px_14px_rgba(0,0,0,.85)] min-[700px]:text-[38px]">
          {auto ? "Montando pra você… toque pra parar" : dica}
        </p>
        {auto && <p data-testid="dica-auto" className="max-w-[420px] text-[12.5px] leading-snug text-[#fff8e7]/85 [text-shadow:0_1px_8px_rgba(0,0,0,.9)]">{resumoAuto}</p>}
        {podePular && <button type="button" data-testid="pular" onClick={pular}
          className={`pointer-events-auto rounded-full border border-[#fff8e7]/25 bg-[#120c09]/55 px-4 py-1.5 text-sm font-semibold text-[#fff8e7]/85 backdrop-blur-md transition-colors hover:bg-[#241a16] hover:text-[#fff8e7] ${foco}`}>
          Pular
        </button>}
        {ativoDef?.grupo && livre && <button type="button" data-testid={`opcao-${ativoDef.grupo}-sem`} onClick={semOpcao}
          className={`pointer-events-auto rounded-full border border-[#fff8e7]/25 bg-[#120c09]/55 px-4 py-1.5 text-sm font-semibold text-[#fff8e7]/85 backdrop-blur-md transition-colors hover:bg-[#241a16] hover:text-[#fff8e7] ${foco}`}>
          {SEM_OPCAO[ativoDef.grupo].nome}{ativoDef.grupo === "queijo" && PASSOS[feitos + 1]?.tipo === "macarico" ? " (sem maçarico)" : ""}
        </button>}
        {podeDobro && <div className="pointer-events-auto flex items-center gap-1.5">
          {nDobro > 0 && <button type="button" data-testid="queijo-dobro-menos" onClick={() => dobro(-1)} disabled={!livre} aria-label={`Tirar uma camada de ${ADICIONAIS["queijo-dobro"].nome}`}
            className={`grid h-9 w-9 place-items-center rounded-full border border-[#fff8e7]/25 bg-[#120c09]/60 text-lg font-bold text-[#fff8e7] backdrop-blur-md hover:bg-[#241a16] disabled:opacity-50 ${foco}`}>−</button>}
          <button type="button" data-testid="queijo-dobro" onClick={() => dobro(1)} disabled={!livre || nDobro >= ADICIONAIS["queijo-dobro"].max}
            aria-label={`Queijo em dobro, mais uma camada, ${brl(ADICIONAIS["queijo-dobro"].preco)}${nDobro ? `, ${nDobro} no lanche` : ""}`}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-[#ff9a4a] bg-[#ff6a1a]/25 px-4 text-sm font-semibold text-[#fff8e7] backdrop-blur-md hover:bg-[#ff6a1a]/40 disabled:opacity-50 ${foco}`}>
            + Queijo em dobro ({brl(ADICIONAIS["queijo-dobro"].preco)}){nDobro > 0 && <span className="rounded-full bg-[#e8b84a] px-1.5 text-[11px] font-black text-[#120c09]">×{nDobro}</span>}
          </button>
        </div>}
      </div>}

      {/* Turbinar, dentro do lanche, antes da tampa */}
      {turbinando && pronto && pedido && !auto && <PainelTurbinar pedido={pedido} muda={muda} proj={projPed} zona={lan ?? null} bus={bus} anunciar={setAnuncio} aoFechar={fecharLanche} fechando={fechando} />}

      {/* fim */}
      {fim && !animando && fase === "montagem" && <div data-testid="pronto" role="status"
        className="proto-anim absolute inset-x-4 bottom-[max(18px,env(safe-area-inset-bottom))] z-[6] mx-auto max-w-[420px] rounded-2xl bg-[#fff8e7]/95 px-5 py-4 text-[#120c09] shadow-[0_18px_50px_rgba(0,0,0,.5)] [animation:proto-sobe_.5s_cubic-bezier(.2,1.3,.4,1)] min-[700px]:bottom-8">
        <p className="font-hand text-[27px] leading-none text-[#c2410c] min-[700px]:text-[32px]">Ficou com capricho!</p>
        <p className="mt-1 text-sm text-[#5c3d2e]">{def.fim}</p>
        {pedido?.opcoes && <p data-testid="pronto-opcoes" className="mt-1 text-[12.5px] leading-snug text-[#7a5a48]">{textoDasOpcoes(pedido.opcoes)}</p>}
        <button type="button" data-testid="seguir-pedido" onClick={seguirPedido}
          className="mt-3 w-full rounded-full bg-[#ff6a1a] px-4 py-2.5 text-sm font-bold text-[#120c09] transition-colors hover:bg-[#ff8a3d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Escolher bebida e porção</button>
        <button type="button" onClick={() => guardarPedido()} disabled={!sacola.pronta} className="mt-2 min-h-11 w-full rounded-full border border-[#120c09]/25 px-4 py-2 text-sm font-semibold">{guardado.current ? "Ver minha sacola" : "Adicionar só o lanche à sacola"}</button>
        <div className="mt-2 flex gap-2">
          <button type="button" data-testid="montar-de-novo" onClick={deNovo}
            className="flex-1 rounded-full bg-[#120c09] px-4 py-2.5 text-sm font-semibold text-[#fff8e7] transition-colors hover:bg-[#2a1d18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Montar de novo</button>
          <button type="button" data-testid="outro-lanche" onClick={() => escolher(null)}
            className="flex-1 rounded-full border border-[#120c09]/25 px-4 py-2.5 text-sm font-semibold text-[#120c09] transition-colors hover:bg-[#120c09]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Outro lanche</button>
        </div>
      </div>}

      {fase !== "montagem" && pedido && <PedidoHud fase={fase} pedido={pedido} muda={muda} proj={projPed} zona={lan ?? null}
        aoSeguir={seguir} sacolaPronta={sacolaPronta} aoOutro={() => { if (guardarPedido(false)) escolher(null); }} anunciar={setAnuncio}
        aoGuardar={() => guardarPedido()} guardado={!!guardado.current}
        sacolaEstado={sacolaEstado} aoEnsacar={() => { setEnsacar(true); setAnuncio("Lanche na sacola"); }} />}

      {!pronto && <div className="absolute inset-0 z-[7] grid place-items-center bg-[#120c09]/70 backdrop-blur-sm">
        <div className="mx-4 max-w-sm rounded-3xl border border-[#fff8e7]/15 bg-[#120c09]/95 p-6 text-center" role="status"><Image src={restaurante.logo} alt={restaurante.nome} width={96} height={96} className="mx-auto h-24 w-24 object-contain" /><p className="mt-4 font-hand text-3xl">Preparando a bancada…</p><progress className="mt-4 h-2 w-full accent-[#ff6a1a]" max={100} value={progresso} aria-label="Carregamento da bancada" /><p className="mt-3 text-xs leading-5 text-[#fff8e7]/70">Seu pedido continua salvo. Se preferir, escolha sem animações.</p><Link href={pedido ? urlDoPedido(pedido, "/cardapio") : "/cardapio"} prefetch={false} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#ff6a1a] px-5 text-sm font-bold text-[#120c09]">Abrir modo simples</Link></div>
      </div>}
    </>}
    </div>
    {!ambiente && <EntradaMesa suporte={suporteAR} pronto={xrPronto} aoEscolher={escolherAmbiente} />}
    {ambiente && <ControlesMesa estado={ar} sessao={sessaoAR} zoom={zoomAR} aoZoom={mudarZoomAR} aoGirar={() => setGiroAR((v) => v + Math.PI / 6)} />}
    {ambiente && ar.fase === "3d" && ar.mensagem !== ESTADO_3D.mensagem && <div role="status" className="absolute inset-x-4 top-28 z-30 mx-auto max-w-sm rounded-2xl bg-[#120c09]/95 p-4 text-center text-sm">
      <p>{ar.mensagem}</p><button className="mt-2 rounded-full border border-[#ffcf8a]/50 px-4 py-2" onClick={() => setAR(ESTADO_3D)}>Continuar na bancada</button>
    </div>}
    <p aria-live="polite" className="sr-only">{anuncio}</p>
  </div>;
}

/** Ícone da etapa Turbinar na trilha (não há WebP para ela): um potinho com um "+". */
function IconeTurbinar({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <path d="M5 15h22l-2.2 9.2A3 3 0 0 1 21.9 27H10.1a3 3 0 0 1-2.9-2.8L5 15z" fill="#5a3a26" stroke="#ffcf8a" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="11" cy="13" r="2.6" fill="#b5462a" /><circle cx="16.5" cy="11.6" r="2.8" fill="#d99a3c" /><circle cx="21.5" cy="13.2" r="2.4" fill="#7a1a12" />
    <path d="M16 3.5v7M12.5 7h7" stroke="#ff9a4a" strokeWidth="2.4" strokeLinecap="round" />
  </svg>;
}

/** Tela leve de escolha: os 4 lanches sobre o fundo da cozinha. */
function Escolha({ aoEscolher }: { aoEscolher: (id: LancheId) => void }) {
  return <div className="proto-anim absolute inset-0 z-[8] flex flex-col items-center justify-center gap-5 overflow-y-auto bg-[#120c09]/55 px-4 py-8 backdrop-blur-[2px] [animation:proto-sobe_.45s_ease-out] min-[700px]:gap-8">
      <Image src={restaurante.logo} alt={`${restaurante.nome} — ${restaurante.subtitulo}`} width={128} height={128} className="h-28 w-28 shrink-0 object-contain" priority />
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

/** Aviso leve quando o WebGL não está disponível: a foto do lanche e o caminho para a bancada clássica. */
function SemWebGL({ def, pedido }: { def: LancheDef; pedido: Pedido | null }) {
  return <div data-testid="sem-webgl" role="alert" className="absolute inset-0 z-[8] grid place-items-center overflow-y-auto bg-[#120c09]/70 px-4 py-8">
    <div className="flex w-full max-w-[380px] flex-col items-center gap-3 rounded-2xl border border-[#fff8e7]/12 bg-[#120c09]/85 p-5 text-center shadow-[0_14px_36px_rgba(0,0,0,.45)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={def.foto} alt={def.nome} draggable={false} className="aspect-square w-full max-w-[240px] rounded-xl object-cover" />
      <p className="font-hand text-[28px] leading-none text-[#fff8e7]">Vamos continuar no modo simples</p>
      <p className="text-sm text-[#fff8e7]/80">O 3D não abriu neste aparelho. Estamos levando suas escolhas para o cardápio.</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Link href={pedido ? urlDoPedido(pedido, "/cardapio") : "/cardapio"} prefetch={false} data-testid="ir-classica" className="grid h-11 w-full place-items-center rounded-full bg-[#ff6a1a] text-sm font-bold text-[#120c09] transition-colors hover:bg-[#ff8a3d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]">Continuar no modo simples</Link>
      </div>
    </div>
  </div>;
}

class LimiteCena extends Component<{ children: ReactNode; aoFalhar: () => void }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  componentDidCatch() { this.props.aoFalhar(); }
  render() { return this.state.falhou ? null : this.props.children; }
}
