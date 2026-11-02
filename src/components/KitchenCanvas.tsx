"use client";

import React, { useRef, useState, useEffect } from "react";
import { RotateCcw, ZoomIn, ZoomOut, RotateCw, Flame, Eye, Sparkles } from "lucide-react";
import type { KitchenEngine as KitchenEngineType, CameraPreset } from "@/lib/kitchen-engine";

interface KitchenCanvasProps {
  selection: string[];
  replayKey: number;
  onStatus: (status: string) => void;
  torchTriggerKey?: number;
  cameraPreset?: CameraPreset;
}

export default function KitchenCanvas({
  selection,
  replayKey,
  onStatus,
  torchTriggerKey = 0,
  cameraPreset = "bancada",
}: KitchenCanvasProps) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<KitchenEngineType | null>(null);
  const selected = useRef(selection);
  const callback = useRef(onStatus);
  const initialSelection = useRef(selection.join("|"));
  const replay = useRef(replayKey);
  const lastTorch = useRef(torchTriggerKey);

  selected.current = selection;
  callback.current = onStatus;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [active, setActive] = useState(true); // Default to active on 3D showcase
  const [activePreset, setActivePreset] = useState<CameraPreset>(cameraPreset);

  useEffect(() => {
    if (selection.join("|") !== initialSelection.current) {
      setActive(true);
    }
    engine.current?.setSelection(selection);
  }, [selection]);

  useEffect(() => {
    if (replay.current !== replayKey) {
      replay.current = replayKey;
      setActive(true);
      engine.current?.replay();
    }
  }, [replayKey]);

  useEffect(() => {
    if (torchTriggerKey && torchTriggerKey !== lastTorch.current) {
      lastTorch.current = torchTriggerKey;
      engine.current?.triggerTorch();
    }
  }, [torchTriggerKey]);

  useEffect(() => {
    if (cameraPreset) {
      setActivePreset(cameraPreset);
      engine.current?.setCameraPreset(cameraPreset);
    }
  }, [cameraPreset]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let instance: KitchenEngineType | null = null;

    const update = (next: string) => {
      if (cancelled) return;
      if (next === "ready") {
        setStatus("ready");
        callback.current?.("Bancada pronta. Escolha o recheio e acione o maçarico!");
      } else {
        callback.current?.(next);
      }
    };

    setStatus("loading");
    callback.current?.("Preparando a bancada do chef…");

    import("@/lib/kitchen-engine")
      .then(async ({ KitchenEngine }) => {
        if (cancelled || !mount.current) return;
        instance = new KitchenEngine(mount.current, update);
        await instance.init();
        if (cancelled) {
          instance.dispose();
          return;
        }
        engine.current = instance;
        instance.setSelection(selected.current);
        instance.setCameraPreset(activePreset);
      })
      .catch((error) => {
        console.error("Cena 3D indisponível:", error);
        instance?.dispose();
        if (!cancelled) {
          setStatus("error");
          callback.current?.("Não foi possível carregar a cozinha 3D.");
        }
      });

    return () => {
      cancelled = true;
      engine.current = null;
      instance?.dispose();
    };
  }, [active]);

  const handlePreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    engine.current?.setCameraPreset(preset);
  };

  const handleTorch = () => {
    engine.current?.triggerTorch();
  };

  const controlClass =
    "inline-flex min-h-10 min-w-10 items-center justify-center rounded text-osso-muted hover:text-osso hover:bg-white/5 transition-colors";

  return (
    <div
      ref={mount}
      className="relative flex h-[460px] w-full select-none items-center justify-center overflow-hidden rounded-2xl border border-carvao-borda bg-gradient-to-b from-[#140e0a] to-carvao sm:h-[580px] shadow-2xl shadow-black/80"
      data-kitchen-ready={status === "ready" ? "true" : "false"}
      data-kitchen-status={status}
      aria-label="Montagem ao vivo do pão de alho em 3D com física"
    >
      {status === "idle" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-carvao p-6 text-center">
          <p className="max-w-xs text-sm font-semibold text-osso">
            Toque para entrar na cozinha e acompanhar a montagem 3D.
          </p>
          <button
            type="button"
            onClick={() => setActive(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-macarico px-6 text-sm font-bold text-carvao shadow-lg active:scale-95 transition-transform"
          >
            <Sparkles className="h-4 w-4" />
            Entrar na Bancada
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-carvao/95 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-macarico border-t-transparent" />
          <p className="text-sm font-semibold text-osso-muted">Preparando a bancada do chef…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-carvao p-6 text-center text-sm text-osso-muted">
          Não foi possível carregar a simulação 3D neste navegador.
        </div>
      )}

      {status === "ready" && (
        <>
          {/* Top Camera Presets */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg border border-carvao-borda/80 bg-carvao/90 p-1 backdrop-blur-md">
            <span className="hidden px-2 text-[10px] font-bold uppercase tracking-widest text-osso-muted sm:inline">
              Câmera
            </span>
            <button
              type="button"
              onClick={() => handlePreset("bancada")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                activePreset === "bancada"
                  ? "bg-macarico text-carvao font-bold"
                  : "text-osso-muted hover:text-osso"
              }`}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => handlePreset("macro")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                activePreset === "macro"
                  ? "bg-macarico text-carvao font-bold"
                  : "text-osso-muted hover:text-osso"
              }`}
            >
              Close Suculento
            </button>
            <button
              type="button"
              onClick={() => handlePreset("topo")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                activePreset === "topo"
                  ? "bg-macarico text-carvao font-bold"
                  : "text-osso-muted hover:text-osso"
              }`}
            >
              Topo
            </button>
          </div>

          {/* Quick Maçarico Trigger Button directly on Canvas */}
          <div className="absolute top-3 right-3 z-20">
            <button
              type="button"
              onClick={handleTorch}
              className="inline-flex items-center gap-2 rounded-lg border border-macarico/40 bg-macarico/20 px-3 py-1.5 text-xs font-bold text-macarico hover:bg-macarico hover:text-carvao transition-all active:scale-95 shadow-lg shadow-macarico/10 backdrop-blur-md"
            >
              <Flame className="h-4 w-4" />
              <span>Maçarico 🔥</span>
            </button>
          </div>

          {/* Bottom Right Orbit / Zoom Navigation Controls */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-carvao-borda/80 bg-carvao/90 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => engine.current?.rotate(0.35)}
              aria-label="Girar para a esquerda"
              className={controlClass}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => engine.current?.rotate(-0.35)}
              aria-label="Girar para a direita"
              className={controlClass}
            >
              <RotateCw className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => engine.current?.zoom(0.85)}
              aria-label="Aproximar"
              className={controlClass}
            >
              <ZoomIn className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => engine.current?.zoom(1.15)}
              aria-label="Afastar"
              className={controlClass}
            >
              <ZoomOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
