"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dispositivoLeve } from "@/lib/desempenho";
import { restaurante } from "@/data/restaurante";

const VIDEO = "/assets/home/monte-o-seu";
const POSTER = `${VIDEO}.webp`;

export default function MonteOSeu() {
  const secao = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [reduzido, setReduzido] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [carregar, setCarregar] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ver = () => setReduzido(media.matches || dispositivoLeve(navigator));
    ver();
    media.addEventListener("change", ver);
    return () => media.removeEventListener("change", ver);
  }, []);

  // o vídeo só começa a carregar (e tocar) quando a faixa entra na tela
  useEffect(() => {
    const el = secao.current;
    if (!el || reduzido) return;
    const obs = new IntersectionObserver(([e]) => { setAtivo(e.isIntersecting); if (e.isIntersecting) setCarregar(true); }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduzido]);

  useEffect(() => {
    const v = video.current;
    if (!v || reduzido) return;
    if (ativo) {
      v.play().catch(() => undefined);
    } else v.pause();
  }, [ativo, reduzido]);

  return (
    <section ref={secao} id="monte-o-seu" className="scroll-mt-[var(--header-height)] bg-carvao px-5 py-16 text-osso sm:px-10 sm:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-14">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-carvao-borda bg-carvao-leve">
          {reduzido ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={POSTER} alt={`Lanche sendo montado na bancada da ${restaurante.nome}`} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <video ref={video} aria-label={`Lanche sendo montado na bancada da ${restaurante.nome}`} autoPlay muted loop playsInline preload="none" poster={POSTER} className="h-full w-full object-cover">
              {carregar && <source src={`${VIDEO}.webm`} type="video/webm" />}
              {carregar && <source src={`${VIDEO}.mp4`} type="video/mp4" />}
            </video>
          )}
        </div>
        <div>
          <p className="mb-3 font-hand text-3xl text-macarico">Na nossa cozinha</p>
          <h2 className="font-display text-5xl uppercase sm:text-7xl">Monte o seu</h2>
          <p className="mt-5 max-w-md text-lg leading-7 text-osso-muted">Escolha o pão, a pasta, o recheio e o queijo, turbine e faça o pedido.</p>
          <Link href="/bancada" prefetch={false} data-testid="home-monte-faixa" className="mt-8 inline-flex min-h-12 items-center rounded bg-macarico px-6 font-bold text-carvao transition-colors duration-160 hover:bg-queijo focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso">Montar meu lanche</Link>
        </div>
      </div>
    </section>
  );
}
