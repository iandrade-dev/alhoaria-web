"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";

type RevelarPalavrasProps = {
  texto: string;
  className?: string;
  atraso?: number;
  visivel: boolean;
  apoio?: boolean;
};

export function RevelarPalavras({ texto, className, atraso = 0, visivel, apoio = false }: RevelarPalavrasProps) {
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const shownRef = useRef(false);
  const visibleRef = useRef(visivel);
  visibleRef.current = visivel;
  const palavras = texto.split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (reduceMotion) {
      controls.set({ y: 0 });
      return;
    }
    if (visivel) {
      controls.set({ y: "130%" });
      void controls.start("visible").then(() => {
        if (visibleRef.current) shownRef.current = true;
      });
    } else if (shownRef.current) {
      shownRef.current = false;
      void controls.start({ y: "-130%", transition: { duration: 0.22, ease: [0.7, 0, 0.84, 0] } });
    } else {
      controls.set({ y: "130%" });
    }
  }, [atraso, controls, reduceMotion, visivel]);

  const variants = {
    hidden: { y: "130%" },
    visible: (index: number) => ({
      y: "0%",
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const, delay: atraso + index * (apoio ? 0.03 : 0.06) },
    }),
  };

  return (
    <span className={className} aria-label={texto}>
      {palavras.map((palavra, index) => (
        <span key={`${index}-${palavra}`} className="mr-[0.25em] mt-[-0.18em] inline-block overflow-hidden pt-[0.18em] pb-[0.12em] align-top" aria-hidden="true">
          <motion.span custom={index} variants={variants} initial={reduceMotion ? false : "hidden"} animate={reduceMotion ? { y: 0 } : controls} className="inline-block">
            {palavra}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
