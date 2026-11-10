"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { brl, LANCHES_PRECO, nomeBebida, PORCOES } from "@/components/bancada-proto/cardapio";
import { restaurante } from "@/data/restaurante";
import { destinoDoCheckout } from "@/lib/checkout";
import { linhasDoItem, textoDaSacola, totalDoItem, type ConteudoSacola } from "@/lib/sacola";
import { useSacola } from "./SacolaProvider";
import styles from "./pedido.module.css";

export function nomeDoConteudo(conteudo: ConteudoSacola) {
  if (conteudo.tipo === "lanche") return LANCHES_PRECO[conteudo.pedido.lanche].nome;
  return conteudo.tipo === "bebida" ? nomeBebida(conteudo.bebida) : PORCOES[conteudo.porcao].nome;
}

/** Foco contido, Escape, fundo inerte e restauração do ponto de origem. */
export function usePainelModal(aberto: boolean, aoFechar: () => void) {
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    if (!aberto || !painel.current) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inertes: HTMLElement[] = [];
    let atual: HTMLElement = painel.current;
    while (atual.parentElement && atual.parentElement !== document.body) {
      for (const irmao of Array.from(atual.parentElement.children)) {
        if (irmao !== atual && irmao instanceof HTMLElement && !irmao.hasAttribute("inert")) { irmao.setAttribute("inert", ""); inertes.push(irmao); }
      }
      atual = atual.parentElement;
    }
    if (atual.parentElement === document.body) for (const irmao of Array.from(document.body.children)) {
      if (irmao !== atual && irmao instanceof HTMLElement && !irmao.hasAttribute("inert")) { irmao.setAttribute("inert", ""); inertes.push(irmao); }
    }
    const elementos = () => Array.from(painel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0);
    (painel.current.querySelector<HTMLElement>("[data-autofoco]") ?? elementos()[0] ?? painel.current).focus();
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") { evento.preventDefault(); fechar.current(); }
      if (evento.key !== "Tab") return;
      const lista = elementos(); const primeiro = lista[0]; const ultimo = lista[lista.length - 1];
      if (!primeiro) { evento.preventDefault(); return; }
      if (evento.shiftKey && (document.activeElement === primeiro || !painel.current?.contains(document.activeElement))) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && (document.activeElement === ultimo || !painel.current?.contains(document.activeElement))) { evento.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", teclado);
    return () => { document.removeEventListener("keydown", teclado); document.body.style.overflow = overflow; inertes.forEach((el) => el.removeAttribute("inert")); if (anterior?.isConnected) anterior.focus(); };
  }, [aberto]);
  return painel;
}

export default function Sacola() {
  const { itens, total, aberta, aviso, alterarQuantidade, remover, fecharSacola } = useSacola();
  const painel = usePainelModal(aberta, fecharSacola);
  const [copia, setCopia] = useState<"idle" | "ok" | "manual">("idle");
  const texto = textoDaSacola(itens);
  useEffect(() => { setCopia("idle"); }, [itens, aberta]);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopia("ok"); }
    catch { setCopia("manual"); }
  }
  if (!aberta) return null;
  return <div className={`${styles.overlay} ${styles.drawerOverlay}`} onMouseDown={(e) => { if (e.target === e.currentTarget) fecharSacola(); }}>
    <div className={`${styles.panel} ${styles.drawer}`} role="dialog" aria-modal="true" aria-labelledby="titulo-sacola" ref={painel} tabIndex={-1}>
      <header className={styles.panelHeader}><div><h2 id="titulo-sacola">Sua sacola</h2><p className={styles.smallNote}>{itens.reduce((n, i) => n + i.quantidade, 0)} item(ns) no pedido</p></div><button type="button" className={styles.close} onClick={fecharSacola} aria-label="Fechar sacola">×</button></header>
      <div className={styles.panelBody}>
        {aviso && <p className={styles.notice}>{aviso}</p>}
        {itens.length === 0 ? <div className={styles.empty}><p>Sua sacola está esperando seu primeiro pedido.</p><Link href="/cardapio" className={styles.primary} onClick={fecharSacola}>Escolher no cardápio</Link></div> : itens.map((item) => <article className={styles.item} key={item.id}>
          <h3>{nomeDoConteudo(item.conteudo)}</h3>
          {linhasDoItem(item).map((linha, n) => <div key={n} className={styles.itemDetail}><span>{linha.texto}</span>{linha.detalhe && <div>{linha.detalhe}</div>}{linha.obs && <div>{linha.obs}</div>}</div>)}
          {item.conteudo.tipo === "lanche" && (item.conteudo.pedido.bebida || item.conteudo.pedido.porcao || item.conteudo.pedido.combo) && <p className={styles.smallNote}>A quantidade multiplica o lanche e tudo que está incluído nesta linha.</p>}
          <div className={styles.itemBottom}><div className={styles.stepper} aria-label={`Quantidade de ${nomeDoConteudo(item.conteudo)}`}><button type="button" onClick={() => alterarQuantidade(item.id, item.quantidade - 1)} disabled={item.quantidade <= 1} aria-label="Diminuir quantidade">−</button><output>{item.quantidade}</output><button type="button" onClick={() => alterarQuantidade(item.id, item.quantidade + 1)} disabled={item.quantidade >= 99} aria-label="Aumentar quantidade">+</button></div><strong>{brl(totalDoItem(item))}</strong></div>
          <div className={styles.actions}><Link href={`/cardapio?editar=${encodeURIComponent(item.id)}`} className={styles.textButton} onClick={fecharSacola}>Editar</Link><button type="button" className={styles.textButton} onClick={() => remover(item.id)} aria-label={`Remover ${nomeDoConteudo(item.conteudo)}`}>Remover</button></div>
        </article>)}
        {itens.length > 0 && <><p className={styles.notice}>{restaurante.checkout.aviso}</p><p className={styles.smallNote}>Preços estimados. Entrega, disponibilidade e valor final são confirmados na loja.</p>{copia === "manual" && <label className={styles.field}>Selecione e copie o resumo<textarea className={styles.textarea} readOnly value={texto} onFocus={(e) => e.currentTarget.select()} /></label>}<p role="status" className={styles.smallNote}>{copia === "ok" ? "Resumo copiado. Use-o para conferir seu pedido na loja." : ""}</p></>}
      </div>
      {itens.length > 0 && <footer className={styles.panelFooter}><div className={styles.total}><span>Total estimado</span><span>{brl(total)}</span></div><button type="button" className={`${styles.secondary} ${styles.full}`} onClick={copiar}>Copiar resumo completo</button><a href={destinoDoCheckout(texto)} target="_blank" rel="noopener noreferrer" className={`${styles.primary} ${styles.full}`}>{restaurante.checkout.tipo === "whatsapp" ? `Enviar resumo no ${restaurante.checkout.nome}` : `Abrir ${restaurante.checkout.nome} e refazer pedido`}</a><button type="button" className={`${styles.textButton} ${styles.full}`} onClick={fecharSacola}>Continuar escolhendo</button></footer>}
    </div>
  </div>;
}
