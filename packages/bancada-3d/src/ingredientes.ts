import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Group, IcosahedronGeometry,
  LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector2, Vector3, type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function gerador(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function pintar(g: BufferGeometry, cor: Color) {
  const cols: number[] = [];
  for (let k = 0; k < g.attributes.position.count; k++) cols.push(cor.r, cor.g, cor.b);
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.deleteAttribute("uv");
  return g;
}

/** Punhado de fiapos (carne desfiada, queijo ralado ou batata palha) num único BufferGeometry com cores de vértice. */
export function fiapos(n: number, raio: number, cores: string[], comp: number, esp: number, seed: number) {
  const rnd = gerador(seed);
  const partes: BufferGeometry[] = [];
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), sc = new Vector3();
  for (let i = 0; i < n; i++) {
    const g = new BoxGeometry(1, 1, 1);
    const a = rnd() * Math.PI * 2, r = raio * Math.sqrt(rnd()), h = (rnd() - 0.35) * raio * 0.9;
    p.set(Math.cos(a) * r, h * (1 - (r / raio) * 0.6), Math.sin(a) * r);
    e.set(rnd() * 3, rnd() * 3, rnd() * 3);
    q.setFromEuler(e);
    sc.set(esp * (0.7 + rnd() * 0.8), esp * (0.6 + rnd() * 0.6), comp * (0.6 + rnd() * 0.8));
    g.applyMatrix4(m.compose(p, q, sc));
    partes.push(pintar(g, new Color(cores[Math.floor(rnd() * cores.length)]).multiplyScalar(0.85 + rnd() * 0.3)));
  }
  return mergeGeometries(partes)!;
}

/** Punhado de floretes de brócolis: talo claro e cabecinha verde de bolinhas. */
export function floretes(n: number, raio: number, seed: number, tam = 1) {
  const rnd = gerador(seed);
  const partes: BufferGeometry[] = [];
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), sc = new Vector3(1, 1, 1), lp = new Vector3();
  const cabecas = ["#2c6420", "#357428", "#3f8030", "#4a8c36", "#58993e"];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = raio * Math.sqrt(rnd()), h = (rnd() - 0.4) * raio * 0.8;
    p.set(Math.cos(a) * r, h * (1 - (r / raio) * 0.5), Math.sin(a) * r);
    e.set((rnd() - 0.5) * 2.2, rnd() * 6.28, (rnd() - 0.5) * 2.2);
    q.setFromEuler(e);
    const s = tam * (0.8 + rnd() * 0.45);
    m.compose(p, q, sc.setScalar(s));
    const talo = new CylinderGeometry(0.0022, 0.003, 0.009, 6).translate(0, -0.0035, 0);
    partes.push(pintar(talo.applyMatrix4(m), new Color(rnd() < 0.5 ? "#b9d68a" : "#cfe3a2")));
    const verde = cabecas[Math.floor(rnd() * cabecas.length)];
    for (let k = 0; k < 5; k++) {
      const ang = (k / 4) * Math.PI * 2 + rnd();
      lp.set(k === 0 ? 0 : Math.cos(ang) * 0.0042, k === 0 ? 0.0042 : 0.0022 + rnd() * 0.0012, k === 0 ? 0 : Math.sin(ang) * 0.0042);
      const bola = new IcosahedronGeometry((k === 0 ? 0.0044 : 0.0036) * (0.85 + rnd() * 0.3), 1).translate(lp.x, lp.y, lp.z);
      partes.push(pintar(bola.applyMatrix4(m), new Color(verde).multiplyScalar(0.85 + rnd() * 0.3)));
    }
  }
  return mergeGeometries(partes.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/** Tigela de cerâmica com geometria oca, apoiada em y = 0. */
export function tigela(raio: number, alto: number, cor: string) {
  const pts = [
    [0, 0], [raio * 0.6, 0], [raio * 0.66, 0.004], [raio * 0.9, alto * 0.45], [raio, alto],
    [raio - 0.005, alto + 0.002], [raio - 0.009, alto * 0.95], [raio * 0.85 - 0.006, alto * 0.42],
    [raio * 0.6 - 0.006, 0.008], [0, 0.008],
  ].map(([x, y]) => new Vector2(x, y));
  const m = new Mesh(
    new LatheGeometry(pts, 48),
    new MeshStandardMaterial({ color: cor, roughness: 0.32, metalness: 0, side: DoubleSide }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Potinho descartável com tampa transparente, apoiado em y = 0. */
export function criarPoteComTampa(
  cor: string,
  { opacidadeTampa = 0.38, sombrasDoCopo = true }: { opacidadeTampa?: number; sombrasDoCopo?: boolean } = {},
) {
  const r = 0.021, h = 0.018;
  const perfil = [
    [0, 0], [r * 0.78, 0], [r, h], [r + 0.0015, h],
    [r + 0.0015, h + 0.0012], [r - 0.001, h + 0.0012], [r * 0.78 - 0.001, 0.001], [0, 0.001],
  ].map(([x, y]) => new Vector2(x, y));
  const copo = new Mesh(new LatheGeometry(perfil, 32), new MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.45 }));
  copo.castShadow = sombrasDoCopo;
  copo.receiveShadow = sombrasDoCopo;
  const creme = new Mesh(new CylinderGeometry(r - 0.0015, r - 0.0015, 0.002, 28), new MeshStandardMaterial({ color: cor, roughness: 0.55 }));
  creme.position.y = h - 0.002;
  const tampa = new Mesh(
    new SphereGeometry(r + 0.002, 28, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.22, 1),
    new MeshStandardMaterial({ color: "#ffffff", roughness: 0.08, transparent: true, opacity: opacidadeTampa, depthWrite: false }),
  );
  tampa.position.y = h + 0.0012;
  const aba = new Mesh(
    new CylinderGeometry(r + 0.003, r + 0.003, 0.0016, 28, 1, true),
    new MeshStandardMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  aba.position.y = h + 0.0012;
  return new Group().add(copo, creme, tampa, aba);
}
