// Peças comuns da cena 3D do protótipo: utilidades de malha, a mão de luva (README, seção LAR-449) e o contrato
// de um "kit" de lanche (tudo o que muda de um lanche para outro: o lanche na tábua, as estações e os efeitos).
import {
  AdditiveBlending, Box3, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Euler, Float32BufferAttribute,
  Group, IcosahedronGeometry, CylinderGeometry, LatheGeometry, Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  Plane, PlaneGeometry, Quaternion, SRGBColorSpace, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Acao, Medidas, Pose } from "./acoes";
import type { Arranjo } from "./layout";
import type { Opcoes } from "./cardapio";

// ---------------------------------------------------------------- mão de luva
export type InfoPose = { braco: [number, number, number]; ponto: [number, number, number]; base: [number, number, number] };
export const POSES: Record<Pose, InfoPose> = {
  mao_bisnaga: { braco: [0.95, 0.26, 0.17], ponto: [-0.0848, -0.0968, 0.0293], base: [0, 0.18, 0] },
  mao_colher: { braco: [0.81, 0.42, 0.41], ponto: [-0.1209, -0.0939, 0.0084], base: [0, 0.46, 0] },
  mao_macarico: { braco: [0.51, 0.45, 0.73], ponto: [-0.1041, -0.1427, -0.057], base: [0, 0.62, 0.05] },
  mao_punhado: { braco: [0.86, 0.48, 0.15], ponto: [-0.0637, -0.0659, 0.0021], base: [0, 0.17, 0] },
  mao_aberta: { braco: [0.86, 0.48, 0.15], ponto: [-0.0597, -0.0473, -0.0016], base: [0, 0.17, 0] },
};
export const OBJ = {
  bisnaga: { p: new Vector3(-0.0848, 0.0932, 0.0293), q: new Quaternion(0.0744, 0, 0.9972, 0) },
  colher: { p: new Vector3(-0.0454, -0.0308, -0.0511), q: new Quaternion(0.0797, 0.3176, 0.23, 0.9164) },
  macarico: { p: new Vector3(-0.0031, -0.0724, -0.057), q: new Quaternion() },
};
export const CHAMA_DIR = new Vector3(-0.8192, -0.5736, 0);
export const qBase = (p: Pose) => new Quaternion().setFromEuler(new Euler(...POSES[p].base, "YXZ"));
/** Põe a ferramenta parada de modo que a mão, com a raiz em `qG`, pegue com o ponto útil em `ponta`. */
export function porParaPegar(f: Object3D, obj: { p: Vector3; q: Quaternion }, qG: Quaternion, ponto: Vector3, ponta: Vector3) {
  const pG = ponta.clone().sub(ponto.clone().applyQuaternion(qG));
  f.quaternion.copy(qG).multiply(obj.q);
  f.position.copy(obj.p).applyQuaternion(qG).add(pG);
}
/** Ponto útil da pose `p` no mundo, para a raiz da mão em `raiz`. */
export const pontoNoMundo = (p: Pose, raiz: Object3D, out: Vector3) => out.set(...POSES[p].ponto).applyQuaternion(raiz.quaternion).add(raiz.position);

