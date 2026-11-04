"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { PEDIDO_URL } from "@/lib/links";
import { heroSandwich } from "./heroSandwich";
import { heroMotion } from "./motion";

const stages = heroSandwich.stages;
const finalIndex = stages.length - 1;
const mediaClass = "absolute left-1/2 top-[72%] aspect-[1264/720] h-auto w-[175vw] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover [mask-image:radial-gradient(ellipse_64%_68%_at_50%_50%,#000_72%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_64%_68%_at_50%_50%,#000_72%,transparent_100%)] md:left-auto md:right-0 md:top-1/2 md:w-[57vw] md:max-w-full md:translate-x-0 md:-translate-y-1/2";
const enter = { opacity: 1, y: 0, filter: "blur(0px)" };
const initial = { opacity: 0, y: 16, filter: "blur(6px)" };
const exit = { opacity: 0, y: -12, filter: "blur(0px)" };
const openingLines = ["LANCHES NO", "PÃO DE ALHO"];

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barProgress = useMotionValue(0);
  const barScale = useSpring(barProgress, heroMotion.accent);
  const stageRef = useRef(0);
  const playingRef = useRef(false);
  const pendingRef = useRef(false);
  const cueRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastMovementRef = useRef(0);
  const wheelRef = useRef(0);
  const lastWheelRef = useRef(0);
  const wheelConsumedRef = useRef(false);
  const suppressScrollRef = useRef(false);
  const touchRef = useRef<number | null>(null);
  const touchConsumedRef = useRef(false);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [stageIndex, setStageIndex] = useState(0);
  const [cueCount, setCueCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const shakeControls = useAnimationControls();
  const flashControls = useAnimationControls();
  const [progress, setProgress] = useState(0);
  const [coarse, setCoarse] = useState(false);
  const staticHero = reduceMotion === true || status === "fallback";

  useEffect(() => {
    if (reduceMotion) return;
    setSource(window.matchMedia("(max-width: 767px)").matches ? heroSandwich.video.mobile : heroSandwich.video.desktop);
    const pointer = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(pointer.matches);
    update();
    pointer.addEventListener("change", update);
    return () => pointer.removeEventListener("change", update);
  }, [reduceMotion]);

  const clearIdle = useCallback(() => {
    if (idleRef.current !== null) clearTimeout(idleRef.current);
    idleRef.current = null;
  }, []);

  const endedRef = useRef<() => void>(() => {});
  const stopPlayback = useCallback(() => {
    clearIdle();
    endedRef.current();
    endedRef.current = () => {};
    shakeControls.stop();
    flashControls.stop();
    shakeControls.set({ x: 0 });
    flashControls.set({ opacity: 0 });
    playingRef.current = false;
    pendingRef.current = false;
    setPlaying(false);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    videoRef.current?.pause();
  }, [clearIdle, flashControls, shakeControls]);

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
    suppressScrollRef.current = true;
    window.scrollTo({ top: top + (range * index) / finalIndex, behavior: "instant" });
    requestAnimationFrame(() => { suppressScrollRef.current = false; });
  }, []);

  const updateCues = useCallback((time: number, index: number) => {
    const stage = stages[index];
    const count = stage.cues.filter((cue) => time >= cue.at).length;
    if (count !== cueRef.current) {
      if (stage.id === "explosao" && cueRef.current < 1 && count >= 1 && !reduceMotion) {
        void shakeControls.start({ x: [0, 3, -2, 2, -3, 0], transition: { duration: 0.2 } });
        void flashControls.start({ opacity: [0, 0.18, 0], transition: { duration: 0.18 } });
      }
      cueRef.current = count;
      setCueCount(count);
    }
    const fraction = stage.end > stage.start ? Math.max(0, Math.min(1, (time - stage.start) / (stage.end - stage.start))) : 0;
    barProgress.set((index + fraction) / finalIndex);
  }, [barProgress, flashControls, reduceMotion, shakeControls]);

  const enterFinal = useCallback((seek = true) => {
    if (stageRef.current === finalIndex) return; // One terminal transition, even if ended and a gesture arrive together.
    stopPlayback();
    stageRef.current = finalIndex;
    cueRef.current = 0;
    setCueCount(0);
    setStageIndex(finalIndex);
    barProgress.set(1);
    positionStage(finalIndex);
    if (seek && videoRef.current) {
      try { videoRef.current.currentTime = stages[finalIndex].start; } catch { fail(); }
    }
  }, [barProgress, fail, positionStage, stopPlayback]);

  const nextStageRef = useRef<() => void>(() => {});
  const resetIdle = useCallback(() => {
    clearIdle();
    if (stageRef.current < finalIndex && !playingRef.current) {
      idleRef.current = setTimeout(() => {
        idleRef.current = null;
        if (!playingRef.current) nextStageRef.current();
      }, 5000);
    }
  }, [clearIdle]);

  const nextStage = useCallback(() => {
    const video = videoRef.current;
    if (stageRef.current >= finalIndex || !video) return;
    if (stageRef.current === 0 && status === "loading") return;
    if (video.readyState < 1) {
      if (status === "ready") fail(); // A ready signal with no seekable metadata must not trap navigation.
      return;
    }
    clearIdle();
    if (playingRef.current) {
      pendingRef.current = true; // Only one forward gesture can queue while a clip plays.
      return;
    }
    const index = stageRef.current + 1;
    if (index === finalIndex) { enterFinal(); return; }
    const stage = stages[index];
    stageRef.current = index;
    cueRef.current = 0;
    setCueCount(0);
    setStageIndex(index);
    endedRef.current();
    endedRef.current = () => {};
    positionStage(index);
    playingRef.current = true;
    setPlaying(true);
    lastTimeRef.current = stage.start;
    lastMovementRef.current = performance.now();
    video.playbackRate = 1;
    try {
      video.currentTime = stage.start;
      updateCues(stage.start, index);
      const finish = () => {
        if (!playingRef.current || stageRef.current !== index) return;
        if (stage.id === "explosao") { enterFinal(false); return; }
        video.pause();
        endedRef.current();
        endedRef.current = () => {};
        try { video.currentTime = stage.end; } catch { fail(); return; }
        updateCues(stage.end, index);
        playingRef.current = false;
        setPlaying(false);
        if (pendingRef.current) {
          pendingRef.current = false;
          nextStageRef.current();
        } else resetIdle();
      };
      const tick = (now: number) => {
        frameRef.current = null;
        if (!playingRef.current || stageRef.current !== index) return;
        const time = video.currentTime;
        updateCues(time, index);
        // The last clip finishes on the media's real ended event; never cut or seek it early.
        if (stage.id !== "explosao" && (time >= stage.end - 0.035 || video.ended)) { finish(); return; }
        if (time > lastTimeRef.current + 0.01) {
          lastTimeRef.current = time;
          lastMovementRef.current = now;
        }
        if (now - lastMovementRef.current > 3000) { fail(); return; }
        frameRef.current = requestAnimationFrame(tick);
      };
      const ended = () => {
        video.removeEventListener("ended", ended);
        if (stageRef.current === index) finish();
      };
      video.addEventListener("ended", ended, { once: true });
      // Remove this listener when the stage is interrupted or superseded, too.
      endedRef.current = () => video.removeEventListener("ended", ended);
      frameRef.current = requestAnimationFrame(tick);
      void video.play().catch(() => {
        if (playingRef.current && stageRef.current === index) fail();
      });
    } catch { fail(); }
  }, [clearIdle, enterFinal, fail, positionStage, resetIdle, status, updateCues]);
  nextStageRef.current = nextStage;

  const restart = useCallback(() => {
    stopPlayback();
    stageRef.current = 0;
    cueRef.current = 0;
    setCueCount(0);
    setStageIndex(0);
    barProgress.set(0);
    try {
      if (videoRef.current) videoRef.current.currentTime = 0;
      positionStage(0);
      resetIdle();
    } catch { fail(); }
  }, [barProgress, fail, positionStage, resetIdle, stopPlayback]);

  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const afterLoader = setTimeout(() => { if (stageRef.current === 0) resetIdle(); }, 350); // Count five seconds after the loader's fade-out.
    return () => { clearTimeout(afterLoader); clearIdle(); };
  }, [status, staticHero, resetIdle, clearIdle]);

  // Non-navigation activity restarts inactivity without consuming a stage.
  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const onActivity = () => {
      const rect = sectionRef.current?.getBoundingClientRect();
      if (rect && rect.top <= window.innerHeight && rect.bottom >= 0) resetIdle();
    };
    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, [status, staticHero, resetIdle]);

  // Loader progress ends at the minimum playable buffer, not at the full media duration.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== "loading" || reduceMotion) return;
    const started = performance.now();
    let lastProgress = started;
    const minimum = stages.find((stage) => stage.id === "recheio")!.end;
    const bufferedEnd = () => {
      let end = 0;
      for (let i = 0; i < video.buffered.length; i++) end = Math.max(end, video.buffered.end(i));
      return end;
    };
    let lastBuffer = bufferedEnd();
    const ready = () => { setProgress(1); setStatus("ready"); };
    const update = () => {
      const end = bufferedEnd();
      if (end > lastBuffer) lastProgress = performance.now();
      lastBuffer = Math.max(lastBuffer, end);
      setProgress(Math.min(1, lastBuffer / minimum));
      if (lastBuffer >= minimum) ready();
    };
    video.addEventListener("progress", update);
    video.addEventListener("canplaythrough", ready);
    video.addEventListener("error", fail);
    if (video.readyState >= 4 || lastBuffer >= minimum) ready();
    else if (video.error) fail();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (bufferedEnd() > lastBuffer) update();
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
    const timeupdate = () => { if (playingRef.current) updateCues(video.currentTime, stageRef.current); };
    video.addEventListener("timeupdate", timeupdate);
    return () => { video.removeEventListener("error", fail); video.removeEventListener("timeupdate", timeupdate); };
  }, [status, staticHero, fail, updateCues]);

  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const inHero = () => {
      const rect = sectionRef.current?.getBoundingClientRect();
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
      return !!rect && rect.top <= header + 2 && rect.bottom >= window.innerHeight - 2;
    };
    const gesture = (direction: number, event: Event) => {
      if (!inHero()) return;
      if (direction > 0 && stageRef.current < finalIndex) {
        event.preventDefault();
        nextStage();
      } else if (direction < 0 && stageRef.current > 0) {
        event.preventDefault();
        restart();
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (!inHero()) { wheelRef.current = 0; wheelConsumedRef.current = false; return; }
      resetIdle();
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * window.innerHeight : event.deltaY;
      const now = performance.now();
      if (now - lastWheelRef.current > 250 || (wheelRef.current !== 0 && Math.sign(pixels) !== Math.sign(wheelRef.current))) {
        wheelRef.current = 0;
        wheelConsumedRef.current = false;
      }
      lastWheelRef.current = now;
      wheelRef.current += pixels;
      if ((pixels > 0 && stageRef.current < finalIndex) || (pixels < 0 && stageRef.current > 0)) event.preventDefault();
      if (Math.abs(wheelRef.current) >= 40 && !wheelConsumedRef.current) {
        wheelConsumedRef.current = true;
        gesture(Math.sign(pixels), event);
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      touchRef.current = event.touches[0]?.clientY ?? null;
      touchConsumedRef.current = false;
      if (inHero()) resetIdle();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (touchRef.current === null || !event.touches[0] || !inHero()) return;
      resetIdle();
      const delta = touchRef.current - event.touches[0].clientY;
      if ((delta > 0 && stageRef.current < finalIndex) || (delta < 0 && stageRef.current > 0)) event.preventDefault();
      if (Math.abs(delta) >= 40 && !touchConsumedRef.current) {
        touchConsumedRef.current = true;
        gesture(Math.sign(delta), event);
      }
    };
    const onTouchEnd = () => { touchRef.current = null; touchConsumedRef.current = false; };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test((event.target as HTMLElement)?.tagName ?? "") || (event.target as HTMLElement)?.isContentEditable || !inHero()) return;
      resetIdle();
      const down = ["ArrowDown", "PageDown", " "].includes(event.key);
      const up = ["ArrowUp", "PageUp"].includes(event.key);
      if (event.repeat) {
        if ((down && stageRef.current < finalIndex) || (up && stageRef.current > 0)) event.preventDefault();
        return;
      }
      if (down) gesture(1, event);
      if (up) gesture(-1, event);
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
  }, [status, staticHero, nextStage, restart, resetIdle]);

  useEffect(() => {
    if (status !== "ready" || staticHero) return;
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section || stageRef.current === finalIndex || suppressScrollRef.current) return;
      // Anchor/history jumps past the sticky area must not leave a trapped unfinished hero.
      if (section.getBoundingClientRect().bottom < window.innerHeight - 2) enterFinal();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [status, staticHero, enterFinal]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const scrollToBancada = () => {
    enterFinal();
    document.querySelector("#bancada")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };
  const skip = () => {
    if (status === "loading") {
      fail(); // No metadata is required to skip the loader.
    } else enterFinal();
    document.querySelector("#bancada")?.scrollIntoView({ behavior: "instant" });
  };
  const visible = staticHero || status === "ready";
  const stage = stages[staticHero ? finalIndex : stageIndex];
  const show = (piece: string) => staticHero || stage.cues.slice(0, cueCount).some((cue) => cue.piece === piece);
  const textMotion = { initial, animate: enter, exit: { ...exit, transition: heroMotion.exit }, transition: heroMotion.enter };

  return (
    <section id="inicio" ref={sectionRef} className={`relative bg-carvao ${staticHero ? "min-h-[calc(100svh-var(--header-height))]" : "h-[500svh]"}`}>
      <div className={`${staticHero ? "relative" : "sticky top-[var(--header-height)]"} flex h-[calc(100svh-var(--header-height))] min-h-[540px] items-center justify-center overflow-hidden bg-carvao`}>
        <motion.div className="absolute inset-0" animate={shakeControls}>
          {source && !staticHero && <video ref={videoRef} aria-hidden="true" muted playsInline preload="auto" poster={heroSandwich.posters.first} src={source} className={`${mediaClass} ${visible ? "opacity-100" : "opacity-0"}`} />}
          {staticHero && <img src={heroSandwich.posters.final} alt="" className={`${mediaClass} opacity-75`} />}
        </motion.div>
        {!reduceMotion && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-macarico" initial={{ opacity: 0 }} animate={flashControls} />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-carvao/50 via-transparent to-carvao/70" />
        {visible && !staticHero && stageIndex < finalIndex && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] bg-osso/15 md:hidden"><motion.div className="h-full origin-left bg-macarico" style={{ scaleX: barScale }} /></div>}
        {visible && !staticHero && stageIndex < finalIndex && <div aria-hidden="true" className="pointer-events-none absolute right-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-5 md:flex">
          <div className="absolute bottom-1 top-1 w-px bg-osso/30" />
          {stages.map((item, index) => <motion.span key={item.id} className={`relative h-[9px] w-[9px] rounded-full ${index <= stageIndex ? "bg-macarico shadow-[0_0_12px_3px_#FF6A1A88]" : "bg-osso/30"}`} animate={index === stageIndex && !reduceMotion ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }} transition={index === stageIndex ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : heroMotion.enter} />)}
        </div>}
        {visible && <div className="pointer-events-none absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-carvao/50 to-transparent md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-[48%] md:bg-gradient-to-r md:from-carvao/60 md:to-transparent" />}
        {visible && <div className="relative z-10 mx-auto h-full w-full max-w-7xl px-5 pt-8 sm:px-10 md:flex md:items-center md:pt-0">
          <div className="relative h-[285px] w-full max-w-[95%] sm:h-[330px] md:h-[360px] md:max-w-[40%]">
            <AnimatePresence initial={false}>
              <motion.div key={stage.id} className="absolute inset-0 flex flex-col items-start justify-start md:justify-center" initial={staticHero ? false : initial} animate={enter} exit={{ ...exit, transition: heroMotion.exit }} transition={heroMotion.enter}>
                {stage.id === "abertura" && <>
                  <h1 className="font-display text-[clamp(38px,7vw,88px)] uppercase leading-[0.94] text-osso" aria-label="LANCHES NO PÃO DE ALHO">
                    {openingLines.map((line, index) => <span key={line} className="block overflow-hidden" aria-hidden="true"><motion.span className="block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ ...heroMotion.reveal, delay: index * heroMotion.stagger }}>{line}</motion.span></span>)}
                  </h1>
                  <motion.p initial={{ x: -6, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...heroMotion.enter, delay: 0.1 }} className="mt-3 -rotate-3 font-hand text-3xl text-macarico md:text-5xl">O resto é pão.</motion.p>
                  <motion.button type="button" onClick={nextStage} whileTap={{ scale: 0.98 }} className="mt-6 min-h-12 rounded bg-macarico px-5 py-3 font-bold text-carvao transition-colors duration-160 hover:bg-queijo focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Ver como é feito</motion.button>
                </>}
                {stage.id === "macarico" && <AnimatePresence>{show("caption") && <motion.div key="caption" initial={initial} animate={enter} exit={{ ...exit, transition: heroMotion.exit }} transition={heroMotion.enter} className="mt-4 inline-block max-w-full">
                  <motion.div className="origin-left bg-macarico px-3 py-1 text-carvao [clip-path:polygon(0_9%,7%_3%,18%_7%,34%_1%,53%_5%,78%_0,100%_7%,98%_91%,82%_97%,63%_92%,41%_100%,17%_94%,0_98%)]" initial={{ scaleX: 0.05, rotate: -1.5 }} animate={{ scaleX: 1, rotate: -1 }} transition={heroMotion.brush}>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...heroMotion.enter, delay: 0.08 }} className="font-hand text-[30px] leading-tight md:text-[44px]">Queijo gratinado no maçarico.</motion.p>
                  </motion.div>
                </motion.div>}</AnimatePresence>}
                {stage.id === "recheio" && <>
                  <AnimatePresence>{show("recheio") && <motion.div {...textMotion} className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="font-display text-[clamp(44px,5vw,80px)] leading-none text-creme">RECHEIO</p>
                    <p className="font-hand text-2xl leading-tight text-osso md:text-3xl">de altíssima qualidade.</p>
                  </motion.div>}</AnimatePresence>
                  <AnimatePresence>{show("horas") && <motion.div {...textMotion} className="mt-5">
                    <p className="font-sans text-[18px] text-osso md:text-[20px]">Costela desfiada</p>
                    <div className="flex items-baseline gap-3"><motion.strong initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={heroMotion.accent} className="font-display text-[clamp(42px,5vw,76px)] leading-none text-ouro">6 HORAS</motion.strong><span className="font-sans text-[18px] text-osso md:text-[20px]">no fogo</span></div>
                  </motion.div>}</AnimatePresence>
                </>}
                {stage.id === "explosao" && <>
                  <AnimatePresence>{show("beat1") && !show("clear") && <motion.p {...textMotion} className="font-hand text-[clamp(34px,4vw,60px)] leading-tight text-osso">Não é só pão de alho.</motion.p>}</AnimatePresence>
                  <AnimatePresence>{show("beat2") && !show("clear") && <motion.p {...textMotion} className="mt-4 font-display text-[clamp(38px,4.5vw,70px)] uppercase leading-[0.95] text-creme">É LANCHE RECHEADO DE VERDADE.</motion.p>}</AnimatePresence>
                </>}
                {stage.id === "final" && <>
                  <h1 className="font-display text-[clamp(56px,7vw,110px)] leading-none text-osso">ALHOARIA</h1>
                  <p className="mt-3 font-hand text-3xl text-macarico md:text-5xl">Lanches no pão de alho recheado.</p>
                  <motion.div initial={staticHero ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heroMotion.enter, delay: staticHero ? 0 : 0.1 }} className="mt-8 flex flex-wrap gap-4">
                    <motion.a whileTap={{ scale: 0.98 }} href={PEDIDO_URL} target="_blank" rel="noopener noreferrer" aria-label="Peça agora (abre em nova aba)" className="inline-flex min-h-12 items-center rounded bg-macarico px-6 font-bold text-carvao transition-colors duration-160 hover:bg-queijo focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Peça agora</motion.a>
                    <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={scrollToBancada} className="min-h-12 rounded border-2 border-osso px-6 font-bold text-osso transition-colors duration-160 hover:bg-osso hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Monte o seu</motion.button>
                  </motion.div>
                </>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>}
        <AnimatePresence>{visible && !staticHero && stageIndex < finalIndex && !playing && <motion.button key="scroll" type="button" onClick={() => { resetIdle(); nextStage(); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute bottom-14 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center rounded px-3 py-2 text-center text-osso focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro md:bottom-8" aria-label="Deslize para baixo: avançar uma etapa">
          <motion.span className="whitespace-nowrap font-display uppercase tracking-[0.13em]" style={{ fontSize: "clamp(18px, 2.2vw, 44px)" }} animate={{ opacity: [0.55, 0.85, 0.55] }} transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}>{coarse ? "Deslize" : "Role para baixo"}</motion.span>
          <motion.span aria-hidden="true" className="text-3xl leading-none text-macarico" animate={{ y: [0, 7, 0] }} transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}>↓</motion.span>
        </motion.button>}</AnimatePresence>
        {!staticHero && <button type="button" onClick={skip} className="absolute bottom-5 right-5 z-40 rounded px-3 py-2 text-sm text-osso underline underline-offset-4 hover:text-ouro focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">Pular animação</button>}
        <AnimatePresence>{!staticHero && status === "loading" && <motion.div key="loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} aria-hidden="true" className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-carvao">
          <motion.img src="/assets/photos/logo-anota.webp" alt="" className="h-24 w-24 object-contain" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <div className="mt-6 h-1 w-32 overflow-hidden rounded-full bg-osso/30"><div className="h-full origin-left bg-macarico transition-transform duration-300" style={{ transform: `scaleX(${progress})` }} /></div>
        </motion.div>}</AnimatePresence>
        {!staticHero && status === "loading" && <span className="sr-only" role="status">Carregando</span>}
      </div>
    </section>
  );
}
