"use client";

import { useState } from "react";
import { INSTAGRAM_URL } from "@/lib/links";
import { restaurante } from "@/data/restaurante";

const reels = ["DbO6MswRits", "DaD_lHPx6yS", "Dd2BEyCsw7E"];

export default function QuemProva() {
  const [ativo, setAtivo] = useState<string | null>(null);

  return (
    <section
      id="quem-prova"
      className="scroll-mt-[var(--header-height)] bg-carvao px-5 py-16 text-osso sm:px-10 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <p className="mb-3 font-hand text-3xl text-macarico">Direto do salão</p>
        <h2 className="font-display text-5xl uppercase sm:text-7xl">Quem prova, volta</h2>
        <p className="mt-4 text-osso-muted">
          Pão de alho recheado, maçarico na hora. Olha a cara de quem provou.
        </p>

        <ul className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:justify-center md:overflow-visible">
          {reels.map((reelId, index) => (
            <li key={reelId} className="w-[326px] shrink-0 snap-center">
              <div className="relative min-h-[400px] w-[326px] overflow-hidden rounded-xl border border-carvao-borda bg-carvao-leve">
                {ativo === reelId ? <>
                  <button type="button" onClick={() => setAtivo(null)} className="flex min-h-11 w-full items-center justify-center bg-carvao px-4 font-semibold text-osso">Fechar vídeo</button>
                  <iframe
                    src={`https://www.instagram.com/reel/${reelId}/embed/`}
                    title={`Reel do Instagram da ${restaurante.nome}, ${index + 1} de 3`}
                    width="326"
                    height="613"
                    scrolling="no"
                    loading="lazy"
                    allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
                    allowFullScreen
                    className="border-0"
                  />
                </> : <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 p-7 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={restaurante.logo} alt={restaurante.nome} width={100} height={100} loading="lazy" className="h-24 w-24 object-contain" />
                  <p className="font-hand text-3xl">Direto do nosso Instagram</p>
                  <button type="button" onClick={() => setAtivo(reelId)} aria-label={`Carregar vídeo ${index + 1} do Instagram`} className="min-h-12 rounded-full bg-macarico px-6 font-bold text-carvao">▶ Ver vídeo {index + 1}</button>
                  <a href={`https://www.instagram.com/reel/${reelId}/`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">Abrir no Instagram ↗</a>
                </div>}
              </div>
            </li>
          ))}
        </ul>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver mais no Instagram ${restaurante.instagramNome} (abre em nova aba)`}
          className="group mt-8 inline-flex min-h-11 items-center gap-2 rounded border border-macarico px-4 font-semibold text-macarico transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso"
        >
          Ver mais no {restaurante.instagramNome} <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
