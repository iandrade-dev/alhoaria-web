"use client";

import { ShoppingBag } from "lucide-react";
import { useSacola } from "./SacolaProvider";

export default function BotaoSacola({ className = "", aoAbrir }: { className?: string; aoAbrir?: () => void | Promise<void> }) {
  const { itens, pronta, abrirSacola } = useSacola();
  const quantidade = pronta ? itens.reduce((n, i) => n + i.quantidade, 0) : 0;
  return <button type="button" onClick={async () => { await aoAbrir?.(); abrirSacola(); }} aria-label={`Abrir sacola${pronta ? `, ${quantidade} ${quantidade === 1 ? "item" : "itens"}` : ""}`}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-macarico/50 bg-macarico px-3 text-sm font-bold text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-osso ${className}`}>
    <ShoppingBag size={18} aria-hidden="true" /><span>Sacola</span>{quantidade > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-carvao px-1 text-[11px] text-osso">{quantidade}</span>}
  </button>;
}
