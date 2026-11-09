"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Hand, MapPin, Minus, Pause, Play, Plus, RotateCcw, RotateCw, ScanLine, Share2, SlidersHorizontal, UtensilsCrossed, X } from "lucide-react";
import { LANCHES, ORDEM_LANCHES, ehLanche, opcaoDaEstacao, passoDe, type LancheId } from "../bancada-proto/layout";
import { BEBIDAS, LANCHES_PRECO, OPCOES, OPCOES_PADRAO, PORCOES, SABORES_LATA, SABORES_SODA, SEM_OPCAO, brl, novoPedido, totalDoPedido, type Bebida, type GrupoOpcao, type Pedido, type PorcaoId, type SaborLata, type SaborSoda } from "../bancada-proto/cardapio";
import type { ApiCena, Bus, Modo as ModoAcao, Projecao } from "../bancada-proto/Cena";
import { ESTADO_3D, type SessaoMesa, type EstadoAR } from "./sessao";
import { sequencia, estacao } from "./sequencia";
import { pedidoDaURL, urlDoPedido } from "@/lib/pedido-url";
import styles from "./ar.module.css";
import Ingredientes from "./Ingredientes";

const CenaAR = dynamic(() => import("./CenaAR"), { ssr: false });
type Modo = "pronto" | "assistir" | "etapas";
const MODOS: { id: Modo; nome: string; icone: typeof Play }[] = [
  { id: "pronto", nome: "Pronto", icone: UtensilsCrossed },
  { id: "assistir", nome: "Assistir", icone: Play },
  { id: "etapas", nome: "Montar", icone: Hand },
];
const nomeBebida = (b: Bebida | null) => !b ? "Sem bebida" : b.id === "lata" ? SABORES_LATA[b.sabor].nome
  : b.id === "soda" ? `Soda de ${SABORES_SODA[b.sabor].nome}` : "Chopp Lohn 500 ml";
const pedidoInicial = (id: LancheId) => ({ ...novoPedido(id), opcoes: id === "dogalho" ? null : { ...OPCOES_PADRAO } });

