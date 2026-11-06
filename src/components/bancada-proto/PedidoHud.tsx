"use client";

// HUD do pedido: o painel da etapa Turbinar (dentro da montagem, antes da tampa) e, depois do lanche pronto, a trilha
// com o total, rótulos tocáveis sobre as bebidas/porções da cena, painéis de cada fase e o resumo com o WhatsApp.
import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import {
  ADICIONAIS, AVISO, BEBIDAS, LANCHES_PRECO, ORDEM_BEBIDAS, ORDEM_PORCOES, ORDEM_SABORES_LATA, ORDEM_SABORES_SODA, POTINHOS,
  ORDEM_SEPARADOS, PORCOES, SABORES_LATA, SABORES_SODA, SEPARADOS, brl, economiaDoTrio, linkWhatsApp, linhasDoPedido, saborDaLataDoCombo, textoDoPedido,
  totalDoPedido, trioDe, type AdicionalId, type BebidaId, type Pedido, type PorcaoId, type SaborLata, type SaborSoda, type SeparadoId,
} from "./cardapio";
import type { FasePedido, ProjPedido } from "./Pedido3D";

export type Zona = { x0: number; y0: number; x1: number; y1: number } | null;
export type Muda = (f: (p: Pedido) => Pedido) => void;
/** Fases depois do lanche pronto. */
export type FasePos = Exclude<FasePedido, "montagem" | "turbinar">;

const FASES: { id: FasePos; nome: string }[] = [
  { id: "bebida", nome: "Bebida" },
  { id: "acomp", nome: "Acompanhamento" },
  { id: "sacola", nome: "Sacola" },
];
const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b84a]";
const chip = `inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${foco}`;
const chipOn = "border-[#ff9a4a] bg-[#ff6a1a]/25 text-[#fff8e7]";
const chipOff = "border-[#fff8e7]/20 bg-[#120c09]/60 text-[#fff8e7]/90 hover:bg-[#241a16]";

/** Soma uma dose de um adicional (até o máximo) e anuncia. */
export function somarAdicional(pedido: Pedido, muda: Muda, anunciar: (s: string) => void, id: AdicionalId, d = 1) {
  const a = ADICIONAIS[id]; const n = pedido.adicionais[id] ?? 0;
  if (d > 0 && n >= a.max) { anunciar(`${a.nome}: no máximo ${a.max}`); return; }
  const novo = Math.max(0, Math.min(a.max, n + d));
  muda((p) => ({ ...p, adicionais: { ...p.adicionais, [id]: Math.max(0, Math.min(a.max, (p.adicionais[id] ?? 0) + d)) } }));
  anunciar(`${a.nome}: ${novo}`);
}

