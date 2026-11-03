"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PEDIDO_URL } from "@/lib/links";
import { heroSandwich } from "./heroSandwich";

const duration = heroSandwich.duration;

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const seekingRef = useRef(false);
  const activeRef = useRef(false);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [autoscrolling, setAutoscrolling] = useState(false);
  const staticHero = !!reduceMotion || failed;

  useEffect(() => {
    if (reduceMotion) return;
    setSource(window.matchMedia("(max-width: 767px)").matches ? heroSandwich.video.mobile : heroSandwich.video.desktop);
  }, [reduceMotion]);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || staticHero) return;
    const observer = new IntersectionObserver(([entry]) => {
      activeRef.current = entry.isIntersecting;
      if (!entry.isIntersecting && frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      } else if (entry.isIntersecting) {
        lastFrameRef.current = performance.now();
        frameRef.current = requestAnimationFrame(tick);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [staticHero, source]);

  const tick = useCallback((now: number) => {
    frameRef.current = null;
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!activeRef.current || !video || !section || video.readyState < 1) return;
    if (seekingRef.current) {
      if (!video.dataset.stalledSince) video.dataset.stalledSince = String(now);
      else if (now - Number(video.dataset.stalledSince) > 4000) setFailed(true);
      frameRef.current = requestAnimationFrame(tick);
      return;
    }
    const range = section.offsetHeight - window.innerHeight;
    const progress = range > 0 ? Math.min(1, Math.max(0, (window.scrollY - section.offsetTop) / range)) : 0;
    const target = progress * duration;
    const elapsed = Math.min(0.1, Math.max(0.001, (now - lastFrameRef.current) / 1000));
    lastFrameRef.current = now;
    let next = video.currentTime;
    const delta = target - next;
    if (Math.abs(delta) > 2) next = target - Math.sign(delta) * 2;
    else if (Math.abs(delta) > 0.025) next += Math.sign(delta) * Math.min(Math.abs(delta), elapsed * 1.5);
    if (Math.abs(next - video.currentTime) > 0.02) {
      seekingRef.current = true;
      video.currentTime = Math.max(0, Math.min(duration, next));
    }
    setTime(video.currentTime);
    if (target > video.currentTime + 0.15) {
      if (!video.dataset.stalledSince) video.dataset.stalledSince = String(now);
      else if (now - Number(video.dataset.stalledSince) > 4000) setFailed(true);
    } else delete video.dataset.stalledSince;
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onSeeked = () => { seekingRef.current = false; };
    const onError = () => setFailed(true);
    const onMetadata = () => { video.currentTime = 0; };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.addEventListener("loadedmetadata", onMetadata);
    return () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadedmetadata", onMetadata);
    };
  }, [source]);

  const scrollTo = (selector: string) => document.querySelector(selector)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  const beginAutoscroll = () => {
    const section = sectionRef.current;
    if (!section) return;
    setAutoscrolling(true);
    const start = window.scrollY;
    const end = section.offsetTop + section.offsetHeight - window.innerHeight;
    const distance = end - start;
    const started = performance.now();
    const step = (now: number) => {
      if (!sectionRef.current || !autoscrollRef.current) return;
      const amount = Math.min(1, (now - started) / 13200);
      window.scrollTo(0, start + distance * amount);
      if (amount < 1) requestAnimationFrame(step);
      else setAutoscrolling(false);
    };
    requestAnimationFrame(step);
  };
  const autoscrollRef = useRef(false);
  useEffect(() => { autoscrollRef.current = autoscrolling; }, [autoscrolling]);
  useEffect(() => {
    if (!autoscrolling) return;
    const cancel = () => { autoscrollRef.current = false; setAutoscrolling(false); };
    const keys = (event: KeyboardEvent) => { if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) cancel(); };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });
    window.addEventListener("keydown", keys, { once: true });
    return () => { window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); window.removeEventListener("keydown", keys); };
  }, [autoscrolling]);

  const exploding = !staticHero && time >= heroSandwich.phases.explosion[0] && time < heroSandwich.phases.final[0];
  const finished = staticHero || time >= heroSandwich.phases.final[0];
  const ingredients = [...heroSandwich.ingredients].reverse();

  return (
    <section id="inicio" ref={sectionRef} className={`relative bg-carvao ${staticHero ? "min-h-[calc(100svh-var(--header-height))]" : "h-[550vh]"}`}>
      <div className={`sticky top-[var(--header-height)] flex h-[calc(100svh-var(--header-height))] min-h-[540px] items-center justify-center overflow-hidden bg-carvao ${staticHero ? "static !h-auto min-h-[calc(100svh-var(--header-height))]" : ""}`}>
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,#0A0A0A_82%)]" />
        {source && !failed && !reduceMotion && <video ref={videoRef} aria-hidden="true" muted playsInline preload="auto" poster={heroSandwich.posters.first} src={source} className="absolute inset-0 h-full w-full object-cover" />}
        {staticHero && <img src={heroSandwich.posters.final} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-carvao/50 via-transparent to-carvao/70" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col justify-center px-5 py-12 sm:px-10">
          <AnimatePresence mode="wait">
            {finished ? <motion.div key="final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              <h1 className="font-display text-6xl uppercase leading-[0.9] text-osso sm:text-8xl">{heroSandwich.name}</h1>
              <div className="mt-8 flex flex-wrap gap-4">
                <button onClick={() => scrollTo("#bancada")} className="min-h-12 rounded bg-macarico px-6 font-bold text-carvao hover:bg-queijo focus-visible:outline">Monte o seu</button>
                <a href={PEDIDO_URL} target="_blank" rel="noreferrer" aria-label="Peça no Anota Aí (abre em nova aba)" className="inline-flex min-h-12 items-center rounded border-2 border-osso px-6 font-bold text-osso hover:bg-osso hover:text-carvao">Peça no Anota Aí</a>
              </div>
            </motion.div> : exploding ? <motion.div key="ingredients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative h-full w-full">
              {ingredients.map((ingredient, index) => <motion.p key={ingredient} initial={{ opacity: 0, x: 18 }} animate={{ opacity: Math.min(1, Math.max(0, (time - 13 - index * 0.45) / 0.35)), x: 0 }} transition={{ duration: 0.35 }} className="absolute left-0 max-w-[34%] text-sm font-semibold text-osso drop-shadow-[0_2px_8px_#000] sm:left-auto sm:right-0 sm:max-w-[24%] sm:text-lg" style={{ top: heroSandwich.ingredientPositions[index].top }}>{ingredient}</motion.p>)}
            </motion.div> : <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              {time < 4 ? <><h1 className="font-display text-5xl uppercase leading-[0.9] text-osso sm:text-7xl">{heroSandwich.copy.opening}</h1><p className="mt-3 font-hand text-4xl text-macarico sm:text-5xl">{heroSandwich.copy.handwritten}</p><button onClick={beginAutoscroll} className="pointer-events-auto mt-6 rounded bg-macarico px-5 py-3 font-bold text-carvao focus-visible:outline">Ver como é feito</button><p className="mt-4 text-sm text-osso">Role para ver ↓</p></> : <p className="font-display text-3xl text-osso sm:text-5xl">{time < 6 ? heroSandwich.copy.torch : heroSandwich.copy.sandwich}</p>}
            </motion.div>}
          </AnimatePresence>
        </div>
        <a href="#bancada" className="absolute bottom-5 right-5 z-20 rounded px-3 py-2 text-sm text-osso underline underline-offset-4 hover:text-ouro focus-visible:outline">Pular animação</a>
      </div>
    </section>
  );
}
