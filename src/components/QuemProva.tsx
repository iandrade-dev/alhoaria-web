"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { INSTAGRAM_URL } from "@/lib/links";
import { restaurante } from "@/data/restaurante";

const REELS = [
  {
    id: "DbO6MswRits",
    titulo: "Queijo gratinado no maçarico",
    subtitulo: "Camada de mussarela dourada na hora",
    imagem: "/assets/hero/poster-final.webp",
  },
  {
    id: "DaD_lHPx6yS",
    titulo: "Na bancada da cozinha",
    subtitulo: "Pasta de alho, recheio quente e creme artesanal",
    imagem: "/assets/home/monte-o-seu.webp",
  },
  {
    id: "Dd2BEyCsw7E",
    titulo: "A Costela no pão de alho",
    subtitulo: "Seis horas de cozimento lento antes da chapa",
    imagem: "/assets/bancada/lanche-costela.webp",
  },
] as const;

export default function QuemProva() {
  const [selecionado, setSelecionado] = useState(0);
  const [reproduzindo, setReproduzindo] = useState<string | null>(null);
  const atual = REELS[selecionado];
  const aberto = reproduzindo === atual.id;

  const mudarPara = (indice: number) => {
    setSelecionado((indice + REELS.length) % REELS.length);
    setReproduzindo(null);
  };

  return (
    <section
      id="quem-prova"
      className="scroll-mt-[var(--header-height)] bg-carvao px-5 py-16 text-osso sm:px-10 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <p className="mb-3 font-hand text-3xl text-macarico">Direto do salão</p>
        <h2 className="font-display text-5xl uppercase sm:text-7xl">Quem prova, volta</h2>
        <p className="mt-4 max-w-xl text-osso-muted">
          Pão de alho recheado e maçarico na hora. Escolha um vídeo do nosso Instagram para assistir aqui.
        </p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-10">
          <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-carvao-borda bg-carvao-leve">
            {aberto ? (
              <div>
                <button
                  type="button"
                  onClick={() => setReproduzindo(null)}
                  className="flex min-h-11 w-full items-center justify-center border-b border-carvao-borda bg-carvao px-4 text-sm font-semibold text-osso hover:text-ouro"
                >
                  Fechar vídeo
                </button>
                <iframe
                  src={`https://www.instagram.com/reel/${atual.id}/embed/`}
                  title={`Reel do Instagram da ${restaurante.nome}: ${atual.titulo}`}
                  width="360"
                  height="560"
                  scrolling="no"
                  loading="lazy"
                  allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
                  allowFullScreen
                  className="w-full border-0"
                />
              </div>
            ) : (
              <div className="relative aspect-[9/12] w-full overflow-hidden">
                <Image
                  src={atual.imagem}
                  alt={atual.titulo}
                  fill
                  sizes="(max-width: 1024px) 360px, 360px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-carvao via-carvao/45 to-carvao/15" />
                <div className="relative flex h-full flex-col justify-between p-5">
                  <span className="w-fit rounded-full border border-osso/20 bg-carvao/80 px-3 py-1 text-xs font-semibold tabular-nums text-osso">
                    {String(selecionado + 1).padStart(2, "0")} / {String(REELS.length).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-3xl uppercase leading-none text-osso">{atual.titulo}</h3>
                    <p className="mt-2 text-sm text-osso-muted">{atual.subtitulo}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setReproduzindo(atual.id)}
                        aria-label={`Carregar vídeo ${selecionado + 1}: ${atual.titulo}`}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-macarico px-5 text-sm font-bold text-carvao transition-colors hover:bg-queijo"
                      >
                        <Play size={15} fill="currentColor" aria-hidden="true" />
                        Ver vídeo
                      </button>
                      <a
                        href={`https://www.instagram.com/reel/${atual.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center px-2 text-sm text-osso underline underline-offset-4 hover:text-ouro"
                      >
                        Abrir no Instagram ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => mudarPara(selecionado - 1)}
                aria-label="Vídeo anterior"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-carvao-borda bg-carvao-leve px-3.5 text-sm font-semibold text-osso hover:border-macarico"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span className="text-sm font-semibold tabular-nums text-osso-muted">
                {selecionado + 1} de {REELS.length}
              </span>
              <button
                type="button"
                onClick={() => mudarPara(selecionado + 1)}
                aria-label="Próximo vídeo"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-carvao-borda bg-carvao-leve px-3.5 text-sm font-semibold text-osso hover:border-macarico"
              >
                Próximo
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>

            <div role="group" aria-label="Vídeos do Instagram" className="hidden flex-col gap-3 lg:flex">
              {REELS.map((reel, index) => {
                const ativo = index === selecionado;
                return (
                  <button
                    key={reel.id}
                    type="button"
                    aria-current={ativo ? "true" : undefined}
                    onClick={() => mudarPara(index)}
                    className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                      ativo
                        ? "border-macarico bg-carvao-leve"
                        : "border-carvao-borda bg-carvao hover:bg-carvao-leve"
                    }`}
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-carvao">
                      <Image src={reel.imagem} alt="" fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold tabular-nums text-ouro">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-0.5 font-display text-2xl uppercase leading-tight text-osso">{reel.titulo}</p>
                      <p className="mt-1 text-sm text-osso-muted">{reel.subtitulo}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver mais no Instagram ${restaurante.instagramNome} (abre em nova aba)`}
              className="group mt-2 inline-flex min-h-11 w-fit items-center gap-2 rounded border border-macarico px-4 font-semibold text-macarico transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso"
            >
              Ver mais no {restaurante.instagramNome} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
