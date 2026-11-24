"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { criarCardapio, type CardapioAlhoaria } from "@/components/bancada-proto/cardapio";
import type { PublicacaoAlhoaria } from "@/lib/publicacao-alhoaria";

const Catalogo = createContext<CardapioAlhoaria | null>(null);
const AtualizarCatalogo = createContext<((publicacao: PublicacaoAlhoaria | null) => void) | null>(null);

export function CatalogoProvider({ publicacao, children }: {
  publicacao: PublicacaoAlhoaria | null;
  children: ReactNode;
}) {
  const [daRota, setDaRota] = useState<{ inicial: PublicacaoAlhoaria | null; atual: PublicacaoAlhoaria | null }>();
  const atual = daRota?.inicial === publicacao ? daRota.atual : publicacao;
  const cardapio = useMemo(() => atual ? criarCardapio(atual) : null, [atual]);
  const atualizar = useCallback((nova: PublicacaoAlhoaria | null) => {
    setDaRota((anterior) => {
      const vigente = anterior?.inicial === publicacao ? anterior.atual : publicacao;
      if (vigente?.publicationId === nova?.publicationId) return anterior;
      return { inicial: publicacao, atual: nova };
    });
  }, [publicacao]);
  return <AtualizarCatalogo.Provider value={atualizar}>
    <Catalogo.Provider value={cardapio}>{children}</Catalogo.Provider>
  </AtualizarCatalogo.Provider>;
}

/** O layout pode ficar montado ao navegar para uma página que recebeu uma nova publicação. */
export function CatalogoDaRota({ publicacao }: { publicacao: PublicacaoAlhoaria | null }) {
  const atualizar = useContext(AtualizarCatalogo);
  useLayoutEffect(() => atualizar?.(publicacao), [atualizar, publicacao]);
  return null;
}

export function useCatalogo() {
  return useContext(Catalogo);
}
