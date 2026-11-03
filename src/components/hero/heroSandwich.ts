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
    { id: "abertura", start: 0, end: 0, title: "LANCHES NO PÃO DE ALHO", handwritten: "O resto é pão." },
    { id: "macarico", start: 0, end: 4, handwritten: "Queijo gratinado no maçarico." },
    { id: "recheio", start: 4, end: 9.5, handwritten: "Recheio de altíssima qualidade.", line: "Costela desfiada, 6 horas no fogo." },
    { id: "explosao", start: 9.5, end: 19.625, handwritten: "Não é só pão de alho.", line: "É lanche recheado de verdade." },
    { id: "final", start: 19.625, end: 19.625, title: "ALHOARIA", handwritten: "Lanches no pão de alho recheado." },
  ],
} as const;
