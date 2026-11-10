"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { INSTAGRAM_URL } from "@/lib/links";
import { restaurante } from "@/data/restaurante";

const words = "PÃO DE ALHO • MAÇARICO • GRATINADO • RECHEADO •";

const lineVariants = {
  hidden: { y: "130%", opacity: 0 },
  visible: (index: number) => ({
    y: "0%",
    opacity: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay: index * 0.08 },
  }),
};

function MarqueeText({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <span aria-hidden={duplicate || undefined} className="marquee-copy inline-flex shrink-0 items-center whitespace-nowrap">
      {words.split(" • ").filter(Boolean).map((word, index) => (
        <span key={`${word}-${index}`} className="marquee-word px-[0.12em]">{word}<span aria-hidden="true">{index < 4 ? " •" : ""}</span></span>
      ))}
    </span>
  );
}

export default function Fechamento() {
  const reducedMotion = useReducedMotion();
  const initial = reducedMotion ? false : "hidden";

  return (
    <section className="relative overflow-hidden bg-creme px-5 py-16 text-carvao sm:px-10 sm:py-24">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-5 bg-carvao [clip-path:polygon(0_0,100%_0,100%_50%,92%_25%,82%_70%,70%_30%,60%_70%,49%_25%,38%_70%,27%_30%,16%_75%,7%_35%,0_65%)]" />
      <motion.div
        className="mx-auto grid max-w-7xl gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] lg:items-center lg:gap-x-12"
        initial={initial}
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
      >
        <h2 className="font-display text-[clamp(56px,11vw,200px)] uppercase leading-[1.08] tracking-[-0.035em]">
          <span className="-mt-[0.18em] block overflow-hidden pt-[0.18em] pb-[0.12em]"><motion.span custom={0} variants={reducedMotion ? undefined : lineVariants} className="block">O FOGO</motion.span></span>
          <span className="-mt-[0.18em] block overflow-hidden pt-[0.18em] pb-[0.12em]">
            <motion.span custom={1} variants={reducedMotion ? undefined : lineVariants} className="block">JÁ TÁ <span className="relative inline-block text-macarico">ACESO.<motion.svg aria-hidden="true" viewBox="0 0 420 28" className="absolute -bottom-[0.13em] left-0 h-[0.12em] w-full overflow-visible" preserveAspectRatio="none"><motion.path d="M4 18 C 92 5, 190 24, 416 7" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: reducedMotion ? 1 : undefined }} whileInView={reducedMotion ? undefined : { pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.55, delay: reducedMotion ? 0 : 0.15, ease: "easeOut" }} /></motion.svg></span></motion.span>
          </span>
        </h2>

        <motion.div custom={1} variants={reducedMotion ? undefined : lineVariants} className="flex flex-col items-start gap-6 lg:items-end">
          <a href="/pedir" className="group relative inline-flex min-h-12 items-center gap-3 overflow-hidden rounded bg-carvao px-6 py-3 font-bold text-creme transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-carvao focus-visible:outline-offset-4">
            <span aria-hidden="true" className="absolute inset-0 origin-bottom scale-y-0 bg-macarico transition-transform duration-[220ms] ease-out group-hover:scale-y-100 group-focus-visible:scale-y-100" />
            <span className="relative">Peça agora</span><span aria-hidden="true" className="relative inline-block transition-transform duration-150 group-hover:translate-x-1 group-focus-visible:translate-x-1">→</span>
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="instagram-link relative inline-flex min-h-11 items-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-carvao">Instagram {restaurante.instagramNome}</a>
          <div className="flex items-center gap-3">
            <Image src={restaurante.logo} alt="" width={64} height={64} className="h-12 w-12 object-contain grayscale" />
            <span className="font-sans text-xs text-carvao">{restaurante.assinatura}</span>
          </div>
        </motion.div>

        <div aria-hidden="true" className="marquee-window lg:col-span-2">
          <div className="marquee-track font-display text-[clamp(28px,5vw,80px)] uppercase leading-[1.2]">
            <MarqueeText /><MarqueeText duplicate />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
