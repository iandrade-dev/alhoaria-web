"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import menu from "@/data/menu.json";
import { PEDIDO_URL } from "@/lib/links";
import CenaBancada from "./CenaBancada";
import { bancadaReducer, estadoInicial, PASSOS } from "./passos";

const costela = menu.items.find((i) => i.id === "costela");

function IconePasso({ indice }: { indice: number }) {
  const formas = [
    <path key="p" d="M3 15q0-8 9-8t9 8q0 4-9 4t-9-4zm4-3 2-2m4 2 2-2" />,
    <path key="a" d="M5 7q7-6 14 0l-5 11H9L5 7zm2 13h10" />,
    <path key="c" d="M4 15q-2-6 5-7 3-4 6 0 7 0 5 7-2 5-8 4-7 1-8-4z" />,
    <path key="q" d="M4 9q8-6 16 0l-2 9H6L4 9zm4 3v3m5-3v3" />,
    <path key="m" d="M4 7h16l-3 12H7L4 7zm6 5v4m5-5v4" />,
    <path key="f" d="M12 3q5 6 0 9 1-4-3-5-1 5-3 7a6 6 0 0 0 12 0q0-5-6-11z" />,
  ];
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{formas[indice]}</svg>;
}

export default function Bancada() {
  const [estado, enviar] = useReducer(bancadaReducer, estadoInicial);
  const [anuncio, setAnuncio] = useState("");
  const [geracao, novaGeracao] = useReducer((n: number) => n + 1, 0);
  const iniciouRevisao = useRef(false);
  const reduzido = useReducedMotion() ?? false;
  const passo = PASSOS[estado.passoAtual];
  const terminou = estado.passoAtual === PASSOS.length;
  const completo = estado.colocados.size === PASSOS.length;
  const vazio = estado.colocados.size === 0;

  // Atalho de revisão: inicializa apenas uma vez no cliente, sem dependência de Suspense.
  useEffect(() => {
    if (iniciouRevisao.current) return;
    iniciouRevisao.current = true;
    const valor = new URLSearchParams(window.location.search).get("bancada");
    const alvo = valor === "final" ? 6 : /^[1-6]$/.test(valor ?? "") ? Number(valor) - 1 : 0;
    for (let i = 0; i < alvo; i++) {
      enviar({ type: "colocar" });
      enviar({ type: "fimAnimacao" });
    }
  }, []);

  function finalizar() {
    if (!estado.animando) return;
    const atual = PASSOS[estado.passoAtual];
    setAnuncio(`${atual.nome} ${["pasta", "costela", "mussarela"].includes(atual.id) ? "colocada" : "colocado"}`);
    enviar({ type: "fimAnimacao" });
  }

  useEffect(() => {
    if (reduzido && estado.animando) {
      const id = window.setTimeout(() => {
        const atual = PASSOS[estado.passoAtual];
        setAnuncio(`${atual.nome} ${["pasta", "costela", "mussarela"].includes(atual.id) ? "colocada" : "colocado"}`);
        enviar({ type: "fimAnimacao" });
      }, 130);
      return () => window.clearTimeout(id);
    }
  }, [reduzido, estado.animando, estado.passoAtual]);

  function reiniciar() {
    novaGeracao();
    setAnuncio("");
    enviar({ type: "recomecar" });
  }

  return (
    <section id="bancada" className="scroll-mt-[var(--header-height)] bg-creme px-4 py-12 text-carvao sm:px-10 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 text-center lg:mb-9">
          <h2 className="font-display text-4xl uppercase leading-none sm:text-6xl">Monte o seu</h2>
          <p className="mt-1 font-hand text-2xl text-madeira sm:text-3xl">do seu jeito, na nossa bancada</p>
        </header>
        <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:gap-10">
          <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[24px] bg-madeira-escura shadow-[0_18px_40px_rgba(36,24,18,.22)] lg:max-w-[600px]">
            <CenaBancada key={geracao} estado={estado} reduzido={reduzido} aoTerminar={finalizar} />
          </div>
          <div className="rounded-[24px] border-2 border-[#c49b71] bg-[#f5e7ce] p-5 shadow-[5px_6px_0_#dec5a5] sm:p-7">
            {terminou ? (
              <div className="space-y-4 text-center">
                <p className="font-hand text-2xl text-madeira">Saindo da nossa cozinha</p>
                <h3 className="font-display text-4xl leading-tight text-madeira">{vazio ? "PULOU TUDO?" : completo ? "A COSTELA!" : "SUA MONTAGEM"}</h3>
                <p className="min-h-12 font-sans text-base font-medium text-[#3e2b22]">{vazio ? "Pulou tudo? Então peça do jeito da casa." : completo ? "Do jeitinho que sai da nossa chapa." : "Aqui foi brincadeira. O pedido de verdade é no Anota Aí."}</p>
                <a href={PEDIDO_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-macarico px-5 py-3 font-sans text-base font-bold text-carvao transition-colors hover:bg-[#e3590e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carvao">Peça no Anota Aí <span className="sr-only">(abre em nova aba)</span></a>
                <button type="button" onClick={reiniciar} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-madeira px-5 py-2 font-sans font-bold text-madeira hover:bg-[#ebd4b6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madeira"><RotateCcw size={19} aria-hidden="true" />Montar de novo</button>
              </div>
            ) : (
              <>
                <p className="font-sans text-sm font-bold uppercase tracking-widest text-madeira">Passo {estado.passoAtual + 1} de 6</p>
                <h3 className="mt-1 font-display text-3xl uppercase text-madeira sm:text-4xl">{passo.nome}</h3>
                {passo.ingrediente !== null && <p className="mt-1 min-h-10 font-sans text-sm text-[#4d372b]">{costela?.ingredients[passo.ingrediente]}</p>}
                {passo.ingrediente === null && <p className="mt-1 min-h-10 font-sans text-sm text-[#4d372b]">O toque final da cozinha.</p>}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button type="button" disabled={estado.animando} onClick={() => enviar({ type: "colocar" })} className="min-h-14 rounded-xl bg-macarico px-3 font-sans text-lg font-extrabold text-carvao transition-colors hover:bg-[#e3590e] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carvao">Colocar</button>
                  <button type="button" disabled={estado.animando} onClick={() => { setAnuncio(`${passo.nome} pulado`); enviar({ type: "pular" }); }} className="min-h-14 rounded-xl border-2 border-madeira bg-creme px-3 font-sans text-lg font-bold text-madeira hover:bg-[#efdbb8] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madeira">Pular</button>
                </div>
                <button type="button" onClick={reiniciar} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-bold text-madeira hover:bg-[#ebd4b6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madeira"><RotateCcw size={17} aria-hidden="true" />Recomeçar</button>
              </>
            )}
            <ol aria-label="Progresso da montagem" className="mt-5 grid grid-cols-6 gap-1 border-t border-madeira/30 pt-5 sm:gap-2">
              {PASSOS.map((item, i) => {
                const situacao = estado.colocados.has(item.id) ? "feito" : i < estado.passoAtual ? "pulado" : i === estado.passoAtual ? "atual" : "pendente";
                return <li key={item.id} aria-label={`${i + 1}. ${item.nome}: ${situacao}`} aria-current={situacao === "atual" ? "step" : undefined} className={`flex min-h-12 flex-col items-center justify-center rounded-lg border-2 ${situacao === "feito" ? "border-madeira bg-madeira text-creme" : situacao === "atual" ? "border-macarico bg-[#ffdfb2] text-carvao" : "border-[#bba588] text-[#564536]"}`}><IconePasso indice={i} /><span aria-hidden="true" className="font-sans text-[10px] font-bold leading-tight">{situacao === "feito" ? "✓" : situacao === "pulado" ? "—" : i + 1}</span></li>;
              })}
            </ol>
            <p aria-live="polite" className="sr-only">{anuncio}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
