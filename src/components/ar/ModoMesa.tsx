"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import Image from "next/image";
import { Camera, Check, MapPin, Minus, Plus, RotateCw, X } from "lucide-react";
import type { EstadoAR, SessaoMesa } from "./sessao";
import styles from "./modo-mesa.module.css";

export function EntradaMesa({ suporte, pronto, aoEscolher }: { suporte: boolean | null; pronto: boolean; aoEscolher: (ar: boolean) => void }) {
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => { painel.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [suporte]);
  if (suporte !== true) return null;
  return <div className={styles.entrada}>
    <div ref={painel} className={styles.escolha} role="dialog" aria-modal="true" aria-labelledby="onde-montar" onKeyDown={(e) => {
      if (e.key === "Escape") { aoEscolher(false); return; }
      if (e.key !== "Tab") return;
      const botoes = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault(); botoes[(i + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length]?.focus();
    }}>
      <Image src="/assets/photos/logo-anota.webp" alt="Alhoaria — pão de alho recheado" width={128} height={128} className={styles.marca} priority />
      <h1 id="onde-montar">Onde vamos montar?</h1>
      <p>O mesmo lanche, as bebidas e o pedido. Você escolhe o lugar.</p>
      <button autoFocus onClick={() => aoEscolher(false)}><span>Montar na bancada</span><small>Explore a cozinha em 3D</small></button>
      <button disabled={!pronto} onClick={() => aoEscolher(true)}><Camera size={23} /><span>Montar na minha mesa<small>Abra a câmera e ajuste a posição</small></span></button>
      <p className={styles.nota}>{!pronto ? "Preparando a câmera…" : "Você pode sair da câmera e continuar na bancada quando quiser."}</p>
    </div>
  </div>;
}

export function ControlesMesa({ estado, sessao, zoom, aoZoom, aoGirar }: {
  estado: EstadoAR; sessao: MutableRefObject<SessaoMesa | null>; zoom: number; aoZoom: (n: number) => void; aoGirar: () => void;
}) {
  if (estado.fase === "3d") return null;
  const ajustando = estado.fase === "ajustando", colocado = estado.fase === "colocado";
  return <>
    <div className={styles.topo}>
      <span>Na sua mesa</span>
      <button onClick={() => { void sessao.current?.sair(); }} aria-label="Sair da câmera e continuar na bancada"><X size={17} />Voltar à bancada</button>
    </div>
    {colocado && estado.rastreando && <div className={styles.ferramentas} role="group" aria-label="Visualização na mesa">
      <button aria-label="Aumentar zoom" onClick={() => aoZoom(zoom * 1.2)} disabled={zoom >= 2.5}><Plus size={19} /></button>
      <button aria-label={`Restaurar tamanho. Atual: ${Math.round(zoom * 100)}%`} onClick={() => aoZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button aria-label="Diminuir zoom" onClick={() => aoZoom(zoom / 1.2)} disabled={zoom <= 0.5}><Minus size={19} /></button>
      <button aria-label="Girar conjunto" onClick={aoGirar}><RotateCw size={19} /></button>
      <button aria-label="Ajustar posição" onClick={() => sessao.current?.editarPosicao()}><MapPin size={19} /></button>
    </div>}
    {!colocado && <section className={styles.posicao} aria-label="Posicionar na mesa">
      <h2>{ajustando ? "Ajuste na sua mesa" : estado.fase === "iniciando" ? "Abrindo a câmera…" : "Coloque o lanche à sua frente"}</h2>
      {ajustando ? <>
        <p>Use a altura para encostar a tábua na mesa.</p>
        <label>Altura<input type="range" min="-0.6" max="0.6" step="0.02" value={estado.ajusteAltura} disabled={!estado.rastreando} onChange={(e) => sessao.current?.ajustarAltura(Number(e.target.value))} /></label>
        <label>Distância<input type="range" min="0.35" max={Math.max(1.5, estado.ajusteDistancia)} step="0.05" value={estado.ajusteDistancia} disabled={!estado.rastreando} onChange={(e) => sessao.current?.ajustarDistancia(Number(e.target.value))} /></label>
        <button className={styles.primario} disabled={!estado.rastreando} onClick={() => sessao.current?.confirmarManual()}><Check size={18} />Pronto, ficou bom</button>
      </> : <>
        <p>Não precisa esperar a câmera reconhecer uma superfície.</p>
        <button className={styles.primario} disabled={!estado.podeManual} onClick={() => sessao.current?.colocarManualmente()}><MapPin size={18} />Posicionar manualmente</button>
        {estado.fase === "superficie" && <button onClick={() => sessao.current?.colocar()}>Usar ponto detectado</button>}
      </>}
      <p role="status" className={styles.nota}>{estado.mensagem}</p>
    </section>}
    {colocado && !estado.rastreando && <p className={styles.pausa} role="status">{estado.mensagem}</p>}
  </>;
}
