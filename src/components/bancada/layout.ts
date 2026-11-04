// Todas as coordenadas da bancada estão em unidades do viewBox (não em pixels CSS).
export type Ponto = { x: number; y: number };
export type LayoutBancada = {
  largura: number; altura: number;
  cena: { x: number; y: number; largura: number; altura: number };
  tabua: Ponto; pao: Ponto; raio: { x: number; y: number };
  pedido: Ponto; controles: Ponto; bandeja: Ponto; pouso: Ponto;
};

export const layouts: Record<"retrato" | "paisagem", LayoutBancada> = {
  retrato: {
    largura: 400, altura: 580,
    cena: { x: 0, y: 62, largura: 400, altura: 440 },
    tabua: { x: 200, y: 388 }, pao: { x: 200, y: 382 }, raio: { x: 174, y: 72 },
    pedido: { x: 200, y: 235 }, controles: { x: 200, y: 284 },
    bandeja: { x: 200, y: 529 }, pouso: { x: 200, y: 382 },
  },
  paisagem: {
    largura: 960, altura: 540,
    cena: { x: 80, y: 38, largura: 510, altura: 486 },
    tabua: { x: 335, y: 426 }, pao: { x: 335, y: 408 }, raio: { x: 225, y: 82 },
    pedido: { x: 335, y: 228 }, controles: { x: 335, y: 285 },
    bandeja: { x: 790, y: 309 }, pouso: { x: 335, y: 408 },
  },
};
