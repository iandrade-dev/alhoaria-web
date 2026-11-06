// Adicionais do "Turbinar" feitos em código (leves: uma malha com cores de vértice por dose) e os potinhos
// separados com tampa. Cada dose é um montinho com centro na origem e base em y = 0.
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Group, IcosahedronGeometry,
  LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AdicionalId, SeparadoId } from "./cardapio";

const gerador = (seed: number) => {
  let s = ((seed * 48271 + 12345) % 2147483647) || 1;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  r(); r(); r();
  return r;
};
const pintar = (g: BufferGeometry, cor: Color) => {
  const n = g.attributes.position.count;
  const cols = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { cols[k * 3] = cor.r; cols[k * 3 + 1] = cor.g; cols[k * 3 + 2] = cor.b; }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  if (g.attributes.uv) g.deleteAttribute("uv");
  return g.index ? g.toNonIndexed() : g;
};
const juntar = (partes: BufferGeometry[]) => mergeGeometries(partes)!;
const tom = (c: string, rnd: () => number, v = 0.25) => new Color(c).multiplyScalar(1 - v / 2 + rnd() * v);

/** Altura (y) da superfície do lanche em (x, z); 0 se fora. */
export type Altura = (x: number, z: number) => number;

type Ctx = { rnd: () => number; m: Matrix4; q: Quaternion; e: Euler; p: Vector3; s: Vector3 };
const cache = new Map<number, Ctx>();
/** Um gerador por semente, compartilhado entre as peças de um mesmo punhado. */
const ctxQ = (seed: number) => { let c = cache.get(seed); if (!c) { c = ctx(seed); cache.set(seed, c); } return c; };
const ctx = (seed: number): Ctx => ({ rnd: gerador(seed), m: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() });
/** Ponto aleatório num disco achatado (elipse rx x rz). */
const noDisco = (c: Ctx, rx: number, rz: number) => { const a = c.rnd() * Math.PI * 2, r = Math.sqrt(c.rnd()); return [Math.cos(a) * r * rx, Math.sin(a) * r * rz] as const; };

/** Peças de uma dose, apoiadas na superfície (alt) em volta de (cx, cz). `monte` = empilha no centro (potinho). */
function pecas(id: Exclude<AdicionalId, "queijo-dobro">, seed: number, rx: number, rz: number, alt: Altura, cx: number, cz: number, escala = 1, monte = 0) {
  const c = ctx(seed);
  const partes: BufferGeometry[] = [];
  const base = (x: number, z: number) => alt(cx + x, cz + z) + monte * (1 - Math.min(1, Math.hypot(x / rx, z / rz))) ;
  const por = (g: BufferGeometry, x: number, z: number, dy: number, rot: [number, number, number], cor: Color) => {
    c.q.setFromEuler(c.e.set(...rot));
    c.m.compose(c.p.set(cx + x, base(x, z) + dy, cz + z), c.q, c.s.set(1, 1, 1));
    partes.push(pintar(g.applyMatrix4(c.m), cor));
  };
  const k = escala;
  if (id === "bacon") {
    const n = monte ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const [x, z] = noDisco(c, rx, rz);
      const t = (0.0115 + c.rnd() * 0.004) * k;
      const rot: [number, number, number] = [c.rnd() * 0.5, c.rnd() * 3, c.rnd() * 0.5];
      // carne + faixa de gordura num dos lados
      por(new BoxGeometry(t, t * 0.85, t * 0.68).translate(0, 0, -t * 0.16), x, z, t * 0.4, rot, tom(c.rnd() < 0.5 ? "#6a2214" : "#843019", c.rnd, 0.3));
      por(new BoxGeometry(t * 1.01, t * 0.86, t * 0.3).translate(0, 0, t * 0.34), x, z, t * 0.4, rot, tom("#e6c9a4", c.rnd, 0.12));
    }
  } else if (id === "tomate-seco") {
    const n = monte ? 14 : 7;
    for (let i = 0; i < n; i++) {
      const [x, z] = noDisco(c, rx, rz);
      const g = new IcosahedronGeometry(1, 0).scale(0.018 * k * (0.8 + c.rnd() * 0.4), 0.0034 * k, 0.0105 * k * (0.75 + c.rnd() * 0.5));
      por(g, x, z, 0.002, [(c.rnd() - 0.5) * 0.5, c.rnd() * 6, (c.rnd() - 0.5) * 0.5], tom(["#4e0a0c", "#66120e", "#7a1a12", "#5c1a10"][Math.floor(c.rnd() * 4)], c.rnd, 0.2));
    }
  } else if (id === "cebola-caramelizada") {
    const n = monte ? 34 : 16;
    for (let i = 0; i < n; i++) {
      const [x, z] = noDisco(c, rx, rz);
      const r = (0.009 + c.rnd() * 0.008) * k;
      const g = new TorusGeometry(r, 0.0021 * k, 5, 12, Math.PI * (0.5 + c.rnd() * 0.6)).rotateX(Math.PI / 2).scale(1, 0.7, 1);
      por(g, x, z, 0.0016, [(c.rnd() - 0.5) * 0.4, c.rnd() * 6, (c.rnd() - 0.5) * 0.4], tom(["#a9561a", "#c0702a", "#8c4212", "#d08a3a"][Math.floor(c.rnd() * 4)], c.rnd, 0.2));
    }
  } else if (id === "cebola-crispy") {
    const n = monte ? 26 : 13;
    for (let i = 0; i < n; i++) {
      const [x, z] = noDisco(c, rx, rz);
      const r = (0.0075 + c.rnd() * 0.005) * k;
      const g = new TorusGeometry(r, 0.0017 * k, 5, 16).rotateX(Math.PI / 2);
      por(g, x, z, 0.0022, [(c.rnd() - 0.5) * 1.1, c.rnd() * 6, (c.rnd() - 0.5) * 1.1], tom(["#d9a243", "#c8892c", "#e8bd62", "#b8741f"][Math.floor(c.rnd() * 4)], c.rnd, 0.15));
    }
  } else if (id === "farofa") {
    const n = monte ? 140 : 90;
    for (let i = 0; i < n; i++) {
      const [x, z] = noDisco(c, rx, rz);
      const r = (0.0028 + c.rnd() * 0.002) * k;
      por(new IcosahedronGeometry(r, 0), x, z, r * 0.6, [c.rnd() * 3, c.rnd() * 3, c.rnd() * 3], tom(["#b47a2a", "#9c6320", "#c98f3c", "#8a5418"][Math.floor(c.rnd() * 4)], c.rnd, 0.22));
    }
  }
  return juntar(partes);
}

