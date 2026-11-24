"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { restaurante } from "../../data/restaurante";
import { MAX_QUANTIDADE, VERSAO_SACOLA, lerSacola, normalizarConteudo, totalDoItem, atualizarItem, removerItem, type ConteudoSacola, type ItemSacola } from "../../lib/sacola";
import { useCatalogo } from "../CatalogoProvider";

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
  const cardapio = useCatalogo();
  const [itens, setItens] = useState<ItemSacola[]>([]);
  const itensRef = useRef<ItemSacola[]>([]);
  const [publicacaoLida, setPublicacaoLida] = useState<typeof cardapio>(null);
  const catalogoLido = useRef<typeof cardapio>(null);
  const [aviso, setAviso] = useState("");
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    if (!cardapio) {
      catalogoLido.current = null;
      setPublicacaoLida(null);
      setAviso("O cardápio está indisponível. Tente novamente daqui a pouco.");
      return;
    }
    try {
      const resultado = lerSacola(window.localStorage.getItem(chave), cardapio);
      itensRef.current = resultado.itens; setItens(resultado.itens); setAviso(resultado.aviso);
    } catch { setAviso("Não foi possível acessar a sacola salva. Seu pedido ficará disponível nesta sessão."); }
    catalogoLido.current = cardapio;
    setPublicacaoLida(cardapio);
  }, [cardapio]);
  const gravar = useCallback((proximos: ItemSacola[]) => {
    if (!cardapio || catalogoLido.current !== cardapio) return;
    itensRef.current = proximos; setItens(proximos);
    try { window.localStorage.setItem(chave, JSON.stringify({ versao: VERSAO_SACOLA, empresa: cardapio.companyId, publicacao: cardapio.publicationId, itens: proximos })); setAviso(""); }
    catch { setAviso("Não foi possível salvar a sacola. Seu pedido ficará disponível nesta sessão."); }
  }, [cardapio]);
  const adicionar = useCallback((conteudo: ConteudoSacola, quantidade = 1) => {
    const c = cardapio && normalizarConteudo(conteudo, cardapio);
    if (catalogoLido.current !== cardapio || !c || !quantidadeValida(quantidade) || itensRef.current.length >= 200) return "";
    const id = novoId(); gravar([...itensRef.current, { id, quantidade, conteudo: c }]); return id;
  }, [cardapio, gravar]);
  const atualizar = useCallback((id: string, conteudo: ConteudoSacola, quantidade?: number) => {
    if (!cardapio || catalogoLido.current !== cardapio) return false;
    const proximos = atualizarItem(itensRef.current, id, conteudo, quantidade, cardapio);
    if (!proximos) return false;
    gravar(proximos); return true;
  }, [cardapio, gravar]);
  const alterarQuantidade = useCallback((id: string, quantidade: number) => {
    if (!quantidadeValida(quantidade) || !itensRef.current.some((i) => i.id === id)) return;
    gravar(itensRef.current.map((i) => i.id === id ? { ...i, quantidade } : i));
  }, [gravar]);
  const remover = useCallback((id: string) => { gravar(removerItem(itensRef.current, id)); }, [gravar]);
  const limpar = useCallback(() => { gravar([]); }, [gravar]);
  const abrirSacola = useCallback(() => setAberta(true), []);
  const fecharSacola = useCallback(() => setAberta(false), []);
  // Retorna cópias para que consumidores não possam alterar o estado interno.
  const valor = useMemo(() => {
    const pronta = !!cardapio && publicacaoLida === cardapio;
    const validos = pronta ? itens.flatMap(item => {
      const conteudo = normalizarConteudo(item.conteudo, cardapio);
      return conteudo ? [{ ...item, conteudo }] : [];
    }) : [];
    return { itens: validos, pronta, aviso, total: cardapio ? validos.reduce((s, i) => s + totalDoItem(i, cardapio), 0) : 0,
      aberta, adicionar, atualizar, alterarQuantidade, remover, limpar, abrirSacola, fecharSacola };
  }, [cardapio, itens, publicacaoLida, aviso, aberta, adicionar, atualizar, alterarQuantidade, remover, limpar, abrirSacola, fecharSacola]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
export function useSacola() { const valor = useContext(Contexto); if (!valor) throw new Error("useSacola precisa de SacolaProvider"); return valor; }
