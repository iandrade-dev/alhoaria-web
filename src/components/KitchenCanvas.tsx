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

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
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

    const update = (next: string) => {
      if (cancelled) return;
      if (next === "ready") {
        setStatus("ready");
        callback.current?.("Escolha o recheio. A gente monta na sua frente.");
      } else {
        callback.current?.(next);
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

  const controlClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded text-osso-muted hover:text-osso";

  return (
    <div
      ref={mount}
      className="relative flex h-[420px] w-full select-none items-center justify-center overflow-hidden rounded-xl border border-carvao-borda bg-carvao sm:h-[520px]"
      data-kitchen-ready={status === "ready" ? "true" : "false"}
      data-kitchen-status={status}
      aria-label="Montagem do pão de alho em 3D"
    >
      {status === "idle" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-carvao p-6 text-center">
          <p className="max-w-xs text-sm font-semibold text-osso">
            Escolha um recheio ou abra a bancada para ver a montagem.
          </p>
          <button
            type="button"
            onClick={() => setActive(true)}
            className="inline-flex min-h-11 items-center rounded bg-macarico px-5 text-sm font-semibold text-carvao"
          >
            Ver a montagem
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-carvao">
          <p className="text-sm font-semibold text-osso-muted">Preparando a bancada…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-carvao p-6 text-center text-sm text-osso-muted">
          Não foi possível carregar a simulação 3D neste navegador.
        </div>
      )}

      {status === "ready" && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-carvao-borda bg-carvao p-1">
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
      )}
    </div>
  );
}
