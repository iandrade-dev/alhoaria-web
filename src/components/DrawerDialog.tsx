"use client";

import React, { useEffect, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;
let previousBodyOverflow = "";

function lockBodyScroll() {
  if (scrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
  };
}

type Placement = "sheet" | "end" | "center";

type DrawerDialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  placement: Placement;
  children: React.ReactNode;
};

const panelPosition: Record<Placement, string> = {
  sheet:
    "absolute inset-x-0 bottom-0 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border-t border-carvao-borda",
  end: "absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-carvao-borda",
  center:
    "relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-carvao-borda",
};

export default function DrawerDialog({
  open,
  onClose,
  labelledBy,
  placement,
  children,
}: DrawerDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dragControls = useDragControls();
  const reduce = useReducedMotion() === true;

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const unlockScroll = lockBodyScroll();

    const focusDialog = () => node?.focus();
    focusDialog();
    const frame = requestAnimationFrame(focusDialog);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || active === node || !node.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      unlockScroll();
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  const motionProps =
    placement === "end"
      ? {
          initial: { x: reduce ? 0 : "100%" },
          animate: { x: 0 },
          exit: { x: reduce ? 0 : "100%" },
        }
      : placement === "center"
        ? {
            initial: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 12 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: reduce ? 0 : 12 },
          }
        : {
            initial: { y: reduce ? 0 : "100%" },
            animate: { y: 0 },
            exit: { y: reduce ? 0 : "100%" },
          };

  const canDrag = placement === "sheet" && !reduce;

  return (
    <AnimatePresence>
      {open && (
        <div
          className={
            placement === "center"
              ? "fixed inset-0 z-50 flex items-center justify-center p-4"
              : "fixed inset-0 z-50"
          }
        >
          <motion.div
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={`z-10 bg-carvao outline-none ${panelPosition[placement]}`}
            {...motionProps}
            transition={transition}
            drag={canDrag ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 96) onCloseRef.current();
            }}
          >
            {canDrag && (
              <div
                className="flex justify-center pt-2"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <span className="h-1 w-10 rounded bg-carvao-borda" />
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