// ---------------------------------------------------------------- utilidades
export function clonar(o: Object3D) {
  const c = o.clone(true);
  c.traverse((n) => {
    if (!(n instanceof Mesh)) return;
    n.material = Array.isArray(n.material) ? n.material.map((m: Material) => m.clone()) : (n.material as Material).clone();
    n.castShadow = true; n.receiveShadow = true;
  });
  return c;
}
export const mats = (o: Object3D) => { const r: Material[] = []; o.traverse((n) => { if (n instanceof Mesh) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m: Material) => r.push(m)); }); return r; };
export function clipar(o: Object3D, planos: Plane[]) { mats(o).forEach((m) => { m.clippingPlanes = planos; m.clipShadows = true; }); }
export function caixa(o: Object3D) { o.updateMatrixWorld(true); return new Box3().setFromObject(o); }
/** Põe o objeto apoiado em y (pela caixa), centrado em x/z. */
export function apoiar(o: Object3D, x: number, y: number, z: number) {
  o.position.set(0, 0, 0);
  const b = caixa(o);
  o.position.set(x - (b.min.x + b.max.x) / 2, y - b.min.y, z - (b.min.z + b.max.z) / 2);
}
export const planoX = () => new Plane(new Vector3(-1, 0, 0), -1);
export function gradiente(paradas: [number, string][]) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  paradas.forEach(([p, cor]) => r.addColorStop(p, cor));
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}
const gerador = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const pintar = (g: BufferGeometry, cor: Color) => {
  const cols: number[] = [];
  for (let k = 0; k < g.attributes.position.count; k++) cols.push(cor.r, cor.g, cor.b);
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.deleteAttribute("uv");
  return g;
};
/** Punhado de fiapos (carne desfiada, queijo ralado ou batata palha) num único BufferGeometry com cores de vértice. */
export function fiapos(n: number, raio: number, cores: string[], comp: number, esp: number, seed: number) {
  const rnd = gerador(seed);
  const partes: BufferGeometry[] = [];
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), sc = new Vector3();
  for (let i = 0; i < n; i++) {
    const g = new BoxGeometry(1, 1, 1);
    const a = rnd() * Math.PI * 2, r = raio * Math.sqrt(rnd()), h = (rnd() - 0.35) * raio * 0.9;
    p.set(Math.cos(a) * r, h * (1 - (r / raio) * 0.6), Math.sin(a) * r);
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    sc.set(esp * (0.7 + rnd() * 0.8), esp * (0.6 + rnd() * 0.6), comp * (0.6 + rnd() * 0.8));
    m.compose(p, q, sc); g.applyMatrix4(m);
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
    e.set((rnd() - 0.5) * 2.2, rnd() * 6.28, (rnd() - 0.5) * 2.2); q.setFromEuler(e);
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
export function tigela(raio: number, alto: number, cor: string) {
  const pts = [[0, 0], [raio * 0.6, 0], [raio * 0.66, 0.004], [raio * 0.9, alto * 0.45], [raio, alto], [raio - 0.005, alto + 0.002], [raio - 0.009, alto * 0.95],
    [raio * 0.85 - 0.006, alto * 0.42], [raio * 0.6 - 0.006, 0.008], [0, 0.008]].map(([x, y]) => new Vector2(x, y));
  const m = new Mesh(new LatheGeometry(pts, 48), new MeshStandardMaterial({ color: cor, roughness: 0.32, metalness: 0, side: DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/** Separa os triângulos de uma malha (indexada ou não) num novo BufferGeometry, pelo critério `fica(src, i)`
 * (`src` sem índice; `i` = primeiro vértice do triângulo). */
export function separar(g: BufferGeometry, fica: (src: BufferGeometry, i: number) => boolean) {
  const src = g.index ? g.toNonIndexed() : g;
  const n = src.attributes.position.count / 3;
  const sel: number[] = [];
  for (let t = 0; t < n; t++) if (fica(src, t * 3)) sel.push(t);
  const out = new BufferGeometry();
  for (const nome of Object.keys(src.attributes)) {
    const a = src.attributes[nome] as BufferAttribute;
    const arr = new (a.array.constructor as Float32ArrayConstructor)(sel.length * 3 * a.itemSize);
    sel.forEach((t, i) => { for (let k = 0; k < 3 * a.itemSize; k++) arr[i * 3 * a.itemSize + k] = a.array[t * 3 * a.itemSize + k]; });
    out.setAttribute(nome, new BufferAttribute(arr, a.itemSize, a.normalized));
  }
  return out;
}

// ---------------------------------------------------------------- tinta e pontinhos (opções do pedido)
/** Controle de uma tinta: cor puxada (força 0..1) e pontinhos de outra cor (densidade 0..1, por célula de 1/freq m). */
export type Tinta = { cor: Color; forca: { value: number }; ponto: Color; pontos: { value: number }; freq: { value: number }; raio: { value: number } };
/**
 * Tinge um material em código (sem textura nova): puxa a cor para `cor` mantendo o sombreado da cor de vértice e
 * salpica pontinhos (ervas, parmesão) num padrão 3D no espaço do objeto, então funciona com ou sem UV. Os valores
 * mudam pelos uniforms devolvidos, sem recompilar. Respeita o escurecimento das estações (cor do material).
 */
export function tintavel(m: Material, freq = 110, raio = 0.3): Tinta {
  const t: Tinta = { cor: new Color(1, 1, 1), forca: { value: 0 }, ponto: new Color(1, 1, 1), pontos: { value: 0 }, freq: { value: freq }, raio: { value: raio } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTinta = { value: t.cor }; sh.uniforms.uForca = t.forca;
    sh.uniforms.uPonto = { value: t.ponto }; sh.uniforms.uPontos = t.pontos; sh.uniforms.uFreq = t.freq; sh.uniforms.uRaio = t.raio;
    sh.vertexShader = "varying vec3 vPosT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vPosT = position;");
    sh.fragmentShader = "varying vec3 vPosT;\nuniform vec3 uTinta;\nuniform float uForca;\nuniform vec3 uPonto;\nuniform float uPontos;\nuniform float uFreq;\nuniform float uRaio;\n"
      + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  {
    float dimT = max(diffuse.r, max(diffuse.g, diffuse.b));
    float lumT = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) / max(dimT, 1e-3);
    diffuseColor.rgb = mix(diffuseColor.rgb, uTinta * dimT * (0.4 + 0.75 * lumT), uForca);
    if (uPontos > 0.0) {
      vec3 pT = vPosT * uFreq;
      vec3 cT = floor(pT);
      float hT = fract(sin(dot(cT, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      vec3 oT = vec3(fract(hT * 7.13), fract(hT * 3.71), fract(hT * 5.17)) * 0.5 + 0.25;
      float dT = length(fract(pT) - oT);
      float onT = step(1.0 - uPontos, hT) * (1.0 - smoothstep(uRaio * 0.75, uRaio, dT));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPonto * dimT, onT);
    }
  }`);
  };
  m.customProgramCacheKey = () => "tinta-v1";
  m.needsUpdate = true;
  return t;
}
/** Aplica uma tinta: cor e força; pontinhos opcionais. */
export function pintarTinta(t: Tinta, cor: string | null, forca = 0, ponto: string | null = null, pontos = 0) {
  if (cor) t.cor.set(cor);
  t.forca.value = cor ? forca : 0;
  if (ponto) t.ponto.set(ponto);
  t.pontos.value = ponto ? pontos : 0;
}

// ---------------------------------------------------------------- estações
export type Estacao = {
  id: string; raiz: Group; ferramenta: Object3D | null; casa: { p: Vector3; q: Quaternion }; apoio: Vector3; raio: number; alto: number;
  mats: { m: MeshStandardMaterial; cor: Color }[]; anel: Mesh; brilho: number; luz: number;
  /** Anel alongado no eixo da estação (travessa comprida). */
  alonga: number;
};
export const anelTextura = () => gradiente([[0, "rgba(255,190,110,0)"], [0.5, "rgba(255,190,110,0)"], [0.72, "rgba(255,170,80,0.85)"], [0.86, "rgba(255,140,50,0.35)"], [1, "rgba(255,120,40,0)"]]);
export function fazerEstacao(id: string, raiz: Group, ferramenta: Object3D | null, raio: number, alto: number, anelTex: CanvasTexture, extras: Object3D[] = []): Estacao {
  const anel = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: anelTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
  anel.rotation.x = -Math.PI / 2; anel.scale.setScalar(raio * 3.1); anel.renderOrder = 2;
  const ms: { m: MeshStandardMaterial; cor: Color }[] = [];
  [raiz, ferramenta, ...extras].forEach((o) => o && mats(o).forEach((m) => { if (m instanceof MeshStandardMaterial) ms.push({ m, cor: m.color.clone() }); }));
  return { id, raiz, ferramenta, casa: { p: new Vector3(), q: new Quaternion() }, apoio: new Vector3(), raio, alto, mats: ms, anel, brilho: 0, luz: 0, alonga: 1 };
}
/** Depois de posicionar as ferramentas: guarda a casa (pose no mundo) e o apoio (para assentar na tábua). */
export function guardarCasas(lista: Record<string, Estacao>) {
  Object.values(lista).forEach((st) => {
    const f = st.ferramenta;
    if (!f) return;
    st.casa.p.copy(f.position); st.casa.q.copy(f.quaternion);
    const b = caixa(f);
    st.apoio.set(f.position.x - (b.min.x + b.max.x) / 2, f.position.y - b.min.y, f.position.z - (b.min.z + b.max.z) / 2);
  });
}
/** Ferramentas passam a viver soltas no grupo do mundo (a casa é a pose no mundo). */
export function soltarNoMundo(lista: Record<string, Estacao>, w: Group | null) {
  Object.values(lista).forEach((st) => {
    if (!st.ferramenta) return;
    st.raiz.updateMatrixWorld(true);
    if (st.ferramenta.parent !== w) w?.attach(st.ferramenta);
  });
}
/** Volta as ferramentas para as raízes, para o próximo arranjo recalcular a casa. */
export function devolverAsRaizes(lista: Record<string, Estacao>, w: Group | null) {
  Object.values(lista).forEach((st) => {
    if (!st.ferramenta || st.ferramenta.parent !== w) return;
    st.ferramenta.position.copy(st.casa.p); st.ferramenta.quaternion.copy(st.casa.q); st.ferramenta.scale.setScalar(1);
    st.raiz.updateMatrixWorld(true); st.raiz.attach(st.ferramenta);
  });
}

// ---------------------------------------------------------------- contrato do kit de um lanche
export type Contexto = {
  /** Raiz da mão (já na pose do quadro). */
  mao: Object3D;
  /** Velocidade suavizada da mão (para o fio da bisnaga seguir o movimento). */
  lean: Vector3;
  /** A mão já fechou na ferramenta (passou do instante `fecha` da pegada). */
  pegou: boolean;
  /** Progresso (0..1) do "leva" da pegada: da ferramenta até o começo do trabalho. */
  leva: number;
};
/** Peça que reaparece no lugar com mola (como a ferramenta que volta para a estação). */
export type Volta = { obj: Object3D; p: Vector3; q: Quaternion };
export type Kit = {
  /** Tábua e o que fica parado com ela. */
  raiz: Object3D;
  /** O lanche (achata quando a tampa aperta). */
  lanche: Object3D;
  /** Objetos de efeito, soltos na cena. */
  extras: Object3D[];
  estacoes: Record<string, Estacao>;
  /** Ferramentas na mão, no espaço da raiz da mão (null = sem ferramenta). */
  fer: Record<string, Object3D | null>;
  acoes: Record<string, Acao>;
  /** Caixa do lanche (para a zona de soltura no HUD). */
  caixa: { x: [number, number]; y: [number, number]; z: [number, number] };
  /** Onde a ferramenta assenta quando é solta no ar sobre o lanche. */
  naTabua: Vector3;
  /** Escala (x, z) do anel em volta do lanche na vez da tampa. */
  anel: [number, number];
  /** Posiciona as estações para o arranjo; devolve a limpeza. */
  layout: (arranjo: Arranjo, w: Group | null) => () => void;
  zerar: () => void;
  /** Ferramentas e peças de volta ao começo (Montar de novo). */
  reiniciar: () => void;
  inicio: (id: string) => void;
  efeitos: (id: string, t: number, amp: number, red: boolean, c: Contexto) => void;
  /** Fim da ação: apaga os efeitos e deixa a camada no estado final. Pode devolver peças que voltam com mola. */
  final: (id: string) => void | Volta[];
  /** Por quadro, fora das ações (ex.: o creme sobe com o recheio). */
  quadro?: (dt: number) => void;
  /** A ferramenta da estação volta com mola no fim da ação? (padrão: sim) */
  volta?: (id: string) => boolean;
  /** Escolhas do pedido que mudam o lanche na tábua (ex.: o pão parmesão ou roseta). */
  vestir?: (o: Opcoes | null) => void;
  /** Medidas atualizadas no layout (ex.: pontos de pegada no meio da ação). */
  M: Medidas;
};
