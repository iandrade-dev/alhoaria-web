export const heroSandwich = {
  video: {
    desktop: "/assets/hero/hero-desktop.mp4",
    mobile: "/assets/hero/hero-mobile.mp4",
  },
  posters: {
    first: "/assets/hero/poster.webp",
    final: "/assets/hero/poster-final.webp",
  },
  duration: 19.625,
  stages: [
    { id: "abertura", start: 0, end: 0, cues: [] },
    { id: "macarico", start: 0, end: 4, cues: [{ at: 1.2, piece: "caption" }] },
    { id: "recheio", start: 4, end: 9.5, cues: [{ at: 5.6, piece: "recheio" }, { at: 7.4, piece: "horas" }] },
    { id: "explosao", start: 9.5, end: 19.625, cues: [{ at: 13.2, piece: "beat1" }, { at: 15.8, piece: "beat2" }, { at: 18.6, piece: "clear" }] },
    { id: "final", start: 19.625, end: 19.625, cues: [] },
  ],
} as const;
