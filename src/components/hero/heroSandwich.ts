import menu from "@/data/menu.json";

const costela = menu.items.find((item) => item.id === "costela");

export const heroSandwich = {
  id: "costela",
  name: costela?.name ?? "A Costela!",
  ingredients: costela?.ingredients ?? [],
  video: {
    desktop: "/assets/hero/hero-desktop.mp4",
    mobile: "/assets/hero/hero-mobile.mp4",
  },
  posters: {
    first: "/assets/hero/poster.webp",
    final: "/assets/hero/poster-final.webp",
  },
  duration: 19.625,
  phases: {
    torch: [0, 4],
    cut: [4, 6],
    opening: [6, 9.5],
    closing: [9.5, 13],
    explosion: [13, 18],
    final: [18, 19.625],
  },
  ingredientPositions: [
    { top: "20%", left: "76%" },
    { top: "40%", left: "76%" },
    { top: "56%", left: "76%" },
    { top: "72%", left: "76%" },
    { top: "85%", left: "76%" },
  ],
  copy: {
    opening: "LANCHES NO PÃO DE ALHO",
    handwritten: "O resto é pão.",
    torch: "Queijo gratinado no maçarico.",
    sandwich: "Costela 6 horas. Paciência a gente tem.",
  },
} as const;
