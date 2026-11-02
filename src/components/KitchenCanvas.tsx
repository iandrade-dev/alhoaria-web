"use client";

import React, { useRef, useState, useEffect } from "react";
import { RotateCcw, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import type { KitchenEngine as KitchenEngineType } from "@/lib/kitchen-engine";

interface KitchenCanvasProps {
  selection: string[];
  replayKey: number;
  onStatus: (status: string) => void;
}

export default function KitchenCanvas({
  selection,
  replayKey,
  onStatus,
}: KitchenCanvasProps) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<KitchenEngineType | null>(null);
  const selected = useRef(selection);
  const callback = useRef(onStatus);
  const initialSelection = useRef(selection.join("|"));
  const replay = useRef(replayKey);

  selected.current = selection;
  callback.current = onStatus;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [active, setActive] = useState(false);

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
    if (!active) return;
    let cancelled = false;
    let instance: KitchenEngineType | null = null;

    const update = (s: string) => {
      if (cancelled) return;
      if (s === "ready") {
        setStatus("ready");
        callback.current?.("Escolha o recheio. A gente monta na sua frente.");
      } else {
        callback.current?.(s);
      }
    };

    setStatus("loading");
    callback.current?.("Preparando a bancada…");

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
      })
      .catch((e) => {
        console.error("Cena 3D indisponível:", e);
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

  return (
    <div
      ref={mount}
      className="relative w-full h-[450px] sm:h-[520px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#140e0a] to-[#0a0705] border border-carvao-borda shadow-2xl flex items-center justify-center select-none"
      data-kitchen-ready={status === "ready" ? "true" : "false"}
      data-kitchen-status={status}
      aria-label="Montagem interativa do pão de alho em 3D"
    >
      {/* Idle overlay */}
      {status === "idle" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-carvao/80 backdrop-blur-sm p-6 text-center">
          <p className="text-sm text-osso font-medium max-w-xs">
            Escolha um recheio abaixo ou clique para iniciar a montagem 3D.
          </p>
          <button
            type="button"
            onClick={() => setActive(true)}
            className="px-6 py-3 rounded-2xl bg-macarico hover:bg-macarico-glow text-white font-bold text-sm shadow-macarico-glow active:scale-95 transition-all"
          >
            Ativar Bancada 3D ao Vivo
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-carvao/90 backdrop-blur-md">
          <div className="w-8 h-8 border-2 border-macarico border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-osso-muted tracking-wider uppercase">
            Preparando a bancada do chef…
          </span>
        </div>
      )}

      {/* Error fallback */}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-center p-6 text-osso-muted text-xs">
          Não foi possível carregar a simulação 3D neste navegador.
        </div>
      )}

      {/* Ready controls */}
      {status === "ready" && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-carvao/85 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={() => engine.current?.rotate(0.35)}
            aria-label="Girar para esquerda"
            className="p-2 rounded-xl text-osso-muted hover:text-osso hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => engine.current?.rotate(-0.35)}
            aria-label="Girar para direita"
            className="p-2 rounded-xl text-osso-muted hover:text-osso hover:bg-white/10 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => engine.current?.zoom(0.85)}
            aria-label="Aproximar zoom"
            className="p-2 rounded-xl text-osso-muted hover:text-osso hover:bg-white/10 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => engine.current?.zoom(1.15)}
            aria-label="Afastar zoom"
            className="p-2 rounded-xl text-osso-muted hover:text-osso hover:bg-white/10 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
