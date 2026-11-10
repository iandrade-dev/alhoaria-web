"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { restaurante } from "../../data/restaurante";
import { MAX_QUANTIDADE, VERSAO_SACOLA, lerSacola, normalizarConteudo, totalDoItem, atualizarItem, removerItem, type ConteudoSacola, type ItemSacola } from "../../lib/sacola";

type SacolaContexto = {
  itens: ItemSacola[]; pronta: boolean; aviso: string; total: number; aberta: boolean;
  adicionar: (conteudo: ConteudoSacola, quantidade?: number) => string;
  atualizar: (id: string, conteudo: ConteudoSacola, quantidade?: number) => boolean;
  alterarQuantidade: (id: string, quantidade: number) => void; remover: (id: string) => void; limpar: () => void;
  abrirSacola: () => void; fecharSacola: () => void;
};
const Contexto = createContext<SacolaContexto | null>(null);
const quantidadeValida = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_QUANTIDADE;
const chave = `sacola:${restaurante.id}`;
const novoId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export function SacolaProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemSacola[]>([]);
  const itensRef = useRef<ItemSacola[]>([]);
  const [pronta, setPronta] = useState(false);
  const prontaRef = useRef(false);
  const [aviso, setAviso] = useState("");
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    try {
      const resultado = lerSacola(window.localStorage.getItem(chave));
      itensRef.current = resultado.itens; setItens(resultado.itens); setAviso(resultado.aviso);
    } catch { setAviso("Não foi possível acessar a sacola salva. Seu pedido ficará disponível nesta sessão."); }
    prontaRef.current = true; setPronta(true);
  }, []);
  const gravar = useCallback((proximos: ItemSacola[]) => {
    itensRef.current = proximos; setItens(proximos);
    if (!prontaRef.current) return;
    try { window.localStorage.setItem(chave, JSON.stringify({ versao: VERSAO_SACOLA, versaoCatalogo: restaurante.versaoCatalogo, itens: proximos })); setAviso(""); }
    catch { setAviso("Não foi possível salvar a sacola. Seu pedido ficará disponível nesta sessão."); }
  }, []);
  const adicionar = useCallback((conteudo: ConteudoSacola, quantidade = 1) => {
    const c = normalizarConteudo(conteudo);
    if (!prontaRef.current || !c || !quantidadeValida(quantidade) || itensRef.current.length >= 200) return "";
    const id = novoId(); gravar([...itensRef.current, { id, quantidade, conteudo: c }]); return id;
  }, [gravar]);
  const atualizar = useCallback((id: string, conteudo: ConteudoSacola, quantidade?: number) => {
    if (!prontaRef.current) return false;
    const proximos = atualizarItem(itensRef.current, id, conteudo, quantidade);
    if (!proximos) return false;
    gravar(proximos); return true;
  }, [gravar]);
  const alterarQuantidade = useCallback((id: string, quantidade: number) => {
    if (!prontaRef.current || !quantidadeValida(quantidade) || !itensRef.current.some((i) => i.id === id)) return;
    gravar(itensRef.current.map((i) => i.id === id ? { ...i, quantidade } : i));
  }, [gravar]);
  const remover = useCallback((id: string) => { if (prontaRef.current) gravar(removerItem(itensRef.current, id)); }, [gravar]);
  const limpar = useCallback(() => { if (prontaRef.current) gravar([]); }, [gravar]);
  const abrirSacola = useCallback(() => setAberta(true), []);
  const fecharSacola = useCallback(() => setAberta(false), []);
  // Retorna cópias para que consumidores não possam alterar o estado interno.
  const valor = useMemo(() => ({ itens: itens.map((i) => ({ ...i, conteudo: normalizarConteudo(i.conteudo)! })), pronta, aviso, total: itens.reduce((s, i) => s + totalDoItem(i), 0), aberta, adicionar, atualizar, alterarQuantidade, remover, limpar, abrirSacola, fecharSacola }), [itens, pronta, aviso, aberta, adicionar, atualizar, alterarQuantidade, remover, limpar, abrirSacola, fecharSacola]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
export function useSacola() { const valor = useContext(Contexto); if (!valor) throw new Error("useSacola precisa de SacolaProvider"); return valor; }