/** Trilha das fases do pedido, com o total parcial. */
export function TrilhaPedido({ fase, pedido }: { fase: FasePedido; pedido: Pedido }) {
  const atual = FASES.findIndex((f) => f.id === fase);
  return <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex items-start justify-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] min-[700px]:justify-between min-[700px]:px-6 min-[700px]:pt-5">
    <ol data-testid="trilha-pedido" aria-label="Pedido" className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#fff8e7]/10 bg-[#120c09]/75 p-1 shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md min-[700px]:gap-1.5 min-[700px]:p-1.5">
      {FASES.map((f, i) => {
        const estado = i < atual ? "feito" : i === atual ? "ativa" : "depois";
        return <li key={f.id} data-estado={estado} aria-current={estado === "ativa" ? "step" : undefined} aria-label={`${f.nome}: ${estado === "feito" ? "feito" : estado === "ativa" ? "agora" : "depois"}`}
          className={`flex h-8 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold min-[700px]:h-9 min-[700px]:px-3 min-[700px]:text-[13px] ${estado === "ativa" ? "bg-[#ff6a1a]/25 text-[#fff8e7] ring-2 ring-[#ff9a4a]" : estado === "feito" ? "text-[#fff8e7]/85" : "text-[#fff8e7]/45"}`}>
          <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-black ${estado === "feito" ? "bg-[#e8b84a] text-[#120c09]" : estado === "ativa" ? "bg-[#ff9a4a] text-[#120c09]" : "bg-[#fff8e7]/15"}`}>{estado === "feito" ? "✓" : i + 1}</span>
          <span className={estado === "ativa" ? "" : "hidden min-[700px]:inline"}>{f.nome}</span>
        </li>;
      })}
    </ol>
    <p className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full border border-[#fff8e7]/10 bg-[#120c09]/75 px-3 text-[#fff8e7] shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur-md min-[700px]:h-11 min-[700px]:px-4">
      <span className="hidden text-[11px] uppercase tracking-wide text-[#fff8e7]/60 min-[420px]:inline">Total</span>
      <span data-testid="total" className="whitespace-nowrap text-[15px] font-bold tabular-nums min-[700px]:text-base">{brl(totalDoPedido(pedido))}</span>
    </p>
  </div>;
}

/** Botão invisível sobre um objeto da cena (potinho, bebida, porção) com etiqueta de nome e preço; tocar ou arrastar até o lanche. */
function NaCena({ testid, ponto, nome, preco, conta, ativo, zona, aoUsar, rotulo, desligado, acima }: {
  testid: string; ponto?: { x: number; y: number; r: number; t: number }; nome: string; preco: string; conta?: number; ativo?: boolean; zona: Zona;
  aoUsar: () => void; rotulo: string; desligado?: boolean; acima?: boolean;
}) {
  const t = useRef<{ id: number; x: number; y: number; moveu: boolean } | null>(null);
  const supr = useRef(false);
  const [fant, setFant] = useState<{ x: number; y: number; sobre: boolean } | null>(null);
  if (!ponto) return null;
  // etiqueta sempre dentro da tela
  const larg = typeof window === "undefined" ? 1e4 : window.innerWidth;
  const desvio = Math.min(larg - 64, Math.max(64, ponto.x)) - ponto.x;
  const sobre = (x: number, y: number) => !!zona && x >= zona.x0 - 50 && x <= zona.x1 + 50 && y >= zona.y0 - 50 && y <= zona.y1 + 50;
  const ev = {
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      t.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moveu: false };
    },
    onPointerMove: (e: RPointerEvent<HTMLButtonElement>) => {
      const c = t.current; if (!c || c.id !== e.pointerId) return;
      if (!c.moveu && Math.hypot(e.clientX - c.x, e.clientY - c.y) > 8) c.moveu = true;
      if (c.moveu) setFant({ x: e.clientX, y: e.clientY, sobre: sobre(e.clientX, e.clientY) });
    },
    onPointerUp: (e: RPointerEvent<HTMLButtonElement>) => {
      const c = t.current; if (!c || c.id !== e.pointerId) return;
      t.current = null; setFant(null);
      supr.current = true; setTimeout(() => { supr.current = false; }, 0);
      if (!c.moveu || sobre(e.clientX, e.clientY)) aoUsar();
    },
    onPointerCancel: () => { t.current = null; setFant(null); },
    onClick: () => { if (!supr.current) aoUsar(); },
  };
  return <>
    <button type="button" data-testid={testid} aria-label={rotulo} aria-pressed={ativo} {...ev}
      className={`group absolute z-[3] touch-none rounded-full bg-transparent outline-none ${foco} focus-visible:outline-[3px] ${desligado ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
      style={{ left: ponto.x - ponto.r, top: ponto.y - ponto.r, width: ponto.r * 2, height: ponto.r * 2 }}>
      {ativo && <span aria-hidden="true" className="pointer-events-none absolute inset-[-6px] rounded-full ring-2 ring-[#ff9a4a]/80" />}
      {!!conta && <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#e8b84a] px-1 text-[12px] font-black text-[#120c09] shadow">{conta}</span>}
      <span aria-hidden="true" style={{ transform: `translate(calc(-50% + ${desvio}px), ${acima ? Math.min(0, ponto.t - (ponto.y - ponto.r)) : 0}px)` }} className={`pointer-events-none absolute left-1/2 ${acima ? "bottom-full mb-1" : "top-full mt-1"} w-max max-w-[124px] rounded-lg px-2 py-1 text-center text-[11px] leading-[1.15] shadow-[0_6px_16px_rgba(0,0,0,.45)] backdrop-blur-md min-[700px]:max-w-[150px] min-[700px]:text-[12px] ${ativo ? "bg-[#fff8e7] text-[#120c09]" : "bg-[#120c09]/80 text-[#fff8e7]"} ${desligado ? "opacity-60" : ""}`}>
        <span className="block font-semibold">{nome}</span>
        <span className={`block whitespace-nowrap tabular-nums ${ativo ? "text-[#7a3a12]" : "text-[#ffcf8a]"}`}>{preco}</span>
      </span>
    </button>
    {fant && <span aria-hidden="true" className="pointer-events-none fixed z-[9] h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ff9a4a] bg-[#ff6a1a]/30 transition-transform"
      style={{ left: fant.x, top: fant.y, transform: `translate(-50%,-50%) scale(${fant.sobre ? 1.25 : 1})` }} />}
  </>;
}

function Painel({ children, testid }: { children: ReactNode; testid?: string }) {
  return <div data-testid={testid} className="proto-anim absolute inset-x-0 bottom-0 z-[6] mx-auto max-w-[640px] px-3 pb-[max(12px,env(safe-area-inset-bottom))] [animation:proto-sobe_.4s_ease-out] min-[700px]:bottom-5 min-[700px]:px-0">
    <div className="rounded-2xl border border-[#fff8e7]/10 bg-[#120c09]/80 p-3 text-[#fff8e7] shadow-[0_18px_50px_rgba(0,0,0,.5)] backdrop-blur-md min-[700px]:p-4">{children}</div>
  </div>;
}
function Seguir({ aoSeguir, texto = "Seguir" }: { aoSeguir: () => void; texto?: string }) {
  return <button type="button" data-testid="seguir" onClick={aoSeguir}
    className={`h-11 shrink-0 rounded-full bg-[#ff6a1a] px-6 text-sm font-bold text-[#120c09] transition-colors hover:bg-[#ff8a3d] ${foco}`}>{texto}</button>;
}
const Dica = ({ children }: { children: ReactNode }) => <p className="font-hand text-[24px] leading-none text-[#fff8e7] min-[700px]:text-[28px]">{children}</p>;

function ChipsSabor<T extends string>({ ordem, nomes, atual, aoEscolher, titulo }: { ordem: T[]; nomes: Record<T, { nome: string; cor: string; preco?: number }>; atual: T | null; aoEscolher: (s: T) => void; titulo: string }) {
  return <div role="group" aria-label={titulo} className="flex flex-wrap gap-1.5">
    {ordem.map((s) => {
      const n = nomes[s];
      return <button key={s} type="button" data-testid={`sabor-${s}`} aria-pressed={atual === s} onClick={() => aoEscolher(s)} className={`${chip} h-8 px-2.5 text-[12px] ${atual === s ? chipOn : chipOff}`}>
        <span aria-hidden="true" className="h-3 w-3 rounded-full border border-[#fff8e7]/40" style={{ background: n.cor }} />{n.nome}{n.preco !== undefined && n.preco !== 700 ? ` (${brl(n.preco)})` : ""}
      </button>;
    })}
  </div>;
}

/**
 * Etapa Turbinar da montagem, antes da tampa: rótulos sobre os 5 potinhos (a mão joga sobre o recheio e o adicional
 * fica dentro do lanche), a fileira dos separados e "Fechar o lanche", que segue para a tampa (dá para fechar sem nada).
 */
export function PainelTurbinar({ pedido, muda, proj, zona, anunciar, aoFechar, fechando }: {
  pedido: Pedido; muda: Muda; proj: ProjPedido | null; zona: Zona; anunciar: (s: string) => void; aoFechar: () => void; fechando: boolean;
}) {
  const somar = (id: AdicionalId) => somarAdicional(pedido, muda, anunciar, id);
  const tirar = (id: AdicionalId) => somarAdicional(pedido, muda, anunciar, id, -1);
  const separado = (id: SeparadoId, d: number) => muda((p) => ({ ...p, separados: { ...p.separados, [id]: Math.max(0, Math.min(SEPARADOS[id].max, (p.separados[id] ?? 0) + d)) } }));
  const postos = POTINHOS.filter((id) => (pedido.adicionais[id] ?? 0) > 0);
  return <>
    {!fechando && POTINHOS.map((id) => {
      const a = ADICIONAIS[id]; const n = pedido.adicionais[id] ?? 0;
      return <NaCena key={id} testid={`adicional-${id}`} ponto={proj?.[`adicional-${id}`]} nome={a.curto} preco={brl(a.preco)} conta={n} ativo={n > 0} zona={zona}
        desligado={n >= a.max} aoUsar={() => somar(id)} rotulo={`${a.nome}, ${brl(a.preco)}${n ? `, ${n} no lanche` : ""}${n >= a.max ? " (no máximo)" : ""}`} />;
    })}
    <Painel testid="painel-turbinar">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Dica>Turbine por dentro</Dica>
          <p className="mt-1 text-[12px] leading-snug text-[#fff8e7]/75">Toque ou arraste um potinho até o lanche · Total <b data-testid="total-turbinar" className="tabular-nums text-[#ffcf8a]">{brl(totalDoPedido(pedido))}</b></p>
        </div>
        <button type="button" data-testid="fechar-lanche" onClick={aoFechar} disabled={fechando}
          className={`h-11 shrink-0 rounded-full bg-[#ff6a1a] px-5 text-sm font-bold text-[#120c09] transition-colors hover:bg-[#ff8a3d] disabled:opacity-60 ${foco}`}>{fechando ? "Fechando…" : "Fechar o lanche"}</button>
      </div>
      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#fff8e7]/60">Separados, no potinho com tampa · {brl(400)} cada</p>
      <ul className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ORDEM_SEPARADOS.map((id) => {
          const s = SEPARADOS[id]; const n = pedido.separados[id] ?? 0;
          return <li key={id} className={`flex shrink-0 items-center rounded-full border ${n ? "border-[#ff9a4a] bg-[#ff6a1a]/20" : "border-[#fff8e7]/20 bg-[#120c09]/60"}`}>
            {n > 0 && <button type="button" data-testid={`separado-${id}-menos`} aria-label={`Tirar ${s.nome}`} onClick={() => separado(id, -1)}
              className={`grid h-9 w-8 place-items-center rounded-full text-lg font-bold text-[#fff8e7] hover:bg-[#fff8e7]/10 ${foco}`}>−</button>}
            <button type="button" data-testid={`separado-${id}`} aria-label={`Pôr ${s.nome} separado, ${brl(s.preco)}${n ? `, ${n} no pedido` : ""}`} onClick={() => separado(id, 1)}
              className={`flex h-9 items-center gap-1.5 rounded-full pl-3 pr-2.5 text-[12px] font-semibold text-[#fff8e7] hover:bg-[#fff8e7]/10 ${n ? "pl-1" : ""} ${foco}`}>
              {s.curto}{n > 0 && <span className="rounded-full bg-[#e8b84a] px-1.5 text-[11px] font-black text-[#120c09]">{n}</span>}<span aria-hidden="true" className="text-base leading-none text-[#ffcf8a]">+</span>
            </button>
          </li>;
        })}
      </ul>
      {postos.length > 0 && <ul aria-label="No lanche" className="mt-2 flex flex-wrap gap-1.5 border-t border-[#fff8e7]/10 pt-2">
        {postos.map((id) => <li key={id}>
          <button type="button" data-testid={`tirar-${id}`} onClick={() => tirar(id)} aria-label={`Tirar um ${ADICIONAIS[id].nome}`}
            className={`${chip} h-8 border-[#fff8e7]/15 bg-[#fff8e7]/8 px-2.5 text-[12px] text-[#fff8e7]/90 hover:bg-[#fff8e7]/15`}>
            {ADICIONAIS[id].curto} ×{pedido.adicionais[id]} <span aria-hidden="true" className="text-[#ff9a4a]">− Tirar</span>
          </button>
        </li>)}
      </ul>}
    </Painel>
  </>;
}

type Props = {
  fase: FasePos; pedido: Pedido; muda: Muda; proj: ProjPedido | null; zona: Zona;
  aoSeguir: () => void; sacolaPronta: boolean; aoOutro: () => void; anunciar: (s: string) => void;
};

export default function PedidoHud(props: Props) {
  const { fase, pedido, muda, proj, zona, aoSeguir, sacolaPronta, aoOutro, anunciar } = props;
  const [recusou, setRecusou] = useState(false);
  const [copiado, setCopiado] = useState<"" | "ok" | "erro">("");
  const trio = trioDe(pedido.lanche);

  const bebida = (id: BebidaId) => {
    muda((p) => {
      if (id === "lata") return { ...p, bebida: { id, sabor: p.bebida?.id === "lata" ? p.bebida.sabor : p.lataCombo ?? "coca" }, lataCombo: null };
      if (id === "soda") return { ...p, bebida: { id, sabor: p.bebida?.id === "soda" ? p.bebida.sabor : "maca-verde" } };
      return { ...p, bebida: { id } };
    });
    anunciar(`${BEBIDAS[id].nome} na mesa`);
  };
  const saborLata = (s: SaborLata) => muda((p) => (p.bebida?.id === "lata" ? { ...p, bebida: { id: "lata", sabor: s } } : { ...p, lataCombo: s }));
  const saborSoda = (s: SaborSoda) => muda((p) => ({ ...p, bebida: { id: "soda", sabor: s } }));
  const porcao = (id: PorcaoId) => { muda((p) => ({ ...p, porcao: id })); anunciar(`${PORCOES[id].nome} na mesa`); };
  const aceitar = () => { setRecusou(false); muda((p) => ({ ...p, combo: true, porcao: p.porcao === "batata" ? null : p.porcao })); anunciar(`${trio?.nome} no pedido`); };
  const recusar = () => { setRecusou(true); muda((p) => ({ ...p, combo: false, lataCombo: null })); };

  const copiar = async () => {
    const txt = textoDoPedido(pedido);
    try { await navigator.clipboard.writeText(txt); setCopiado("ok"); } catch {
      try {
        const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); setCopiado(ok ? "ok" : "erro");
      } catch { setCopiado("erro"); }
    }
    setTimeout(() => setCopiado(""), 2600);
  };

  // ---------------------------------------------------------------- Bebida
  if (fase === "bebida") {
    const b = pedido.bebida;
    return <>
      {ORDEM_BEBIDAS.map((id) => <NaCena key={id} testid={`bebida-${id}`} ponto={proj?.[`bebida-${id}`]} nome={BEBIDAS[id].curto}
        preco={brl(BEBIDAS[id].preco)} ativo={b?.id === id} zona={zona} acima aoUsar={() => bebida(id)}
        rotulo={`${BEBIDAS[id].nome}, ${brl(BEBIDAS[id].preco)}`} />)}
      <Painel testid="painel-bebida">
        <div className="flex items-center justify-between gap-3">
          <Dica>{b ? "Bebida na mesa" : "Escolha a bebida na bandeja"}</Dica>
          <Seguir aoSeguir={aoSeguir} />
        </div>
        {b?.id === "lata" && <div className="mt-2.5"><ChipsSabor titulo="Sabor da lata" ordem={ORDEM_SABORES_LATA} nomes={SABORES_LATA} atual={b.sabor} aoEscolher={saborLata} /></div>}
        {b?.id === "soda" && <div className="mt-2.5"><ChipsSabor titulo="Sabor da soda" ordem={ORDEM_SABORES_SODA} nomes={SABORES_SODA} atual={b.sabor} aoEscolher={saborSoda} /></div>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" data-testid="sem-bebida" aria-pressed={!b} onClick={() => { muda((p) => ({ ...p, bebida: null })); anunciar("Sem bebida"); }} className={`${chip} ${!b ? chipOn : chipOff}`}>Sem bebida</button>
        </div>
      </Painel>
    </>;
  }

  // ---------------------------------------------------------------- Acompanhamento e combo
  if (fase === "acomp") {
    const sabor = saborDaLataDoCombo(pedido);
    const economia = economiaDoTrio(pedido.lanche, pedido.bebida?.id === "lata" ? pedido.bebida.sabor : null);
    return <>
      {ORDEM_PORCOES.map((id) => <NaCena key={id} testid={`porcao-${id}`} ponto={proj?.[`porcao-${id}`]} nome={PORCOES[id].curto} preco={`a partir de ${brl(PORCOES[id].preco)}`}
        ativo={pedido.porcao === id} zona={zona} acima aoUsar={() => porcao(id)} rotulo={`${PORCOES[id].nome}, a partir de ${brl(PORCOES[id].preco)}, ${PORCOES[id].molho}`} />)}
      <Painel testid="painel-acomp">
        <div className="flex items-center justify-between gap-3">
          <Dica>{pedido.combo ? "Trio na mesa!" : "Uma porção pra acompanhar?"}</Dica>
          <Seguir aoSeguir={aoSeguir} />
        </div>
        {trio && <div data-testid="combo" className={`mt-2.5 rounded-xl border p-2.5 ${pedido.combo ? "border-[#e8b84a] bg-[#e8b84a]/12" : "border-[#ff9a4a]/50 bg-[#ff6a1a]/10"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-[13px] font-bold text-[#fff8e7]">{trio.nome}</p>
            <p className="text-[12px] tabular-nums text-[#fff8e7]/80">de <s>{brl(trio.de)}</s> por <b className="text-[15px] text-[#ffcf8a]">{brl(trio.preco)}</b></p>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-[#fff8e7]/75">{LANCHES_PRECO[pedido.lanche].nome} + {trio.batata} + refri lata. Você economiza <b className="text-[#ffcf8a]">{brl(economia)}</b> em relação aos itens soltos.</p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" data-testid="combo-aceitar" aria-pressed={pedido.combo} onClick={aceitar} className={`${chip} ${pedido.combo ? chipOn : "border-[#ff9a4a] bg-[#ff6a1a] text-[#120c09] hover:bg-[#ff8a3d]"}`}>{pedido.combo ? "✓ Trio no pedido" : "Quero o trio"}</button>
            <button type="button" data-testid="combo-recusar" aria-pressed={!pedido.combo && recusou} onClick={recusar} className={`${chip} ${chipOff}`}>{pedido.combo ? "Tirar o trio" : "Agora não"}</button>
          </div>
          {pedido.combo && pedido.bebida?.id !== "lata" && <div className="mt-2.5">
            <p className="mb-1.5 text-[12px] font-semibold text-[#fff8e7]/85">{sabor ? "Lata do trio:" : "Qual o sabor da lata do trio?"}</p>
            <ChipsSabor titulo="Sabor da lata do trio" ordem={ORDEM_SABORES_LATA} nomes={SABORES_LATA} atual={sabor} aoEscolher={saborLata} />
          </div>}
        </div>}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" data-testid="sem-acompanhamento" aria-pressed={!pedido.porcao && !pedido.combo} onClick={() => { setRecusou(true); muda((p) => ({ ...p, porcao: null, combo: false, lataCombo: null })); anunciar("Sem acompanhamento"); }}
            className={`${chip} ${!pedido.porcao && !pedido.combo ? chipOn : chipOff}`}>Sem acompanhamento</button>
        </div>
      </Painel>
    </>;
  }

  // ---------------------------------------------------------------- Sacola e resumo
  if (!sacolaPronta) return <div className="pointer-events-none absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] z-[5] text-center min-[700px]:bottom-8">
    <p className="font-hand text-[30px] leading-none text-[#fff8e7] [text-shadow:0_2px_14px_rgba(0,0,0,.85)] min-[700px]:text-[38px]">Ensacando com capricho…</p>
  </div>;
  const linhas = linhasDoPedido(pedido);
  return <div data-testid="resumo" role="region" aria-label="Resumo do pedido"
    className="proto-anim absolute inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[6] mx-auto flex max-h-[min(62vh,560px)] max-w-[440px] flex-col rounded-2xl bg-[#fff8e7]/95 text-[#120c09] shadow-[0_18px_50px_rgba(0,0,0,.5)] [animation:proto-sobe_.5s_ease-out] min-[700px]:bottom-6 min-[700px]:right-8 min-[700px]:left-auto min-[700px]:mx-0 min-[700px]:max-h-[calc(100vh-120px)] min-[700px]:w-[420px]">
    <div className="overflow-y-auto px-4 pb-2 pt-3.5">
      <p className="font-hand text-[28px] leading-none text-[#c2410c]">Seu pedido</p>
      <ul className="mt-2 space-y-1.5 text-[13px]">
        {linhas.map((l, i) => <li key={i} className={`flex items-start justify-between gap-3 ${l.nivel ? "pl-3 text-[#5c3d2e]" : "font-semibold"}`}>
          <span>{l.texto}{l.detalhe && <span className="block text-[11px] font-normal text-[#7a5a48]">{l.detalhe}</span>}
            {l.obs && <span data-testid={i === 0 ? "resumo-opcoes" : undefined} className="block text-[11.5px] font-normal text-[#5c3d2e]">{l.obs}</span>}</span>
          <span className="shrink-0 tabular-nums">{brl(l.valor)}</span>
        </li>)}
      </ul>
      <p className="mt-2.5 flex items-baseline justify-between border-t border-[#120c09]/15 pt-2 text-[15px] font-bold">
        <span>Total</span><span data-testid="resumo-total" className="tabular-nums">{brl(totalDoPedido(pedido))}</span>
      </p>
      <p className="mt-1 text-[10.5px] leading-snug text-[#7a5a48]">{AVISO}</p>
      <p className="mt-1.5 text-[12px] leading-snug text-[#5c3d2e]">Protótipo: o pedido abre no WhatsApp para você conferir, ainda não vai para a loja.</p>
    </div>
    <div className="grid grid-cols-2 gap-2 border-t border-[#120c09]/10 px-4 py-3">
      <a data-testid="pedir" href={linkWhatsApp(pedido)} target="_blank" rel="noopener" className={`col-span-2 grid h-11 place-items-center rounded-full bg-[#ff6a1a] text-sm font-bold text-[#120c09] hover:bg-[#ff8a3d] ${foco}`}>Pedir pelo WhatsApp</a>
      <button type="button" data-testid="copiar-pedido" onClick={copiar} className={`h-10 rounded-full bg-[#120c09] text-sm font-semibold text-[#fff8e7] hover:bg-[#2a1d18] ${foco}`}>
        {copiado === "ok" ? "Copiado!" : copiado === "erro" ? "Não deu pra copiar" : "Copiar pedido"}
      </button>
      <button type="button" data-testid="montar-outro" onClick={aoOutro} className={`h-10 rounded-full border border-[#120c09]/25 text-sm font-semibold text-[#120c09] hover:bg-[#120c09]/5 ${foco}`}>Montar outro lanche</button>
      <p aria-live="polite" className="sr-only">{copiado === "ok" ? "Pedido copiado" : ""}</p>
    </div>
  </div>;
}
