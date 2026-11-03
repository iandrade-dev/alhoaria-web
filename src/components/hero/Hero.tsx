"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PEDIDO_URL } from "@/lib/links";
import { heroSandwich } from "./heroSandwich";

const stages = heroSandwich.stages;
const finalIndex = stages.length - 1;
const mediaClass = "absolute left-1/2 top-[72%] aspect-[1264/720] h-auto w-[175vw] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover [mask-image:radial-gradient(ellipse_64%_68%_at_50%_50%,#000_72%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_64%_68%_at_50%_50%,#000_72%,transparent_100%)] md:left-auto md:right-0 md:top-1/2 md:w-[57vw] md:max-w-full md:translate-x-0 md:-translate-y-1/2";

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const stageRef = useRef(0);
  const playingRef = useRef(false);
  const pendingRef = useRef(false);
  const automaticRef = useRef(false);
  const interruptedUntilRef = useRef(0);
  const wheelRef = useRef(0);
  const lastWheelRef = useRef(0);
  const wheelConsumedRef = useRef(false);
  const touchRef = useRef<number | null>(null);
  const touchConsumedRef = useRef(false);
  const lastTimeRef = useRef(0);
  const lastMovementRef = useRef(0);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const staticHero = reduceMotion === true || status === "fallback";

  useEffect(() => {
    if (reduceMotion) return;
    setSource(window.matchMedia("(max-width: 767px)").matches ? heroSandwich.video.mobile : heroSandwich.video.desktop);
  }, [reduceMotion]);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    pendingRef.current = false;
    automaticRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    videoRef.current?.pause();
  }, []);

  const fail = useCallback(() => {
    stopPlayback();
    stageRef.current = finalIndex;
    setStageIndex(finalIndex);
    setStatus("fallback");
  }, [stopPlayback]);

  const positionStage = useCallback((index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + (range * index) / finalIndex, behavior: "instant" });
  }, []);

  const nextStage = useCallback(() => {
    const video = videoRef.current;
    if (!video || stageRef.current >= finalIndex || video.readyState < 1) return;
    if (playingRef.current) {
      pendingRef.current = true; // No more than one gesture is queued while the video runs.
      return;
    }
    const index = stageRef.current + 1;
    const stage = stages[index];
    stageRef.current = index;
    setStageIndex(index);
    positionStage(index);
    if (index === finalIndex) {
      video.pause();
      try { video.currentTime = stage.end; } catch { fail(); }
      automaticRef.current = false;
      return;
    }
    playingRef.current = true;
    lastTimeRef.current = stage.start;
    lastMovementRef.current = performance.now();
    video.playbackRate = 1;
    try {
      video.currentTime = stage.start;
      const tick = (now: number) => {
        frameRef.current = null;
        if (!playingRef.current || !videoRef.current) return;
        if (video.currentTime >= stage.end - 0.035 || video.ended) {
          video.pause();
          try { video.currentTime = stage.end; } catch { fail(); return; }
          playingRef.current = false;
          if (pendingRef.current || automaticRef.current) {
            pendingRef.current = false;
            nextStage();
          }
          return;
        }
        if (video.currentTime > lastTimeRef.current + 0.01) {
          lastTimeRef.current = video.currentTime;
          lastMovementRef.current = now;
        }
        if (now - lastMovementRef.current > 3000) {
          fail(); // A stalled seek/play must never trap the visitor in the hero.
          return;
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
      void video.play().catch(fail);
    } catch {
      fail();
    }
  }, [fail, positionStage]);

  const previousStage = useCallback(() => {
    if (stageRef.current === 0) return;
    stopPlayback();
    const index = stageRef.current - 1;
    stageRef.current = index;
    setStageIndex(index);
    try {
      if (videoRef.current) videoRef.current.currentTime = stages[index].start;
      positionStage(index);
    } catch {
      fail();
    }
  }, [fail, positionStage, stopPlayback]);

  // Download progress is monitored independently of the playback watchdog.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== "loading" || reduceMotion) return;
    const started = performance.now();
    let lastProgress = started;
    const bufferedEnd = () => {
      let end = 0;
      for (let i = 0; i < video.buffered.length; i++) end = Math.max(end, video.buffered.end(i));
      return end;
    };
    let lastBuffer = bufferedEnd();
    const update = () => {
      const end = bufferedEnd();
      if (end > lastBuffer) lastProgress = performance.now();
      lastBuffer = Math.max(lastBuffer, end);
      setProgress(Math.min(1, lastBuffer / heroSandwich.duration));
      if (lastBuffer >= stages[2].end) setStatus("ready");
    };
    const ready = () => setStatus("ready");
    video.addEventListener("progress", update);
    video.addEventListener("canplaythrough", ready);
    video.addEventListener("error", fail);
    // Cached sources may have loaded before the effect subscribed.
    if (video.readyState >= 4) ready();
    else if (lastBuffer >= stages[2].end) ready();
    else if (video.error) fail();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const end = bufferedEnd();
      if (end > lastBuffer) update();
      else if (now - lastProgress >= 6000 || now - started >= 20000) fail();
    }, 250);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener("progress", update);
      video.removeEventListener("canplaythrough", ready);
      video.removeEventListener("error", fail);
    };
  }, [source, status, reduceMotion, fail]);

  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("error", fail);
    return () => video.removeEventListener("error", fail);
  }, [status, staticHero, fail]);

  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const inHero = () => {
      const rect = sectionRef.current?.getBoundingClientRect();
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
      return !!rect && rect.top <= header + 2 && rect.bottom >= window.innerHeight - 2;
    };
    const gesture = (direction: number, event: Event) => {
      if (!inHero()) return;
      if (automaticRef.current) {
        event.preventDefault();
        automaticRef.current = false;
        pendingRef.current = false;
        interruptedUntilRef.current = performance.now() + 350;
        return;
      }
      if (performance.now() < interruptedUntilRef.current) {
        event.preventDefault();
        return;
      }
      if (direction > 0 && stageRef.current < finalIndex) {
        event.preventDefault();
        nextStage();
      } else if (direction < 0 && stageRef.current > 0) {
        event.preventDefault();
        previousStage();
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (!inHero()) { wheelRef.current = 0; wheelConsumedRef.current = false; return; }
      if (automaticRef.current && inHero()) {
        event.preventDefault();
        automaticRef.current = false;
        pendingRef.current = false;
        interruptedUntilRef.current = performance.now() + 350;
        wheelRef.current = 0;
        wheelConsumedRef.current = true;
        return;
      }
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * window.innerHeight : event.deltaY;
      const now = performance.now();
      if (now - lastWheelRef.current > 250 || (wheelRef.current !== 0 && Math.sign(pixels) !== Math.sign(wheelRef.current))) {
        wheelRef.current = 0;
        wheelConsumedRef.current = false;
      }
      lastWheelRef.current = now;
      wheelRef.current += pixels;
      // Consume sub-threshold deltas too, so a gesture cannot move the sticky area before advancing.
      if (inHero() && (performance.now() < interruptedUntilRef.current || (pixels > 0 && stageRef.current < finalIndex) || (pixels < 0 && stageRef.current > 0))) event.preventDefault();
      if (Math.abs(wheelRef.current) >= 40 && !wheelConsumedRef.current) {
        wheelConsumedRef.current = true;
        gesture(Math.sign(pixels), event);
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      touchRef.current = event.touches[0]?.clientY ?? null;
      touchConsumedRef.current = false;
      if (automaticRef.current && inHero()) {
        automaticRef.current = false;
        pendingRef.current = false;
        interruptedUntilRef.current = performance.now() + 350;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (touchRef.current === null || !event.touches[0]) return;
      if (performance.now() < interruptedUntilRef.current && inHero()) {
        event.preventDefault();
        return;
      }
      const delta = touchRef.current - event.touches[0].clientY;
      if (inHero() && ((delta > 0 && stageRef.current < finalIndex) || (delta < 0 && stageRef.current > 0))) event.preventDefault();
      if (Math.abs(delta) >= 40 && !touchConsumedRef.current) {
        touchConsumedRef.current = true;
        gesture(Math.sign(delta), event);
      }
    };
    const onTouchEnd = () => { touchRef.current = null; touchConsumedRef.current = false; };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test((event.target as HTMLElement)?.tagName ?? "") || (event.target as HTMLElement)?.isContentEditable) return;
      if (event.repeat) {
        if (inHero() && ((["ArrowDown", "PageDown", " "].includes(event.key) && stageRef.current < finalIndex) || (["ArrowUp", "PageUp"].includes(event.key) && stageRef.current > 0))) event.preventDefault();
        return;
      }
      if (automaticRef.current && inHero()) {
        automaticRef.current = false;
        pendingRef.current = false;
        interruptedUntilRef.current = performance.now() + 350;
        if (["ArrowDown", "PageDown", " ", "ArrowUp", "PageUp"].includes(event.key)) event.preventDefault();
        return;
      }
      if (["ArrowDown", "PageDown", " "].includes(event.key)) gesture(1, event);
      if (["ArrowUp", "PageUp"].includes(event.key)) gesture(-1, event);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [status, staticHero, nextStage, previousStage]);

  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section || stageRef.current === finalIndex) return;
      // A link, anchor or browser history can jump past the sticky area without a gesture.
      // Never bring that visitor back to an unfinished stage on their way up.
      if (section.getBoundingClientRect().bottom < window.innerHeight - 2) {
        stopPlayback();
        stageRef.current = finalIndex;
        setStageIndex(finalIndex);
        try {
          if (videoRef.current) videoRef.current.currentTime = stages[finalIndex].end;
        } catch {
          fail();
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [status, staticHero, stopPlayback, fail]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const scrollToBancada = () => {
    stopPlayback();
    stageRef.current = finalIndex;
    setStageIndex(finalIndex);
    document.querySelector("#bancada")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };
  const stage = stages[staticHero ? finalIndex : stageIndex];
  const visible = staticHero || status === "ready";

  return (
    <section id="inicio" ref={sectionRef} className={`relative bg-carvao ${staticHero ? "min-h-[calc(100svh-var(--header-height))]" : "h-[500svh]"}`}>
      <div className={`${staticHero ? "relative" : "sticky top-[var(--header-height)]"} flex h-[calc(100svh-var(--header-height))] min-h-[540px] items-center justify-center overflow-hidden bg-carvao`}>
        {source && !staticHero && <video ref={videoRef} aria-hidden="true" muted playsInline preload="auto" poster={heroSandwich.posters.first} src={source} className={`${mediaClass} ${visible ? "opacity-100" : "opacity-0"}`} />}
        {staticHero && <img src={heroSandwich.posters.final} alt="" className={`${mediaClass} opacity-75`} />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-carvao/50 via-transparent to-carvao/70" />
        {visible && <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col justify-start px-5 pt-8 sm:px-10 md:justify-center md:pt-12">
          <AnimatePresence mode="wait">
            <motion.div key={stage.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-[90%] md:max-w-[34vw]">
              {"title" in stage && <h1 className="font-display text-5xl uppercase leading-[0.9] text-osso sm:text-7xl">{stage.title}</h1>}
              <div className="mt-4 inline-block max-w-full align-top">
                <motion.div initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0 0 0)" }} transition={{ duration: 0.45 }}>
                  <div className="bg-macarico px-3 py-1 text-carvao [clip-path:polygon(0_9%,7%_3%,18%_7%,34%_1%,53%_5%,78%_0,100%_7%,98%_91%,82%_97%,63%_92%,41%_100%,17%_94%,0_98%)]">
                    <motion.p initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 16 }} className="font-hand text-[30px] leading-tight md:text-[44px]">{stage.handwritten}</motion.p>
                  </div>
                </motion.div>
              </div>
              {"line" in stage && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-4 font-sans text-[17px] leading-snug text-osso">{stage.line}</motion.p>}
              {stageIndex === 0 && !staticHero && <button type="button" onClick={() => { automaticRef.current = true; nextStage(); }} className="mt-6 min-h-12 rounded bg-macarico px-5 py-3 font-bold text-carvao hover:bg-queijo focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Ver como é feito</button>}
              {(stageIndex === finalIndex || staticHero) && <div className="mt-8 flex flex-wrap gap-4">
                <button type="button" onClick={scrollToBancada} className="min-h-12 rounded bg-macarico px-6 font-bold text-carvao hover:bg-queijo focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Monte o seu</button>
                <a href={PEDIDO_URL} target="_blank" rel="noopener noreferrer" aria-label="Peça agora (abre em nova aba)" className="inline-flex min-h-12 items-center rounded border-2 border-osso px-6 font-bold text-osso hover:bg-osso hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Peça agora</a>
              </div>}
            </motion.div>
          </AnimatePresence>
        </div>}
        {visible && !staticHero && stageIndex < finalIndex && <motion.button type="button" onClick={() => { automaticRef.current = false; nextStage(); }} className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded px-4 py-2 text-sm font-semibold text-osso underline underline-offset-4 hover:text-ouro focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro md:bottom-8" aria-label="Role para ver: avançar uma etapa">
          Role para ver <motion.span aria-hidden="true" className="inline-block" animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>↓</motion.span>
        </motion.button>}
        {!staticHero && <a href="#bancada" onClick={() => { stopPlayback(); stageRef.current = finalIndex; setStageIndex(finalIndex); }} className="absolute bottom-5 right-5 z-40 rounded px-3 py-2 text-sm text-osso underline underline-offset-4 hover:text-ouro focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Pular animação</a>}
        <AnimatePresence>{!staticHero && status === "loading" && <motion.div key="loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} aria-hidden="true" className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-carvao">
          <motion.img src="/assets/photos/logo-anota.webp" alt="" className="h-24 w-24 object-contain" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <div className="mt-6 h-1 w-32 overflow-hidden rounded-full bg-osso/30"><div className="h-full bg-macarico transition-[width] duration-300" style={{ width: `${progress * 100}%` }} /></div>
        </motion.div>}</AnimatePresence>
        {!staticHero && status === "loading" && <span className="sr-only" role="status">Carregando</span>}
      </div>
    </section>
  );
}
