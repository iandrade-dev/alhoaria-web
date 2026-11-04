// Coordenadas proporcionais à casca HTML (400×580 retrato, 960×540 paisagem).
// Câmera ortográfica olhando (0, 0.13, 0): centro do pão (0, ~0.05, 0)
// projetado perto de (200, 308) / (321, 367); raio cobre o pão aberto.
// Ajustar junto com a câmera se o enquadramento mudar.
export type Ponto = { x: number; y: number };
export type LayoutBancada = {
  largura: number; altura: number;
  pao: Ponto; raio: { x: number; y: number };
  pedido: Ponto; controles: Ponto; bandeja: Ponto; pouso: Ponto;
};

export const layouts: Record<"retrato" | "paisagem", LayoutBancada> = {
  retrato: {
    largura: 400, altura: 580,
    pao: { x: 200, y: 310 }, raio: { x: 145, y: 85 },
    pedido: { x: 200, y: 180 }, controles: { x: 200, y: 244 },
    bandeja: { x: 200, y: 529 }, pouso: { x: 200, y: 310 },
  },
  paisagem: {
    largura: 960, altura: 540,
    pao: { x: 321, y: 367 }, raio: { x: 190, y: 95 },
    pedido: { x: 320, y: 158 }, controles: { x: 320, y: 230 },
    bandeja: { x: 790, y: 309 }, pouso: { x: 321, y: 367 },
  },
};