/** Camada de gratinado extra (mais dourada), moldada sobre a superfície do lanche. */
function camadaQueijo(seed: number, rx: number, rz: number, alt: Altura, cx: number, cz: number, dy: number) {
  const c = ctx(seed);
  // disco em coroas (7 anéis x 40 setores), cada vértice apoiado na superfície
  const aneis = 7;
  const pts: number[] = [], cols: number[] = [];
  const cor = (x: number, z: number) => {
    const n = Math.sin(x * 310 + seed) * Math.cos(z * 270 - seed) + Math.sin((x + z) * 520);
    const b = Math.max(0, n - 0.6) * 0.9;
    return new Color("#f0b53a").lerp(new Color("#8a4a12"), Math.min(1, b + c.rnd() * 0.12));
  };
  const pt = (r: number, a: number) => {
    const x = Math.cos(a) * r * rx, z = Math.sin(a) * r * rz;
    // borda ondulada, como queijo que escorreu
    const borda = r >= 1 ? 1 + 0.08 * Math.sin(a * 7 + seed) : 1;
    const xx = x * borda, zz = z * borda;
    return [cx + xx, alt(cx + xx, cz + zz) + dy * (1 - 0.6 * r * r), cz + zz] as const;
  };
  const seg = 40;
  for (let i = 0; i < aneis; i++) {
    const r0 = i / aneis, r1 = (i + 1) / aneis;
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2;
      const A = pt(r0, a0), B = pt(r1, a0), C = pt(r1, a1), D = pt(r0, a1);
      const tri = (p: readonly (readonly number[])[]) => p.forEach((v) => { pts.push(v[0], v[1], v[2]); const k = cor(v[0], v[2]); cols.push(k.r, k.g, k.b); });
      tri([A, C, B]);
      if (i > 0) tri([A, D, C]);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(pts, 3));
  out.setAttribute("color", new Float32BufferAttribute(cols, 3));
  out.computeVertexNormals();
  return out;
}

const MAT_PECAS = () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
const MAT: Partial<Record<AdicionalId, () => MeshStandardMaterial>> = {
  "tomate-seco": () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.05 }),
  "cebola-caramelizada": () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.28 }),
  "queijo-dobro": () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
};

/**
 * Dose `i` (0..2) do adicional sobre o lanche. A malha fica em coordenadas do lanche; o grupo devolvido tem a
 * origem no centro da dose (para cair e assentar a partir dali).
 */
export function dose(id: AdicionalId, i: number, alt: Altura, larg: number, seed: number, off: [number, number] = [0, 0]) {
  const xs = [0, -0.62, 0.62].map((f) => f * larg);
  const cx = xs[i] + off[0], cz = off[1];
  let g: BufferGeometry;
  if (id === "queijo-dobro") {
    // 1a dose: camada inteira; as outras, manchas menores por cima
    g = i === 0 ? camadaQueijo(seed, larg * 1.08, 0.056, alt, 0, 0, 0.0035) : camadaQueijo(seed + i, larg * 0.55, 0.04, alt, (i === 1 ? -0.4 : 0.4) * larg, 0.004, 0.0035 + 0.0022 * i);
  } else {
    g = pecas(id, seed, larg * 0.36, 0.036, alt, cx, cz);
  }
  const mesh = new Mesh(g, (MAT[id] ?? MAT_PECAS)());
  mesh.castShadow = true; mesh.receiveShadow = true;
  // centro da dose
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const c = new Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
  g.translate(-c.x, -c.y, -c.z);
  const grupo = new Group(); grupo.position.copy(c); grupo.add(mesh);
  return grupo;
}