export default function ExperienciaAR() {
  const [pedido, setPedido] = useState<Pedido>(() => pedidoInicial("costela"));
  const [modo, setModo] = useState<Modo>("pronto");
  const [rodada, setRodada] = useState(0);
  const [carregado, setCarregado] = useState(false);
  const [lendoURL, setLendoURL] = useState(true);
  const [etapa, setEtapa] = useState(0);
  const [animando, setAnimando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [painel, setPainel] = useState(false);
  const [secao, setSecao] = useState<"lanche" | "sabores" | "mesa">("lanche");
  const [suporte, setSuporte] = useState<boolean | null>(null);
  const [ar, setAR] = useState<EstadoAR>(ESTADO_3D);
  const [giro, setGiro] = useState(0);
  const [zoom, setZoom] = useState(1);
  const mudarZoom = useCallback((valor: number) => setZoom(Math.max(0.5, Math.min(2.5, valor))), []);
  const [reduzido, setReduzido] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [aviso, setAviso] = useState("");
  const [proj, setProj] = useState<Projecao | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const gestosAR = useRef<HTMLDivElement>(null);
  const api = useRef<ApiCena | null>(null);
  const sessao = useRef<SessaoMesa | null>(null);
  const bus = useRef<Bus>({ drag: { ativo: false, id: null, x: 0, y: 0 } });
  const emAcao = useRef(false);
  const def = LANCHES[pedido.lanche];
  const passos = useMemo(() => sequencia(def, pedido.opcoes), [def, pedido.opcoes]);
  const emAR = ar.fase !== "3d" && ar.fase !== "iniciando";
  const ajustando = ar.fase === "ajustando";
  const buscando = emAR && ar.fase !== "colocado" && !ajustando;
  const bloquearAnimacao = pausado || oculto || ar.fase === "iniciando" || (emAR && (buscando || ajustando || !ar.rastreando));
  const terminou = etapa >= passos.length;
  const mostrarPronto = modo === "pronto" || terminou;
  const aoPronto = useCallback(() => setCarregado(true), []);
  const aoFalhar = useCallback(() => setFalhou(true), []);
  const aoFim = useCallback(() => { emAcao.current = false; setAnimando(false); setEtapa((v) => v + 1); }, []);
  const interativo = modo === "etapas" && !terminou && !animando && !bloquearAnimacao && carregado;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("lanche");
    if (ehLanche(id)) {
      const lido = pedidoDaURL(q, id);
      setPedido({ ...lido, opcoes: lido.opcoes ? { ...OPCOES_PADRAO, ...Object.fromEntries(Object.entries(lido.opcoes).filter(([, v]) => v !== null)) } : null });
    }
    const m = q.get("modo");
    if (m === "assistir" || m === "etapas") setModo(m);
    setLendoURL(false);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const atualizar = () => setReduzido(media.matches);
    const visibilidade = () => setOculto(document.hidden);
    atualizar(); media.addEventListener("change", atualizar);
    document.addEventListener("visibilitychange", visibilidade);
    let vivo = true;
    const xr = navigator.xr;
    if (window.isSecureContext && xr) void xr.isSessionSupported("immersive-ar").then((v) => { if (vivo) setSuporte(v); }).catch(() => { if (vivo) setSuporte(false); });
    else setSuporte(false);
    const elemento = overlay.current;
    const bloquearToqueXR = (e: Event) => e.preventDefault();
    elemento?.addEventListener("beforexrselect", bloquearToqueXR);
    const cabecalho = document.querySelector<HTMLElement>("body > header");
    const inerteAntes = cabecalho?.inert;
    if (cabecalho) cabecalho.inert = true;
    return () => {
      vivo = false; media.removeEventListener("change", atualizar);
      document.removeEventListener("visibilitychange", visibilidade);
      elemento?.removeEventListener("beforexrselect", bloquearToqueXR);
      if (cabecalho) cabecalho.inert = inerteAntes ?? false;
    };
  }, []);
  useEffect(() => {
    if (lendoURL) return;
    history.replaceState(null, "", `${urlDoPedido(pedido, "/ar")}&modo=${modo}`);
  }, [pedido, modo, lendoURL]);
  useEffect(() => {
    if (carregado && modo === "pronto") api.current?.mostrarPronto(pedido.opcoes);
  }, [carregado, modo, pedido.opcoes]);
  useEffect(() => {
    if (!carregado || modo !== "assistir" || terminou || animando || bloquearAnimacao) return;
    const timer = setTimeout(() => {
      if (!api.current) return;
      emAcao.current = true; setAnimando(true); api.current.acao(estacao(passos[etapa], pedido.opcoes), "auto");
    }, 350);
    return () => clearTimeout(timer);
  }, [carregado, modo, terminou, animando, bloquearAnimacao, passos, etapa, pedido.opcoes]);

  const reiniciar = (m: Modo = modo) => {
    bus.current.drag.ativo = false; emAcao.current = false; setProj(null);
    api.current = null; setCarregado(false); setAnimando(false); setEtapa(0); setPausado(false);
    setModo(m); setRodada((v) => v + 1);
  };
  const escolher = (id: LancheId) => {
    if (id === pedido.lanche) return;
    setPedido((p) => ({ ...pedidoInicial(id), bebida: p.bebida, porcao: p.porcao }));
    setGiro(0); reiniciar("pronto"); setAviso("");
  };
  const escolherOpcao = (grupo: GrupoOpcao, valor: string) => {
    setPedido((p) => ({ ...p, opcoes: p.opcoes ? { ...p.opcoes, [grupo]: valor } : null }));
    reiniciar("pronto");
  };
  const usarIngrediente = (id: string, acao: ModoAcao) => {
    if (!api.current || emAcao.current || terminou || bloquearAnimacao || !carregado || passoDe(id) !== passos[etapa].id) return;
    const grupo = passos[etapa].grupo, opcao = opcaoDaEstacao(id);
    if (grupo && opcao) setPedido((p) => ({ ...p, opcoes: p.opcoes ? { ...p.opcoes, [grupo]: opcao } : null }));
    emAcao.current = true; setAnimando(true); api.current.acao(id, acao);
  };
  const avancar = () => usarIngrediente(estacao(passos[etapa], pedido.opcoes), "toque");
  const abrirAR = () => {
    if (!sessao.current || !carregado) return;
    setZoom(1);
    if (modo !== "pronto") reiniciar(modo);
    setPainel(false); setAviso(""); void sessao.current.iniciar();
  };
  const compartilhar = async () => {
    const url = new URL(urlDoPedido(pedido, "/ar"), window.location.origin);
    try {
      if (navigator.share) await navigator.share({ title: `${def.nome} — Alhoaria`, url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); setAviso("Link do lanche copiado."); }
    } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setAviso("Não foi possível compartilhar agora. O endereço desta página também abre o lanche."); }
  };

  return <div className={styles.pagina} data-testid="experiencia-ar" data-ar={emAR} data-ajustando={ajustando}>
    <div className={styles.fundo} aria-hidden="true" />
    <Limite3D falhar={aoFalhar}>
      {!lendoURL && !falhou && <CenaAR def={def} rodada={rodada} pronto={mostrarPronto} pausado={bloquearAnimacao} reduzido={reduzido}
        ativo={modo !== "pronto" && !terminou ? passos[etapa].id : null} opcoes={pedido.opcoes} bebida={pedido.bebida} porcao={pedido.porcao}
        ar={ar} giro={giro} zoom={zoom} aoZoom={mudarZoom} painelAberto={painel} overlay={overlay} gestosAR={gestosAR} api={api} sessao={sessao}
        bus={bus} interativo={interativo} estacao={interativo ? estacao(passos[etapa], pedido.opcoes) : undefined} aoProjetar={setProj}
        aoPronto={aoPronto} aoFim={aoFim} aoEstadoAR={setAR} aoFalhar={aoFalhar} />}
    </Limite3D>
    <div ref={overlay} className={styles.overlay} data-testid="ar-overlay">
      <div ref={gestosAR} className={styles.areaGestos} style={{ pointerEvents: emAR ? "auto" : "none" }} aria-hidden="true" />
      <header className={styles.topo}>
        <Link href={urlDoPedido(pedido)} className={styles.marca} aria-label="Voltar para a bancada" onClick={() => { void sessao.current?.sair(); }}>
          <ArrowLeft size={17} /><span>ALHOARIA<small>na sua mesa</small></span>
        </Link>
        <div className={styles.topoAcoes}>
          <span className={styles.selo}><span />{emAR ? ar.manual ? "Posição manual" : "Na sua mesa" : "Explorar em 3D"}</span>
          {!emAR && <button className={styles.icone} onClick={compartilhar} aria-label="Compartilhar este lanche"><Share2 size={18} /></button>}
          {emAR && <button className={styles.icone} onClick={() => { void sessao.current?.sair(); }} aria-label="Sair da realidade aumentada"><X size={18} /></button>}
        </div>
      </header>

      <div className={styles.apresentacao}>
        <p className={styles.sobrancelha}>{emAR ? "UM POUCO DE ALHO. BASTANTE PRESENÇA." : "PODE OLHAR DE PERTINHO"}</p>
        <h1>{def.nome}</h1>
        <p>{modo === "pronto" ? "Do nosso pão de alho para a sua mesa." : modo === "assistir" ? "Veja cada camada ganhar seu lugar." : "Toque ou arraste o ingrediente destacado."}</p>
      </div>

      {falhou ? <section className={styles.erro} role="alert">
        <img src={def.foto} alt={def.nome} />
        <h2>Vamos pela bancada?</h2><p>O 3D não abriu neste aparelho. Você ainda pode conhecer e montar os lanches.</p>
        <Link className={styles.primario} href={`/bancada/classica?lanche=${pedido.lanche}`}>Abrir bancada clássica</Link>
        <button className={styles.secundario} onClick={() => window.location.reload()}>Tentar o 3D novamente</button>
      </section> : <>
        {!carregado && <div className={styles.carregando} role="status"><span /><p>Caprichando no seu lanche…</p></div>}
        {interativo && proj && !painel && <Ingredientes proj={proj} passo={passos[etapa]} opcoes={pedido.opcoes} bus={bus} api={api} aoUsar={usarIngrediente} />}
        {!ajustando && <div className={styles.ferramentas} role="group" aria-label="Zoom e rotação">
          <button className={styles.icone} aria-label="Aumentar zoom" onClick={() => mudarZoom(zoom * 1.2)} disabled={!carregado || zoom >= 2.5}><Plus size={20} /></button>
          <button className={`${styles.icone} ${styles.percentualZoom}`} onClick={() => setZoom(1)} disabled={!carregado} aria-label={`Restaurar zoom para 100%. Zoom atual: ${Math.round(zoom * 100)}%`} title="Restaurar zoom">{Math.round(zoom * 100)}%</button>
          <button className={styles.icone} aria-label="Diminuir zoom" onClick={() => mudarZoom(zoom / 1.2)} disabled={!carregado || zoom <= 0.5}><Minus size={20} /></button>
          <button className={styles.icone} aria-label="Girar lanche para a esquerda" onClick={() => setGiro((g) => g - Math.PI / 6)} disabled={!carregado}><RotateCcw size={19} /></button>
          <button className={styles.icone} aria-label="Girar lanche para a direita" onClick={() => setGiro((g) => g + Math.PI / 6)} disabled={!carregado}><RotateCw size={19} /></button>
          {emAR && <button className={styles.icone} onClick={() => { sessao.current?.reposicionar(); setPainel(false); }} aria-label="Escolher outro lugar"><MapPin size={19} /></button>}
        </div>}

        <section className={styles.rodape} aria-label="Controles do lanche">
          {ajustando ? <div className={styles.ajusteManual} aria-label="Ajustar posição manual">
            <h2>Ajuste na sua mesa</h2>
            <p>Encoste a tábua na mesa usando a altura.</p>
            <label><span>Mais baixo</span><input type="range" min="-0.6" max="0.6" step="0.02" value={ar.ajusteAltura}
              aria-label="Altura do lanche" disabled={!ar.rastreando} onChange={(e) => sessao.current?.ajustarAltura(Number(e.target.value))} /><span>Mais alto</span></label>
            <label><span>Mais perto</span><input type="range" min="0.35" max="1.5" step="0.05" value={ar.ajusteDistancia}
              aria-label="Distância do lanche" disabled={!ar.rastreando} onChange={(e) => sessao.current?.ajustarDistancia(Number(e.target.value))} /><span>Mais longe</span></label>
            <button className={styles.primario} disabled={!ar.rastreando} onClick={() => sessao.current?.confirmarManual()}><Check size={18} />Pronto, ficou bom</button>
            {!ar.rastreando && <p role="status">{ar.mensagem}</p>}
          </div> : <>
          <div className={styles.modos} role="group" aria-label="Modo de visualização">
            {MODOS.map(({ id, nome, icone: Icone }) => <button key={id} aria-pressed={modo === id} onClick={() => reiniciar(id)}><Icone size={16} />{nome}</button>)}
          </div>

          {modo !== "pronto" && <div className={styles.montagem}>
            <div className={styles.progresso} aria-hidden="true"><span style={{ width: `${(etapa / passos.length) * 100}%` }} /></div>
            <div><span>{terminou ? "Feito com capricho!" : `${etapa + 1}/${passos.length} · ${passos[etapa].nome}`}</span>
              {terminou ? <button onClick={() => reiniciar()} aria-label="Repetir montagem"><RotateCcw size={16} />Repetir</button>
                : modo === "assistir" ? <button onClick={() => setPausado((p) => !p)} disabled={!carregado}>{pausado ? <Play size={16} /> : <Pause size={16} />}{pausado ? "Continuar" : "Pausar"}</button>
                  : <button onClick={avancar} disabled={!carregado || animando || bloquearAnimacao}><Hand size={16} />{animando ? "Montando…" : "Fazer etapa"}</button>}
            </div>
            {modo === "etapas" && !terminou && <div className={styles.dicaMontagem}>
              <p>{animando ? "Preparando esta camada…" : passos[etapa].tipo === "tampa" || passos[etapa].tipo === "dog-tampa" ? "Toque no pão destacado para fechar." : "Toque no ingrediente destacado ou arraste até o lanche."}</p>
              {!animando && passos[etapa].grupo && <div className={styles.chips} aria-label={`Opções de ${passos[etapa].nome}`}>
                {OPCOES[passos[etapa].grupo!].map((o) => <button key={o.id} aria-pressed={pedido.opcoes?.[passos[etapa].grupo!] === o.id}
                  onClick={() => { const g = passos[etapa].grupo!; setPedido((p) => ({ ...p, opcoes: p.opcoes ? { ...p.opcoes, [g]: o.id } : null })); }}>{o.nome}</button>)}
              </div>}
            </div>}
          </div>}

          {!emAR && (modo === "pronto" || suporte !== false) && <button className={modo === "pronto" ? styles.primario : styles.secundario} onClick={suporte === false ? compartilhar : abrirAR} disabled={!carregado || suporte === null || ar.fase === "iniciando"}>
            {suporte === false ? <Share2 size={20} /> : <ScanLine size={20} />}{ar.fase === "iniciando" ? "Abrindo a câmera…" : suporte === false ? "Compartilhar este lanche" : "Ver na minha mesa"}
          </button>}
          {!emAR && modo === "pronto" && <p className={styles.nota}>{suporte === null ? "Conferindo a realidade aumentada deste aparelho…"
            : suporte ? "Sem aplicativo. Abra a câmera e ajuste a posição."
              : "Explore em 3D aqui. Para usar a câmera, abra no Chrome de um Android compatível com AR."}</p>}
          {emAR && buscando && <>
            <button className={styles.primario} onClick={() => { setPainel(false); sessao.current?.colocarManualmente(); }} disabled={!ar.podeManual}><MapPin size={20} />Posicionar manualmente</button>
            {ar.fase === "superficie" && <button className={styles.secundario} onClick={() => sessao.current?.colocar()} disabled={!ar.rastreando}>Usar ponto detectado</button>}
          </>}
          {emAR && !buscando && <button className={styles.secundario} onClick={() => { setPainel(false); sessao.current?.editarPosicao(); }} disabled={!ar.rastreando}><SlidersHorizontal size={17} />Ajustar posição</button>}
          {((!emAR && ar.mensagem !== ESTADO_3D.mensagem) || emAR) && <p className={styles.nota} role="status">{ar.mensagem}</p>}
          {aviso && <p className={styles.nota} role="status">{aviso}</p>}
          </>}
        </section>

        {!ajustando && <aside className={`${styles.painel} ${painel ? styles.aberto : ""}`} aria-label="Personalizar lanche">
          <button className={styles.abrirPainel} aria-expanded={painel} aria-controls="opcoes-ar" onClick={() => setPainel((v) => !v)}>
            <SlidersHorizontal size={18} /><span>Do seu jeito<small>{nomeBebida(pedido.bebida)}{pedido.porcao ? ` · ${PORCOES[pedido.porcao].nome}` : ""}</small></span>
            <ChevronDown size={18} />
          </button>
          <div id="opcoes-ar" hidden={!painel}>
            <div className={styles.abas} role="group" aria-label="Categorias de opções">
              {([ ["lanche", "Lanches"], ["sabores", "Sabores"], ["mesa", "Na mesa"] ] as const).map(([id, nome]) => <button key={id} aria-pressed={secao === id} onClick={() => setSecao(id)}>{nome}</button>)}
            </div>
            <div className={styles.conteudoPainel}>
              {secao === "lanche" && <div className={styles.listaLanches}>{ORDEM_LANCHES.map((id) => <button key={id} aria-pressed={pedido.lanche === id} onClick={() => escolher(id)}>
                <img src={LANCHES[id].foto} alt="" /><span>{LANCHES[id].nome}<small>{brl(LANCHES_PRECO[id].preco)}</small></span>{pedido.lanche === id && <Check size={17} />}
              </button>)}</div>}
              {secao === "sabores" && (pedido.opcoes ? <>{(["pao", "pasta", "creme", "queijo"] as GrupoOpcao[]).map((g) => <fieldset key={g} className={styles.grupo}>
                <legend>{{ pao: "O pão", pasta: "Pasta de alho", creme: "Creme", queijo: "Queijo gratinado" }[g]}</legend>
                <div className={styles.chips}>{OPCOES[g].map((o) => <button key={o.id} aria-pressed={pedido.opcoes?.[g] === o.id} onClick={() => escolherOpcao(g, o.id)}>{o.nome}</button>)}
                  {g !== "pao" && <button aria-pressed={pedido.opcoes?.[g] === "sem"} onClick={() => escolherOpcao(g, "sem")}>{SEM_OPCAO[g].nome}</button>}</div>
              </fieldset>)}<p className={styles.ajuda}>Ao mudar um sabor, mostramos o lanche pronto. Você pode assistir à nova montagem.</p></>
                : <p className={styles.ajuda}>O Dogalho tem sua receita própria: brioche, pasta, duas salsichas, molhos, fondue, muçarela e batata palha.</p>)}
              {secao === "mesa" && <>
                <fieldset className={styles.grupo}><legend>Para acompanhar</legend><div className={styles.chips}>
                  <button aria-pressed={!pedido.bebida} onClick={() => setPedido((p) => ({ ...p, bebida: null }))}>Sem bebida</button>
                  {Object.entries(BEBIDAS).map(([id, b]) => <button key={id} aria-pressed={pedido.bebida?.id === id} onClick={() => setPedido((p) => ({ ...p, bebida: id === "lata" ? { id, sabor: "coca" } : id === "soda" ? { id, sabor: "frutas-vermelhas" } : { id: "chopp" } }))}>{b.curto}</button>)}
                </div></fieldset>
                {pedido.bebida?.id === "lata" && <fieldset className={styles.grupo}><legend>Seu refri</legend><div className={styles.chips}>{Object.entries(SABORES_LATA).map(([id, b]) => <button key={id} aria-pressed={pedido.bebida?.id === "lata" && pedido.bebida.sabor === id} onClick={() => setPedido((p) => ({ ...p, bebida: { id: "lata", sabor: id as SaborLata } }))}>{b.nome}</button>)}</div><p className={styles.ajuda}>Latas ilustrativas, sem rótulo.</p></fieldset>}
                {pedido.bebida?.id === "soda" && <fieldset className={styles.grupo}><legend>Sabor da soda</legend><div className={styles.chips}>{Object.entries(SABORES_SODA).map(([id, b]) => <button key={id} aria-pressed={pedido.bebida?.id === "soda" && pedido.bebida.sabor === id} onClick={() => setPedido((p) => ({ ...p, bebida: { id: "soda", sabor: id as SaborSoda } }))}>{b.nome}</button>)}</div></fieldset>}
                <fieldset className={styles.grupo}><legend>Uma porção?</legend><div className={styles.chips}><button aria-pressed={!pedido.porcao} onClick={() => setPedido((p) => ({ ...p, porcao: null }))}>Sem porção</button>{Object.entries(PORCOES).map(([id, p]) => <button key={id} aria-pressed={pedido.porcao === id} onClick={() => setPedido((p) => ({ ...p, porcao: id as PorcaoId }))}>{p.nome}</button>)}</div></fieldset>
                <p className={styles.ajuda}>Confira preços e disponibilidade na loja. Porções com preço a partir de.</p>
              </>}
            </div>
            <div className={styles.total}><span>A partir de <strong>{brl(totalDoPedido(pedido))}</strong></span><Link href={urlDoPedido(pedido)} onClick={() => { void sessao.current?.sair(); }}>Montar pedido <ChevronRight size={15} /></Link></div>
          </div>
        </aside>}

        {!painel && !emAR && modo === "pronto" && <nav className={styles.seletor} aria-label="Escolher lanche">
          <button className={styles.seta} aria-label="Lanche anterior" onClick={() => escolher(ORDEM_LANCHES[(ORDEM_LANCHES.indexOf(pedido.lanche) + ORDEM_LANCHES.length - 1) % ORDEM_LANCHES.length])}><ChevronLeft size={20} /></button>
          {ORDEM_LANCHES.map((id) => <button key={id} aria-label={LANCHES[id].nome} aria-pressed={pedido.lanche === id} onClick={() => escolher(id)}><img src={LANCHES[id].foto} alt="" /><span>{id === "costela" ? "Costela" : id === "pulled" ? "Pulled" : id === "brocolis" ? "Brócolis" : "Dogalho"}</span></button>)}
          <button className={styles.seta} aria-label="Próximo lanche" onClick={() => escolher(ORDEM_LANCHES[(ORDEM_LANCHES.indexOf(pedido.lanche) + 1) % ORDEM_LANCHES.length])}><ChevronRight size={20} /></button>
        </nav>}
      </>}
    </div>
    <p aria-live="polite" className="sr-only">{modo === "pronto" ? `${def.nome}, pronto.` : terminou ? "Montagem concluída." : `Etapa ${etapa + 1}: ${passos[etapa].nome}`}</p>
  </div>;
}

class Limite3D extends Component<{ children: ReactNode; falhar: () => void }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch() { this.props.falhar(); }
  render() { return this.state.erro ? null : this.props.children; }
}
