"use client";

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import type { ApiCena, Bus, Modo, Projecao } from "../bancada-proto/Cena";
import type { PassoDef } from "../bancada-proto/layout";
import { OPCOES, type Opcoes } from "../bancada-proto/cardapio";
import { estacao } from "./sequencia";
import styles from "./ar.module.css";

/** As zonas acompanham as peças reais, inclusive o giro/zoom e a âncora AR. */
export default function Ingredientes({ proj, passo, opcoes, bus, api, aoUsar }: {
  proj: Projecao; passo: PassoDef; opcoes: Opcoes | null;
  bus: MutableRefObject<Bus>; api: MutableRefObject<ApiCena | null>;
  aoUsar: (id: string, modo: Modo) => void;
}) {
  const toque = useRef<{ pointer: number; x: number; y: number; moveu: boolean } | null>(null);
  const [segurando, setSegurando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const id = estacao(passo, opcoes), ponto = proj.estacoes[id];
  const tampa = passo.tipo === "tampa" || passo.tipo === "dog-tampa";
  const opcao = passo.grupo ? OPCOES[passo.grupo].find((o) => o.id === opcoes?.[passo.grupo!]) : null;
  const zona = proj.lanche;
  const dentro = (x: number, y: number) => zona.x1 > zona.x0
    && x >= zona.x0 - 24 && x <= zona.x1 + 24 && y >= zona.y0 - 24 && y <= zona.y1 + 24;
  useEffect(() => () => {
    bus.current.drag.ativo = false;
    if (toque.current && ponto) api.current?.soltar(id);
  }, [id, bus, api, !!ponto]);
  if (!ponto && !tampa) return null;
  if (tampa && zona.x1 <= zona.x0) return null;
  const cancelar = () => {
    toque.current = null; bus.current.drag.ativo = false; setSegurando(false); setSobre(false);
    if (ponto) api.current?.soltar(id);
  };
  const iniciar = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || toque.current) return;
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    toque.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moveu: false };
    if (ponto) { bus.current.drag = { ativo: true, id, x: e.clientX, y: e.clientY }; setSegurando(true); }
  };
  const mover = (e: PointerEvent<HTMLButtonElement>) => {
    const t = toque.current;
    if (!t || t.pointer !== e.pointerId) return;
    t.moveu ||= Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8;
    bus.current.drag.x = e.clientX; bus.current.drag.y = e.clientY;
    setSobre(t.moveu && dentro(e.clientX, e.clientY));
  };
  const soltar = (e: PointerEvent<HTMLButtonElement>) => {
    const t = toque.current;
    if (!t || t.pointer !== e.pointerId) return;
    toque.current = null; bus.current.drag.ativo = false; setSegurando(false); setSobre(false);
    if (!t.moveu) aoUsar(id, "toque");
    else if (ponto && dentro(e.clientX, e.clientY)) aoUsar(id, "arraste");
    else if (ponto) api.current?.soltar(id);
  };
  return <div className={styles.ingredientes}>
    {segurando && <div className={`${styles.soltarLanche} ${sobre ? styles.sobreLanche : ""}`} aria-hidden="true"
      style={{ left: zona.x0 - 16, top: zona.y0 - 16, width: zona.x1 - zona.x0 + 32, height: zona.y1 - zona.y0 + 32 }}>Solte aqui</div>}
    <button type="button" className={`${styles.ingrediente} ${tampa ? styles.tampa : ""}`} data-testid="ingrediente-ativo"
      aria-label={tampa ? "Tocar no pão para fechar" : `Usar ${opcao?.nome ?? passo.nome}: toque ou arraste até o lanche`}
      style={ponto ? { left: ponto.x - ponto.r, top: ponto.y - ponto.r, width: ponto.r * 2, height: ponto.r * 2 }
        : { left: zona.x0, top: zona.y0, width: zona.x1 - zona.x0, height: zona.y1 - zona.y0 }}
      onPointerDown={iniciar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={cancelar}
      onLostPointerCapture={() => { if (toque.current) cancelar(); }}
      onClick={(e) => { if (e.detail === 0) aoUsar(id, "toque"); }}>
      {!segurando && <span>{tampa ? "Fechar o pão" : opcao?.nome ?? passo.nome}</span>}
    </button>
  </div>;
}
