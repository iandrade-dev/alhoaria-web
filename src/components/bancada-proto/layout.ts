// Geometria compartilhada do protótipo: câmeras (as mesmas do fundo renderizado no Blender, ver
// blender/bancada3d/build_cozinha_fundo.py) e posição das estações em volta da tábua.
// Coordenadas three.js: x para a direita, y para cima, z para a câmera; origem no centro do topo da tábua.

export const MESA = -0.028;

export type Arranjo = "retrato" | "paisagem";

export type Camera = { pos: [number, number, number]; alvo: [number, number, number]; fov: number; aspecto: number };

// fov vertical em graus; aspecto = largura/altura da imagem de fundo renderizada com esta câmera.
export const CAMERAS: Record<Arranjo, Camera> = {
  retrato: { pos: [0, 0.94, 0.98], alvo: [0, 0.0, -0.01], fov: 47, aspecto: 9 / 16 },
  paisagem: { pos: [0, 0.6, 0.76], alvo: [0, 0.02, 0.0], fov: 40, aspecto: 16 / 9 },
};

export const PASSOS = ["pasta", "creme", "costela", "tampa", "mussarela", "macarico"] as const;
export type Passo = (typeof PASSOS)[number];

// Onde cada estação fica na bancada (x, z). A tampa não tem estação: o gesto é sobre o pão.
export type EstacaoId = Exclude<Passo, "tampa">;
export const ESTACOES: Record<Arranjo, Record<EstacaoId, [number, number]>> = {
  retrato: {
    pasta: [-0.15, -0.25],
    creme: [0.14, -0.26],
    costela: [-0.165, 0.27],
    mussarela: [0.025, 0.3],
    macarico: [0.205, 0.25],
  },
  paisagem: {
    pasta: [-0.36, -0.11],
    costela: [-0.38, 0.15],
    creme: [0.42, -0.15],
    mussarela: [0.42, 0.17],
    macarico: [0.21, -0.27],
  },
};

export const arranjoDe = (w: number, h: number): Arranjo => (w / Math.max(1, h) < 1 ? "retrato" : "paisagem");

/** fov vertical que reproduz o recorte "cover" da imagem de fundo na tela atual. */
export function fovPara(cam: Camera, w: number, h: number) {
  const a = w / Math.max(1, h);
  if (a <= cam.aspecto) return cam.fov;
  const t = Math.tan((cam.fov * Math.PI) / 360) * (cam.aspecto / a);
  return (Math.atan(t) * 360) / Math.PI;
}