/** Punhado que a mão leva (pequeno, centrado na origem). */
export function punhadoNaMao(id: AdicionalId, seed: number) {
  const plano: Altura = () => 0;
  const g = id === "queijo-dobro"
    ? juntar(Array.from({ length: 40 }, (_, k, c = ctxQ(seed)) => { const [x, z] = noDisco(c, 0.016, 0.016); return pintar(new BoxGeometry(0.0028, 0.0028, 0.014).applyMatrix4(c.m.compose(c.p.set(x, c.rnd() * 0.01, z), c.q.setFromEuler(c.e.set(c.rnd() * 3, c.rnd() * 3, c.rnd() * 3)), c.s.set(1, 1, 1))), new Color("#f2d27a")); }))
    : pecas(id, seed, 0.016, 0.016, plano, 0, 0, 0.9, 0.012);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  const m = new Mesh(g, (MAT[id] ?? MAT_PECAS)());
  m.castShadow = true;
  return m;
}

/** Potinho de cerâmica escura com um monte do adicional (estação do Turbinar). */
export function potinho(id: AdicionalId, seed: number) {
  const g = new Group();
  const raio = 0.042, alto = 0.03;
  const pts = [[0, 0], [raio * 0.62, 0], [raio * 0.68, 0.004], [raio * 0.92, alto * 0.5], [raio, alto], [raio - 0.004, alto + 0.0015], [raio - 0.007, alto * 0.94],
    [raio * 0.86 - 0.005, alto * 0.46], [raio * 0.6 - 0.005, 0.007], [0, 0.007]].map(([x, y]) => new Vector2(x, y));
  const tig = new Mesh(new LatheGeometry(pts, 40), new MeshStandardMaterial({ color: "#2e231d", roughness: 0.35 }));
  tig.castShadow = true; tig.receiveShadow = true;
  g.add(tig);
  const fundo: Altura = () => alto * 0.62;
  let gm: BufferGeometry;
  if (id === "queijo-dobro") {
    // queijo ralado dourado
    const c = ctx(seed * 31);
    gm = juntar(Array.from({ length: 150 }, (_, k) => { const [x, z] = noDisco(c, raio * 0.8, raio * 0.8);
      const h = alto * 0.62 + 0.008 * (1 - Math.hypot(x, z) / raio) + c.rnd() * 0.004;
      return pintar(new BoxGeometry(0.0026, 0.0026, 0.013).applyMatrix4(c.m.compose(c.p.set(x, h, z), c.q.setFromEuler(c.e.set(c.rnd() * 0.6, c.rnd() * 6, c.rnd() * 0.6)), c.s.set(1, 1, 1))), tom(["#f3d27a", "#e9bb52", "#f6e0a0"][k % 3], c.rnd, 0.12));
    }));
  } else {
    gm = pecas(id, seed, raio * 0.78, raio * 0.78, fundo, 0, 0, 1, 0.009);
  }
  const monte = new Mesh(gm, (id === "queijo-dobro" ? MAT_PECAS : MAT[id] ?? MAT_PECAS)());
  monte.castShadow = true;
  g.add(monte);
  return { g, alto: alto + 0.012, raio };
}

/** Cor do creme de cada separado. */
const CREMES: Record<SeparadoId, string> = {
  "pasta-tradicional": "#efe5c8",
  "pasta-ervas": "#c9d39a",
  "creme-4-queijos": "#f1d88e",
  "creme-cheddar": "#e2862c",
};
/** Potinho descartável com tampa transparente (separado), apoiado em y = 0. */
export function potinhoSeparado(id: SeparadoId) {
  const g = new Group();
  const r = 0.021, h = 0.018;
  const copo = new Mesh(new LatheGeometry([[0, 0], [r * 0.78, 0], [r, h], [r + 0.0015, h], [r + 0.0015, h + 0.0012], [r - 0.001, h + 0.0012], [r * 0.78 - 0.001, 0.001], [0, 0.001]].map(([x, y]) => new Vector2(x, y)), 32),
    new MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.45 }));
  copo.castShadow = true; copo.receiveShadow = true;
  const creme = new Mesh(new CylinderGeometry(r - 0.0015, r - 0.0015, 0.002, 28), new MeshStandardMaterial({ color: CREMES[id], roughness: 0.55 }));
  creme.position.y = h - 0.002;
  const tampa = new Mesh(new SphereGeometry(r + 0.002, 28, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.22, 1),
    new MeshStandardMaterial({ color: "#ffffff", roughness: 0.08, transparent: true, opacity: 0.38, depthWrite: false }));
  tampa.position.y = h + 0.0012;
  const aba = new Mesh(new CylinderGeometry(r + 0.003, r + 0.003, 0.0016, 28, 1, true), new MeshStandardMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
  aba.position.y = h + 0.0012;
  g.add(copo, creme, tampa, aba);
  return g;
}
