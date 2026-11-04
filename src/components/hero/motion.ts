export const heroMotion = {
  enter: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
  exit: { duration: 0.14, ease: [0.4, 0, 1, 1] as const },
  stagger: 0.08,
  accent: { type: "spring" as const, stiffness: 380, damping: 28 },
  brush: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
  reveal: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
} as const;
