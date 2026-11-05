// Coordenadas proporcionais à casca HTML (400×580 retrato, 960×540 paisagem).
// Retrato: cena y=36–82%, frustum 0.48 m, alvoY 0.10. Pão aberto projetado em x=68–350, y=259–452
// (aberto = base + tampa a -110°; fechado com queijo: y=312–452). Com o lanche pronto a câmera sobe
// 0.135 da altura do canvas (~36 un): pão y=223–416, e o card final fica ancorado embaixo.
// Paisagem: canvas x=0–100%, y=11–100% (480,6 un de altura), frustum 0.74 m (1297 un/m), alvoY 0.07,
// setViewOffset x=+0.1718·W (centro do lanche na coluna da esquerda, x=0–643), y=-0.0672·H (centro entre
// a base dos botões y≈139 e o fim da casca). Projeção: pão aberto x=109–549, y=168–469 (68 % da coluna);
// fechado com queijo x=109–521, y=251–469 (64 %); centros y=318 / 360 (alvo do vão: 339); tábua x=-2–781
// sangrando por baixo; maçarico x=-18–220, y=216–485. Pouso = centro do pão na tábua (0,0.04,0) ≈ (315, 365).
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
    pao: { x: 322, y: 339 }, raio: { x: 235, y: 160 },
    pedido: { x: 322, y: 78 }, controles: { x: 322, y: 120 },
    bandeja: { x: 800, y: 270 }, pouso: { x: 315, y: 365 },
  },
};
