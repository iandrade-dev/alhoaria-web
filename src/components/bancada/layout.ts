// Coordenadas proporcionais à casca HTML (400×580 retrato, 960×540 paisagem).
// Cena: retrato y=36–82%, paisagem x=0–67% e y=11–100%.
// Câmera mira a coluna do pão (y=0.10 / 0.17), com frustum horizontal 0.48 / 0.56 m.
// Pão aberto projetado em ~x=68–350, y=259–452 / x=139–529, y=256–522.
// Ajustar junto com a câmera e a posição do canvas se o enquadramento mudar.
export type Ponto = { x: number; y: number };
export type LayoutBancada = {
  largura: number; altura: number;
  pao: Ponto; raio: { x: number; y: number };
  pedido: Ponto; controles: Ponto; bandeja: Ponto; pouso: Ponto;
};

export const layouts: Record<"retrato" | "paisagem", LayoutBancada> = {
  retrato: {
    largura: 400, altura: 580,
    pao: { x: 200, y: 386 }, raio: { x: 135, y: 83 },
    pedido: { x: 200, y: 90 }, controles: { x: 200, y: 145 },
    bandeja: { x: 200, y: 529 }, pouso: { x: 200, y: 386 },
  },
  paisagem: {
    largura: 960, altura: 540,
    pao: { x: 322, y: 432 }, raio: { x: 190, y: 100 },
    pedido: { x: 322, y: 78 }, controles: { x: 322, y: 120 },
    bandeja: { x: 800, y: 270 }, pouso: { x: 322, y: 432 },
  },
};
