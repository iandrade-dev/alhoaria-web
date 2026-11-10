"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { restaurante } from "@/data/restaurante";

const Cinema = dynamic(() => import("./HeroCinema"), { ssr: false, loading: () => <div className="grid min-h-[60svh] place-items-center bg-carvao p-8 text-osso" role="status">Preparando a história do lanche…</div> });

/** A foto e o pedido chegam primeiro. O vídeo só é baixado após uma escolha explícita. */
export default function Hero() {
  const [cinema, setCinema] = useState(false);
  if (cinema) return <div className="relative"><button type="button" className="absolute left-4 top-20 z-40 min-h-11 rounded-full bg-carvao/90 px-4 text-sm text-osso" onClick={() => setCinema(false)}>Voltar ao início</button><Cinema /></div>;
  return <section id="inicio" className="relative isolate flex min-h-[min(820px,100svh)] items-end overflow-hidden bg-carvao px-5 pb-16 pt-32 text-osso sm:px-10 sm:pb-20">
    <Image src={restaurante.imagemSocial} alt={`${restaurante.nome} — ${restaurante.subtitulo}`} fill priority sizes="100vw" className="-z-20 object-cover object-center" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-carvao/95 via-carvao/65 to-carvao/15" />
    <div className="mx-auto w-full max-w-7xl">
      <div className="max-w-2xl">
        <p className="mb-4 font-hand text-3xl text-queijo">{restaurante.nome}</p>
        <h1 className="font-display text-[clamp(48px,8vw,104px)] uppercase leading-[1.02]">{restaurante.subtitulo}</h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-osso sm:text-lg">{restaurante.descricao}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/pedir" prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-full bg-macarico px-6 font-bold text-carvao">Escolher meu lanche</Link>
          <Link href="/cardapio" prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-full border border-osso/60 bg-carvao/35 px-6 font-semibold">Ver cardápio</Link>
        </div>
        {restaurante.experiencias.heroCinema && <button type="button" onClick={() => setCinema(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-osso underline underline-offset-4"><span aria-hidden="true">▶</span>Ver a história do lanche</button>}
      </div>
    </div>
  </section>;
}
