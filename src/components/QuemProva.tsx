"use client";

import { useEffect, useRef, useState } from "react";
import { INSTAGRAM_URL } from "@/lib/links";

const reels = ["DbO6MswRits", "DaD_lHPx6yS", "Dd2BEyCsw7E"];

export default function QuemProva() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
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
              <div className="h-[613px] w-[326px] overflow-hidden rounded-md bg-white">
                {isVisible ? (
                  <iframe
                    src={`https://www.instagram.com/reel/${reelId}/embed/`}
                    title={`Reel do Instagram da Alhoaria, ${index + 1} de 3`}
                    width="326"
                    height="613"
                    scrolling="no"
                    loading="lazy"
                    allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
                    allowFullScreen
                    className="border-0"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-[613px] w-[326px] border border-carvao-borda bg-carvao-leve"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver mais no Instagram @alhoaria (abre em nova aba)"
          className="group mt-8 inline-flex min-h-11 items-center gap-2 rounded border border-macarico px-4 font-semibold text-macarico transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso"
        >
          Ver mais no @alhoaria <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
