"use client";

// O pedido na mesa. Durante a montagem: Turbinar (antes da tampa: potinhos em volta da tábua e a mão soltando punhados
// sobre o recheio, que ficam dentro do lanche), os separados na frente do lanche e o queijo em dobro (punhado da
// tigela do queijo). Depois do lanche pronto: Bebida e Acompanhamento (prateleira atrás da tábua; a mão põe o
// escolhido ao lado do lanche) e Sacola (aberta no tampo, à direita da tábua: a pessoa arrasta o lanche até ela ou
// toca nela; a mão põe o lanche na boca, a bebida e a porção pulam para dentro uma a uma e a sacola dobra e fecha).
// Tudo é declarativo: a cena compara o pedido com o que está na mesa e anima uma diferença por vez.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BoxGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, Raycaster, SRGBColorSpace, Vector3,
} from "three";
import { POSES, caixa, clonar, qBase, type Kit } from "./kit";
import { c01, eIn2, eIO3, eIOs, eOut3, mola, seg, type Medidas, type Pose } from "./acoes";
import { MESA, type Arranjo } from "./layout";
import {
  ORDEM_ADICIONAIS, ORDEM_BEBIDAS, ORDEM_PORCOES, ORDEM_SEPARADOS, POTINHOS, SABORES_LATA, SABORES_SODA, type AdicionalId, type Pedido,
} from "./cardapio";
import { dose, potinho, potinhoSeparado, punhadoNaMao, type Altura } from "./adicionais3d";
import type { ApiCamara } from "./Camara";

/** "turbinar" = a etapa Turbinar da montagem (antes da tampa); as outras três vêm depois do lanche pronto. */
export type FasePedido = "montagem" | "turbinar" | "bebida" | "acomp" | "sacola";
/** Sacola: esperando o lanche ("aberta"), recebendo os itens, "fechou" (dobra e etiqueta) e "pronta" (comanda). */
export type EstadoSacola = "nada" | "aberta" | "rodando" | "fechou" | "pronta";
/** Centro e raio na tela; `t` = y do topo do objeto (para a etiqueta ir por cima). */
export type ProjPedido = Record<string, { x: number; y: number; r: number; t: number }>;
type Maos = { raiz: Group; poses: Record<Pose, Object3D>; fer: Record<string, Object3D | null> };
type Props = {
  K: Kit; H: Maos; M: Medidas; arranjo: Arranjo; fase: FasePedido; pedido: Pedido | null; reduzido: boolean;
  /** Muda a cada "Montar de novo": a mesa volta a ficar vazia. */
  rodada: number;
  aoProjetar: (p: ProjPedido) => void; aoSacola: () => void;
  /** A mão do pedido está trabalhando (a montagem espera). */
  aoOcupado: (ocupado: boolean) => void;
  /** A pessoa pôs o lanche na sacola: começa a ensacar. */
  ensacar: boolean;
  aoSacolaEstado: (e: EstadoSacola) => void;
  camApi: MutableRefObject<ApiCamara | null>;
  pausado?: boolean;
};

const ARQ = ["beb-lata", "beb-chopp", "beb-soda", "porcao-batata", "porcao-dadinho", "sacola"] as const;
const glb = (n: string) => `/assets/models/bancada/${n}.glb`;
export const preCarregarPedido = () => ARQ.forEach((n) => useGLTF.preload(glb(n)));

type XZ = [number, number];
/** Lugares (x, z) de cada coisa da mesa, por arranjo. */
// Sacola: aberta no tampo à direita da tábua (zonas livres da cozinha), girada para a câmera, maior que o GLB.
const LUG: Record<Arranjo, { potes: XZ[]; prat: XZ[]; b1: XZ; b2: XZ; p1: XZ; p2: XZ; sacola: XZ; copos: XZ }> = {
  retrato: {
    potes: [[-0.175, -0.245], [0, -0.285], [0.175, -0.245], [-0.18, 0.2], [0, 0.215], [0.18, 0.2]],
    prat: [[-0.165, -0.27], [0, -0.285], [0.165, -0.27]],
    b1: [0.17, 0.2], b2: [0.225, 0.07], p1: [-0.15, 0.215], p2: [-0.225, 0.07],
    sacola: [0.3, -0.21], copos: [-0.135, 0.105],
  },
  paisagem: {
    potes: [[-0.31, -0.21], [-0.39, -0.03], [-0.35, 0.15], [0.31, -0.21], [0.39, -0.03], [0.35, 0.15]],
    prat: [[-0.2, -0.27], [0, -0.285], [0.2, -0.27]],
    b1: [0.33, -0.1], b2: [0.44, -0.04], p1: [-0.33, -0.06], p2: [-0.42, -0.21],
    sacola: [0.28, -0.25], copos: [-0.135, 0.105],
  },
};

type Chave = "lata" | "chopp" | "soda" | "batata" | "dadinho";
type Item = { chave: Chave; obj: Group; alto: number; cor: string };
type Desejo = { chave: Chave; cor: string } | null;
type SlotId = "b1" | "b2" | "p1" | "p2";

/** Animação da mão: pega em `pega` (ou vem de fora já com o objeto) e solta em `solta`. Pontos = ponto útil da mão. */
type Anim = {
  tipo: string; t: number; D: number;
  tl: { chega: number; assenta: number; fecha: number; leva: number; desce: number; solta: number };
  pega: Vector3 | null; sobreSolta: Vector3; solta: Vector3; fora: Vector3; foraSai: Vector3;
  /** Objetos levados e o deslocamento de cada um em relação ao ponto da mão. */
  leva: { obj: Object3D; off: Vector3; s0: number; s1: number }[];
  /** Punhado na mão (adicional). */
  punhado?: Object3D;
  aoPegar?: () => void; aoSoltar?: () => void; aoFim?: () => void;
  pegou?: boolean; soltou?: boolean;
};

/** Escala da sacola na mesa (o GLB tem 0,262 m de altura). A frente (+z) gira para a câmera padrão. */
const SACOLA = { escala: 1.3, alto: 0.262 };

const TL = { chega: 0.42, assenta: 0.54, fecha: 0.6, leva: 1.12, desce: 1.3, solta: 1.36, D: 1.7 };
const TL_FORA = { chega: 0, assenta: 0, fecha: 0, leva: 0.78, desce: 0.95, solta: 1.0, D: 1.34 };

const cubica = (out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, k: number) => {
  const u = 1 - k;
  return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * k).addScaledVector(c, 3 * u * k * k).addScaledVector(d, k * k * k);
};

/** Frente da sacola com o logo real: brilho do logo como máscara, impresso em marrom-escuro sobre o kraft. */
function estampar(sacola: Object3D) {
  const frentes: MeshStandardMaterial[] = [];
  sacola.traverse((n) => { if (n instanceof Mesh && n.name.endsWith("_frente")) frentes.push(n.material as MeshStandardMaterial); });
  if (!frentes.length) return;
  const W = 528, Hh = 768;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
  const g = cv.getContext("2d")!;
  // cor do kraft: média de um canto da textura original (sem estampa)
  let kraft = "#c89a62";
  const orig = frentes[0].map?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (orig && orig.width) {
    const t = document.createElement("canvas"); t.width = orig.width; t.height = orig.height;
    const tg = t.getContext("2d")!; tg.drawImage(orig, 0, 0);
    const d = tg.getImageData(4, 4, Math.max(1, Math.floor(orig.width * 0.12)), Math.max(1, Math.floor(orig.height * 0.06))).data;
    let r = 0, gg = 0, b = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    kraft = `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
  }
  g.fillStyle = kraft; g.fillRect(0, 0, W, Hh);
  // fibras do papel
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = rnd() < 0.5 ? "rgba(255,240,215,0.07)" : "rgba(90,55,25,0.06)";
    g.lineWidth = 0.6 + rnd();
    const x = rnd() * W, y = rnd() * Hh, a = rnd() * Math.PI, l = 4 + rnd() * 12;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const aplicar = () => {
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;
    frentes.forEach((m) => { m.map = tex; m.needsUpdate = true; });
  };
  aplicar();
  const img = new Image();
  img.onload = () => {
    // recorta o desenho (o fundo preto do logo não conta) e põe com ~70 % da largura, centrado na frente,
    // abaixo das dobras da sacola fechada
    const o = document.createElement("canvas"); o.width = img.width; o.height = img.height;
    const og = o.getContext("2d")!; og.drawImage(img, 0, 0);
    const od = og.getImageData(0, 0, img.width, img.height).data;
    let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (od[i] + od[i + 1] + od[i + 2] > 180) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = img.width - 1; y1 = img.height - 1; }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const lw = Math.round(W * 0.7), lh = Math.round(lw * (ch / cw));
    const lx = Math.round((W - lw) / 2), ly = Math.round(Hh * 0.6 - lh / 2);
    const t = document.createElement("canvas"); t.width = lw; t.height = lh;
    const tg = t.getContext("2d")!; tg.imageSmoothingQuality = "high"; tg.drawImage(o, x0, y0, cw, ch, 0, 0, lw, lh);
    const d = tg.getImageData(0, 0, lw, lh);
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / 255;
      const a = c01((lum - 0.12) / 0.6) * (0.82 + 0.18 * rnd());
      d.data[i] = 46; d.data[i + 1] = 27; d.data[i + 2] = 14; d.data[i + 3] = Math.round(a * 235);
    }
    tg.putImageData(d, 0, 0);
    g.drawImage(t, lx, ly);
    aplicar();
  };
  img.src = "/assets/photos/logo-anota-w320.webp";
}

function tingir(item: Item, cor: string) {
  if (item.cor === cor) return;
  item.cor = cor;
  item.obj.traverse((n) => {
    if (!(n instanceof Mesh)) return;
    const m = n.material as MeshStandardMaterial;
    if (n.name.includes("lata_corpo")) { m.map = null; m.color.set(cor); m.metalness = 0.5; m.roughness = 0.32; m.needsUpdate = true; }
    if (n.name.includes("soda_liquido")) { m.vertexColors = false; m.map = null; m.color.set(cor); m.opacity = 0.82; m.needsUpdate = true; }
  });
}

/** Lugar de cada potinho (índices em LUG.potes; o do meio da frente fica livre para os separados). */
const LUGAR_POTE = [0, 1, 2, 3, 5];

export default function Pedido3D({ K, H, M, arranjo, fase, pedido, reduzido, rodada, aoProjetar, aoSacola, aoOcupado, ensacar, aoSacolaEstado, camApi, pausado }: Props) {
  const cenas = useGLTF(ARQ.map(glb));
  const { camera, size, gl } = useThree();
  const A = useMemo(() => Object.fromEntries(ARQ.map((n, i) => [n, cenas[i].scene])) as unknown as Record<(typeof ARQ)[number], Object3D>, [cenas]);
  const opts = useRef({ fase, pedido, reduzido, arranjo, ensacar }); opts.current = { fase, pedido, reduzido, arranjo, ensacar };
  const estadoSacola = useRef(aoSacolaEstado); estadoSacola.current = aoSacolaEstado;
  const fimSacola = useRef(aoSacola); fimSacola.current = aoSacola;
  const projetar = useRef(aoProjetar); projetar.current = aoProjetar;
  const ocupar = useRef(aoOcupado); ocupar.current = aoOcupado;

  // ------------------------------------------------ objetos
  const P = useMemo(() => {
    const raiz = new Group();
    const tabua = K.raiz.children[0];
    const bt = caixa(tabua);
    const naTabua = (x: number, z: number) => x > bt.min.x + 0.02 && x < bt.max.x - 0.02 && z > bt.min.z + 0.02 && z < bt.max.z - 0.02;
    const yEm = (x: number, z: number) => (naTabua(x, z) ? bt.max.y : MESA);

    // potinhos dos adicionais
    const potes = POTINHOS.map((id) => { const p = potinho(id, 11 + ORDEM_ADICIONAIS.indexOf(id) * 7); p.g.visible = false; raiz.add(p.g); return { id, ...p }; });
    // prateleiras: bandeja escura atrás da tábua
    const bandeja = (larg: number) => {
      const m = new Mesh(new BoxGeometry(larg, 0.012, 0.13), new MeshStandardMaterial({ color: "#3a2618", roughness: 0.6 }));
      m.castShadow = true; m.receiveShadow = true; m.visible = false; raiz.add(m); return m;
    };
    const novoItem = (chave: Chave): Item => {
      const arq = chave === "batata" || chave === "dadinho" ? `porcao-${chave}` : `beb-${chave}`;
      const obj = new Group(); obj.add(clonar(A[arq as keyof typeof A]));
      obj.traverse((n) => { if (n instanceof Mesh && (n.material as MeshStandardMaterial).transparent) n.castShadow = false; });
      const it: Item = { chave, obj, alto: caixa(obj).max.y, cor: "" };
      return it;
    };
    const pratBeb = { bandeja: bandeja(0.5), itens: ORDEM_BEBIDAS.map((c) => novoItem(c)) };
    const pratPor = { bandeja: bandeja(0.44), itens: ORDEM_PORCOES.map((c) => novoItem(c)) };
    [...pratBeb.itens, ...pratPor.itens].forEach((it) => { it.obj.visible = false; raiz.add(it.obj); });
    tingir(pratBeb.itens[0], SABORES_LATA.coca.cor);
    tingir(pratBeb.itens[2], SABORES_SODA["frutas-vermelhas"].cor);

    // sacola
    const sacola = clonar(A.sacola);
    const aberta = sacola.getObjectByName("sacola_aberta")!, fechada = sacola.getObjectByName("sacola_fechada")!;
    aberta.visible = true; fechada.visible = false; sacola.visible = false;
    estampar(sacola);
    raiz.add(sacola);
    // aba da dobra: a boca dobra para a frente (articulada na borda de trás) antes de virar a sacola fechada
    let kraft: MeshStandardMaterial | null = null;
    aberta.traverse((n) => { if (!kraft && n instanceof Mesh && n.name.endsWith("_corpo")) kraft = (n.material as MeshStandardMaterial).clone(); });
    // a cor do kraft vem das cores de vértice do GLB: a aba (caixa sem COLOR_0) leva a cor no material
    const kraftMat = kraft ?? new MeshStandardMaterial({ roughness: 0.85 });
    kraftMat.vertexColors = false; kraftMat.color.set("#b98a55"); kraftMat.side = DoubleSide;
    const aba = new Group();
    aba.position.set(0, SACOLA.alto, -0.052);
    const abaM = new Mesh(new BoxGeometry(0.178, 0.1, 0.003), kraftMat);
    abaM.position.set(0, 0.05, 0);
    aba.add(abaM); aba.visible = false; sacola.add(aba);
    const etiquetas: Object3D[] = [];
    fechada.traverse((n) => { if (n.name.includes("etiqueta")) etiquetas.push(n); });
    etiquetas.forEach((e) => { e.userData.y0 = e.position.y; });

    // cobertura (doses) mora no lanche, para ir junto para a sacola
    const cobertura = new Group();
    K.lanche.add(cobertura);
    const copos = new Group(); raiz.add(copos);
    return { raiz, tabua, bt, yEm, potes, pratBeb, pratPor, novoItem, sacola, aberta, fechada, aba, etiquetas, cobertura, copos };
  }, [K, A]);

  useEffect(() => () => { P.cobertura.removeFromParent(); }, [P]);

  // ------------------------------------------------ estado da mesa (refs: nada re-renderiza por quadro)
  const S = useRef({
    anim: null as Anim | null,
    alt: null as Altura | null,
    doses: {} as Partial<Record<AdicionalId, Group[]>>,
    naMesa: {} as Partial<Record<AdicionalId, number>>,
    quedas: [] as { obj: Object3D; de: Vector3; t: number }[],
    saindo: [] as { obj: Object3D; t: number; s0: number; manter?: boolean }[],
    voltas: [] as { obj: Object3D; t: number }[],
    slots: { b1: null, b2: null, p1: null, p2: null } as Record<SlotId, Item | null>,
    copos: new Map<string, { obj: Group; t: number; x: number; z: number }>(),
    fade: { est: 1, potes: 0, beb: 0, por: 0, sacola: 0 },
    sacola: "nada" as "nada" | "rodando" | "pronta",
    estado: "nada" as EstadoSacola,
    fila: [] as (() => Anim | null)[],
    proj: "",
    ocupado: false,
  });

  // "Montar de novo": a mesa volta vazia (doses, separados, bebidas) e as doses serão refeitas na superfície nova
  const rodadaVista = useRef(rodada);
  useEffect(() => {
    if (rodadaVista.current === rodada) return;
    rodadaVista.current = rodada;
    const s = S.current;
    if (s.anim) { s.anim.punhado?.removeFromParent(); s.anim = null; H.raiz.visible = false; }
    P.cobertura.clear();
    s.doses = {}; s.naMesa = {}; s.alt = null; s.quedas = []; s.saindo = []; s.fila = [];
    s.copos.forEach((c) => c.obj.removeFromParent()); s.copos.clear();
    (Object.keys(s.slots) as SlotId[]).forEach((k) => { s.slots[k]?.obj.removeFromParent(); s.slots[k] = null; });
  }, [rodada, P, H]);

  /**
   * Superfície do lanche: grade de alturas por raio de cima para baixo (só o que está visível). `semTampa`: ignora a
   * tampa (aberta, em pé atrás do pão, na etapa Turbinar).
   */
  const alturas = (semTampa = false): Altura => {
    const [x0, x1] = K.caixa.x, z0 = -0.075, z1 = 0.075, nx = 25, nz = 9;
    const r = new Raycaster(); const dir = new Vector3(0, -1, 0); const o = new Vector3();
    const visivel = (n: Object3D | null): boolean => {
      for (let p = n; p; p = p.parent) { if (!p.visible || (semTampa && p.name.includes("tampa"))) return false; if (p === K.lanche) return true; }
      return true;
    };
    const espaco = P.raiz.parent;
    espaco?.updateWorldMatrix(true, false);
    K.lanche.updateWorldMatrix(true, true);
    const h: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      o.set(x0 + ((x1 - x0) * i) / (nx - 1), 0.6, z0 + ((z1 - z0) * j) / (nz - 1));
      r.set(o, dir);
      if (espaco) r.ray.applyMatrix4(espaco.matrixWorld);
      const hit = r.intersectObject(K.lanche, true).find((x) => visivel(x.object) && !P.cobertura.getObjectById(x.object.id));
      h.push(hit ? (espaco ? espaco.worldToLocal(hit.point.clone()).y : hit.point.y) : NaN);
    }
    // fora do lanche (o raio não acertou nada): repete a altura vizinha, para a borda da camada não despencar até a tábua
    for (let volta = 0; volta < nx && h.some(Number.isNaN); volta++) {
      const ant = h.slice();
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        if (!Number.isNaN(ant[j * nx + i])) continue;
        const viz = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && a < nx && b >= 0 && b < nz).map(([a, b]) => ant[b * nx + a]).filter((v) => !Number.isNaN(v));
        if (viz.length) h[j * nx + i] = Math.max(...viz);
      }
    }
    for (let k = 0; k < h.length; k++) if (Number.isNaN(h[k])) h[k] = 0;
    return (x, z) => {
      const fx = c01((x - x0) / (x1 - x0)) * (nx - 1), fz = c01((z - z0) / (z1 - z0)) * (nz - 1);
      const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), u = fx - i, v = fz - j;
      const a = h[j * nx + i], b = h[j * nx + i + 1], c = h[(j + 1) * nx + i], d = h[(j + 1) * nx + i + 1];
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    };
  };
  const dosesDe = (id: AdicionalId) => {
    const s = S.current;
    if (!s.doses[id]) {
      // os potinhos vão sobre o recheio (tampa aberta); o queijo em dobro, sobre o queijo da tampa fechada
      const queijo = id === "queijo-dobro";
      const alt = queijo ? alturas() : (s.alt ??= alturas(true));
      const k = ORDEM_ADICIONAIS.indexOf(id);
      const larg = (K.caixa.x[1] - K.caixa.x[0]) * 0.4;
      const off: [number, number] = [[-0.012, 0.01, 0.006, -0.008, 0.012, 0][k], [-0.014, 0.014, -0.004, 0.01, 0.002, 0][k]];
      s.doses[id] = [0, 1, 2].map((i) => {
        const d = dose(id, i, alt, larg, 101 + k * 17 + i * 5, off);
        d.visible = false; P.cobertura.add(d); return d;
      });
    }
    return s.doses[id]!;
  };

  // ------------------------------------------------ mão
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), c: new Vector3(), d: new Vector3(), q: new Quaternion() }), []);
  const Q = useMemo(() => ({ mao_punhado: qBase("mao_punhado"), mao_aberta: qBase("mao_aberta") }), []);
  const maoEm = (pose: "mao_punhado" | "mao_aberta", ponto: Vector3, inclina = 0) => {
    (Object.keys(H.poses) as Pose[]).forEach((k) => { H.poses[k].visible = k === pose; });
    Object.values(H.fer).forEach((f) => { if (f) f.visible = false; });
    H.raiz.quaternion.copy(Q[pose]);
    if (inclina) H.raiz.quaternion.premultiply(tmp.q.setFromAxisAngle(tmp.d.set(0, 0, 1), inclina));
    H.raiz.position.copy(ponto).sub(tmp.d.set(...POSES[pose].ponto).applyQuaternion(H.raiz.quaternion));
    H.raiz.visible = true;
  };

  const novaAnim = (tipo: string, pega: Vector3 | null, solta: Vector3, desce: number, extra: Partial<Anim>): Anim => {
    const tl = pega ? TL : TL_FORA;
    const sobreSolta = solta.clone(); sobreSolta.y += desce;
    const ini = pega ?? sobreSolta;
    const fora = ini.clone().add(M.fora); fora.y += 0.05;
    const foraSai = solta.clone().add(M.fora); foraSai.y += 0.1;
    return { tipo, t: 0, D: tl.D, tl, pega, sobreSolta, solta, fora, foraSai, leva: [], ...extra };
  };

  /** Ponto da mão no instante t. Devolve a pose. */
  const passoMao = (a: Anim, t: number, out: Vector3): "mao_punhado" | "mao_aberta" => {
    const { tl } = a;
    if (a.pega && t < tl.fecha) {
      const sobre = tmp.a.copy(a.pega); sobre.y += 0.05;
      if (t < tl.chega) {
        const c1 = tmp.b.lerpVectors(a.fora, sobre, 0.5); c1.y += 0.08;
        cubica(out, a.fora, c1, sobre, sobre, eOut3(t / tl.chega));
      } else out.lerpVectors(sobre, a.pega, eIOs(seg(t, tl.chega, tl.assenta)));
      return t > tl.fecha - 0.03 ? "mao_punhado" : "mao_aberta";
    }
    if (t < tl.leva) {
      const de = a.pega ?? a.fora;
      const c1 = tmp.b.copy(de); c1.y += a.pega ? 0.1 : 0.04;
      const c2 = tmp.c.copy(a.sobreSolta); c2.y += 0.06;
      cubica(out, de, c1, c2, a.sobreSolta, a.pega ? eIO3(seg(t, tl.fecha, tl.leva)) : eOut3(seg(t, 0, tl.leva)));
      return "mao_punhado";
    }
    if (t < tl.solta) {
      out.lerpVectors(a.sobreSolta, a.solta, eIOs(seg(t, tl.leva, tl.desce)));
      return "mao_punhado";
    }
    const k = seg(t, tl.solta + 0.04, a.D);
    out.lerpVectors(a.solta, a.foraSai, eIn2(k));
    out.y += 0.03 * eOut3(seg(t, tl.solta, tl.solta + 0.12));
    return "mao_aberta";
  };

  // ------------------------------------------------ animações
  /** Onde a mão pega o punhado: o potinho do Turbinar ou, no queijo em dobro, a tigela do queijo escolhido. */
  const pegaDe = (id: AdicionalId): Vector3 => {
    const pote = P.potes.find((p) => p.id === id);
    if (pote) { const v = pote.g.position.clone(); v.y += pote.alto + 0.006; return v; }
    const q = opts.current.pedido?.opcoes?.queijo;
    const st = K.estacoes[`mussarela:${q}`] ?? K.estacoes["dog-mussarela"] ?? Object.values(K.estacoes)[0];
    const v = st.raiz.position.clone(); v.y = MESA + st.alto + 0.012; return v;
  };
  const animPunhado = (id: AdicionalId, i: number): Anim => {
    const pega = pegaDe(id);
    const d = dosesDe(id)[i];
    const alvo = d.position.clone(); alvo.y += 0.05;
    const mao = punhadoNaMao(id, 300 + i);
    mao.visible = false; P.raiz.add(mao);
    return novaAnim(`punhado-${id}`, pega, alvo, 0.02, {
      punhado: mao,
      aoSoltar: () => {
        mao.removeFromParent();
        d.visible = true;
        S.current.quedas.push({ obj: d, de: new Vector3(0, 0.045, 0), t: 0 });
        S.current.naMesa[id] = (S.current.naMesa[id] ?? 0) + 1;
      },
    });
  };

  const lugar = (slot: SlotId) => { const [x, z] = LUG[opts.current.arranjo][slot]; return new Vector3(x, P.yEm(x, z), z); };
  /** A mão pega o item na prateleira (ou já vem de fora com ele) e põe no lugar do slot. */
  const animLevar = (slot: SlotId, it: Item): Anim => {
    const prat = [...P.pratBeb.itens, ...P.pratPor.itens].find((p) => p.chave === it.chave && p.obj.visible && p.obj.scale.x > 0.9);
    const dest = lugar(slot);
    const off = new Vector3(0, -it.alto + 0.006, 0);
    it.obj.position.copy(dest); it.obj.visible = false; it.obj.scale.setScalar(1);
    P.raiz.add(it.obj);
    const solta = dest.clone(); solta.y += it.alto - 0.006;
    let pega: Vector3 | null = null;
    if (prat) { pega = prat.obj.position.clone(); pega.y += prat.alto - 0.006; }
    return novaAnim(`levar-${it.chave}`, pega, solta, 0.05, {
      leva: [{ obj: it.obj, off, s0: 1, s1: 1 }],
      aoPegar: () => { if (prat) { prat.obj.visible = false; } it.obj.visible = true; },
      aoFim: () => { if (prat) { prat.obj.visible = true; S.current.voltas.push({ obj: prat.obj, t: 0 }); } },
    });
  };

  /** Boca da sacola (centro, no mundo), `fundo` metros abaixo da borda. */
  const boca = (fundo = 0) => { const v = P.sacola.position.clone(); v.y += SACOLA.alto * SACOLA.escala - fundo; return v; };
  type AnimQ = Anim & { quadro?: (t: number) => void };

  /** Ensacar o lanche: a mão pega o lanche e põe na boca da sacola, desce um pouco e solta lá dentro. */
  const animEnsacar = (objs: Object3D[], pega: Vector3, escala: number): Anim => {
    // o lanche pende ~topo × escala abaixo da mão: a base dele entra ~1/3 da altura da sacola
    const solta = boca(SACOLA.alto * SACOLA.escala * 0.32); solta.y += (pega.y) * escala;
    const a = novaAnim("ensacar-lanche", pega, solta, 0.09, {
      leva: objs.map((o) => ({ obj: o, off: o.position.clone().sub(pega), s0: o.scale.x, s1: escala })),
      aoSoltar: () => { objs.forEach((o) => { o.visible = false; }); },
    });
    return a;
  };

  /** Bebida, porção ou separado pula para dentro da sacola: arco, encolhe um pouco e amassa ao entrar. */
  const animPulo = (nome: string, obj: Object3D, escala: number, lado: number): Anim => {
    const de = obj.position.clone(); const s0 = obj.scale.x || 1;
    const b = boca();
    const a: AnimQ = novaAnim(`pulo-${nome}`, null, b, 0, {});
    const red = opts.current.reduzido;
    const voo = red ? 0.32 : 0.5, D = red ? 0.42 : 0.72;
    a.D = D;
    const alto = 0.05 + Math.max(0, b.y - de.y) * 0.2;
    const q0 = obj.quaternion.clone(); const giro = new Quaternion();
    a.quadro = (t) => {
      obj.visible = true;
      if (t < voo) {
        const k = t / voo, e = eIOs(k);
        obj.position.lerpVectors(de, b, e);
        obj.position.y = de.y + (b.y + 0.01 - de.y) * e + (red ? 0 : alto * 4 * k * (1 - k));
        const sc = s0 + (escala - s0) * e;
        // estica no voo
        const st = red ? 0 : 0.1 * Math.sin(Math.PI * k);
        obj.scale.set(sc * (1 - st * 0.5), sc * (1 + st), sc * (1 - st * 0.5));
        obj.quaternion.copy(q0).premultiply(giro.setFromAxisAngle(tmp.d.set(0, 0, 1), (red ? 0 : 0.5) * lado * Math.sin(Math.PI * k)));
      } else {
        // entra: amassa (squash) e afunda na sacola, que balança
        const k = seg(t, voo, D);
        const sq = red ? 0 : 0.28 * Math.sin(Math.PI * Math.min(1, k * 1.6));
        obj.position.copy(b); obj.position.y -= (SACOLA.alto * SACOLA.escala * 0.75) * eIn2(k) + 0.01;
        obj.scale.set(escala * (1 + sq), escala * (1 - sq * 1.3), escala * (1 + sq));
        obj.quaternion.copy(q0);
        const m = red ? 0 : Math.sin(Math.PI * k);
        P.aberta.scale.set(1 + 0.035 * m, 1 - 0.05 * m, 1 + 0.035 * m);
      }
      if (t >= D - 0.001) { obj.visible = false; P.aberta.scale.setScalar(1); }
    };
    return a;
  };

  /** Fecha: a boca aperta, a aba dobra para a frente, vira a sacola fechada (com mola), a etiqueta carimba. */
  const animFechar = (): Anim => {
    const a: AnimQ = novaAnim("fechar", null, P.sacola.position.clone(), 0, {});
    const red = opts.current.reduzido;
    a.D = red ? 0.7 : 1.45;
    const y0 = P.sacola.position.y, giro = P.sacola.rotation.y;
    let avisou = false;
    a.quadro = (t) => {
      const T = red ? t * (1.45 / 0.7) : t;
      if (T < 0.5) {
        // aperta a boca (frente e trás se encontram) e a aba dobra por cima
        const k = eIOs(c01(T / 0.22));
        P.aberta.visible = true; P.fechada.visible = false;
        P.aberta.scale.set(1 - 0.03 * k, 1 - 0.06 * eIOs(seg(T, 0.2, 0.5)), 1 - 0.32 * k);
        const ka = seg(T, 0.14, 0.5);
        P.aba.visible = ka > 0;
        P.aba.position.z = -0.052 * (1 - 0.32 * k);
        P.aba.rotation.x = Math.PI * 0.6 * eIO3(ka);
      } else {
        P.aberta.visible = false; P.aba.visible = false; P.fechada.visible = true; P.aberta.scale.setScalar(1);
        const k = seg(T, 0.5, 0.95);
        const y = red ? 1 : 0.92 + 0.08 * mola(k, 0.65);
        P.fechada.scale.set(1 + (1 - y) * 0.5, y, 1 + (1 - y) * 0.5);
        // etiqueta: desce e carimba sobre a dobra
        const ke = seg(T, 0.62, 0.92);
        P.etiquetas.forEach((e) => { e.visible = ke > 0; e.position.y = (e.userData.y0 as number) + 0.05 * (1 - (red ? ke : mola(ke, 0.5))); });
        if (!avisou && T > 0.7) { avisou = true; estadoSacola.current("fechou"); }
      }
      // pulinho de "fechou!"
      const kp = seg(T, 0.92, 1.4);
      P.sacola.position.y = y0 + (red ? 0 : 0.03 * Math.sin(Math.PI * kp));
      P.sacola.rotation.y = giro + (red ? 0 : 0.07 * Math.sin(Math.PI * 2 * kp) * (1 - kp));
    };
    return a;
  };

  // ------------------------------------------------ o que a mesa deveria ter
  const desejos = (p: Pedido | null): Record<SlotId, Desejo> => {
    if (!p) return { b1: null, b2: null, p1: null, p2: null };
    const b = p.bebida;
    const corB = b?.id === "lata" ? SABORES_LATA[b.sabor].cor : b?.id === "soda" ? SABORES_SODA[b.sabor].cor : "";
    const lataCombo = p.combo && b?.id !== "lata" && p.lataCombo ? { chave: "lata" as const, cor: SABORES_LATA[p.lataCombo].cor } : null;
    return {
      b1: b ? { chave: b.id, cor: corB } : null,
      b2: lataCombo,
      p1: p.combo ? { chave: "batata", cor: "" } : p.porcao ? { chave: p.porcao, cor: "" } : null,
      p2: p.combo && p.porcao ? { chave: p.porcao, cor: "" } : null,
    };
  };

  /** Próxima diferença entre o pedido e a mesa (uma animação por vez). Devolve true se a mesa já bate. */
  const conciliar = (): boolean => {
    const s = S.current; const p = opts.current.pedido;
    if (!p) return true;
    let ok = true;
    // adicionais: até 3 doses visíveis por item
    for (const id of ORDEM_ADICIONAIS) {
      const quer = Math.min(3, p.adicionais[id] ?? 0);
      const tem = s.naMesa[id] ?? 0;
      if (tem > quer) {
        const ds = dosesDe(id);
        for (let i = quer; i < tem; i++) s.saindo.push({ obj: ds[i], t: 0, s0: 1, manter: true });
        s.naMesa[id] = quer;
      } else if (tem < quer) {
        ok = false;
        if (!s.anim) s.anim = animPunhado(id, tem);
      }
    }
    // bebidas e porções
    const d = desejos(p);
    (Object.keys(d) as SlotId[]).forEach((k) => {
      const it = s.slots[k]; const w = d[k];
      if (it && (!w || it.chave !== w.chave)) { s.saindo.push({ obj: it.obj, t: 0, s0: it.obj.scale.x }); s.slots[k] = null; }
      const atual = s.slots[k];
      if (atual && w && w.cor) tingir(atual, w.cor);
      if (!atual && w) {
        ok = false;
        if (!s.anim) { const novo = P.novoItem(w.chave); if (w.cor) tingir(novo, w.cor); s.slots[k] = novo; s.anim = animLevar(k, novo); }
      }
    });
    // separados: até 2 potinhos por item, em fila na frente do lanche
    const lista: string[] = [];
    ORDEM_SEPARADOS.forEach((id) => { for (let i = 0; i < Math.min(2, p.separados[id] ?? 0); i++) lista.push(`${id}#${i}`); });
    s.copos.forEach((c, chave) => { if (!lista.includes(chave)) { s.saindo.push({ obj: c.obj, t: 0, s0: c.obj.scale.x }); s.copos.delete(chave); } });
    const [cx, cz] = LUG[opts.current.arranjo].copos;
    lista.forEach((chave, i) => {
      let c = s.copos.get(chave);
      const x = cx + i * 0.047, z = cz + (i % 2) * 0.006;
      if (!c) {
        const obj = potinhoSeparado(chave.split("#")[0] as (typeof ORDEM_SEPARADOS)[number]);
        obj.position.set(x, P.bt.max.y, z); obj.scale.setScalar(0.001); P.copos.add(obj);
        c = { obj, t: 0, x, z }; s.copos.set(chave, c);
      }
      c.x = x; c.z = z;
    });
    return ok;
  };

  /** Monta a fila da sacola: a mão põe o lanche; separados, bebidas e porções pulam um a um; depois fecha. */
  const encherFila = () => {
    const s = S.current;
    const lanche = K.raiz.children.filter((c) => c !== P.tabua);
    const topo = Math.max(K.caixa.y[1] - 0.01, 0.05);
    camApi.current?.garantir([boca(), new Vector3(0, topo, 0), new Vector3(K.caixa.x[0], 0, 0)]);
    s.fila.push(() => animEnsacar(lanche, new Vector3(0, topo, 0), 0.55));
    let lado = 1;
    [...s.copos.values()].forEach((c, i) => s.fila.push(() => animPulo(`separado-${i}`, c.obj, 0.85, (lado = -lado))));
    (["b1", "b2", "p1", "p2"] as SlotId[]).forEach((k) => {
      const it = s.slots[k];
      if (it) s.fila.push(() => animPulo(it.chave, it.obj, it.chave === "batata" || it.chave === "dadinho" ? 0.7 : 0.82, (lado = -lado)));
    });
    s.fila.push(() => animFechar());
    s.fila.push(() => { s.sacola = "pronta"; estadoSacola.current("pronta"); fimSacola.current(); return null; });
  };

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    (window as unknown as { __pedido3d: unknown }).__pedido3d = { S, P };
  }, [P]);

  // ------------------------------------------------ quadro a quadro
  const ultimo = useRef<string>("");
  const tempoProj = useRef(0);
  useFrame((_, delta) => {
    if (pausado) return;
    const pausa = (window as unknown as { __pedidoPausa?: boolean }).__pedidoPausa;
    const dt = pausa ? 0 : Math.min(delta, 0.1);
    const { fase, reduzido: red, arranjo: arr } = opts.current;
    const s = S.current;

    // ---- entra/sai de cada grupo
    const alvo = { est: fase === "montagem" ? 1 : 0, potes: fase === "turbinar" ? 1 : 0, beb: fase === "bebida" ? 1 : 0, por: fase === "acomp" ? 1 : 0, sacola: fase === "sacola" ? 1 : 0 };
    const antesEst = s.fade.est;
    (Object.keys(alvo) as (keyof typeof alvo)[]).forEach((k) => {
      const v = s.fade[k]; const t = alvo[k];
      s.fade[k] = t > v ? Math.min(t, v + dt / (red ? 0.25 : 0.45)) : Math.max(t, v - dt / (red ? 0.2 : 0.3));
    });
    const esc = (k: number, cresce: boolean) => (k >= 1 ? 1 : Math.max(0.001, cresce && !red ? mola(k, 0.6) : eOut3(k)));
    if (s.fade.est < 1 || antesEst < 1) {
      // estações da montagem saem no Turbinar (os potinhos ocupam o lugar delas) e voltam para a tampa; saem de vez
      // depois do lanche pronto. Só a escala muda: a visibilidade de cada peça continua a da montagem.
      const k = s.fade.est;
      // tudo o que mora no grupo das estações (raízes, ferramentas soltas no mundo, peças extras como a 2a bisnaga)
      const e = Math.max(0.001, eIO3(k));
      const grupos = new Set<Object3D>();
      Object.values(K.estacoes).forEach((st) => { if (st.raiz.parent) grupos.add(st.raiz.parent); });
      grupos.forEach((w) => w.children.forEach((o) => {
        if (Object.values(K.estacoes).some((st) => st.anel === o)) return;
        o.scale.setScalar(e);
      }));
    }
    const lu = LUG[arr];
    P.potes.forEach((p, i) => {
      const [x, z] = lu.potes[LUGAR_POTE[i]];
      p.g.position.set(x, MESA, z);
      const k = c01(s.fade.potes * 1.25 - i * 0.05);
      p.g.visible = k > 0.01; p.g.scale.setScalar(esc(k, alvo.potes === 1));
    });
    const prateleira = (pr: { bandeja: Mesh; itens: Item[] }, f: number, cresce: boolean) => {
      const xs = pr.itens.length === 3 ? lu.prat : [lu.prat[0], lu.prat[2]].map(([x, z]) => [x * 0.75, z] as XZ);
      const zb = Math.min(...xs.map((v) => v[1]));
      pr.bandeja.position.set(0, MESA + 0.006, zb + 0.005);
      pr.bandeja.visible = f > 0.01; pr.bandeja.scale.set(Math.max(0.001, eOut3(f)), 1, 1);
      pr.itens.forEach((it, i) => {
        const [x, z] = xs[i];
        if (s.voltas.some((v) => v.obj === it.obj)) return;
        it.obj.position.set(x, MESA + 0.012, z);
        const k = c01(f * 1.3 - i * 0.1);
        if (k <= 0.01) { it.obj.visible = false; return; }
        if (!s.anim || !s.anim.leva.some((l) => l.obj === it.obj)) {
          const levando = s.anim?.tipo === `levar-${it.chave}` && s.anim.pegou;
          if (!levando) { it.obj.visible = true; it.obj.scale.setScalar(esc(k, cresce)); }
        }
      });
    };
    prateleira(P.pratBeb, s.fade.beb, alvo.beb === 1);
    prateleira(P.pratPor, s.fade.por, alvo.por === 1);
    // sacola
    if (s.sacola === "nada") {
      const [x, z] = lu.sacola;
      P.sacola.position.set(x, MESA, z);
      P.sacola.rotation.set(0, Math.atan2(-x, 1.5), 0);
      P.sacola.visible = s.fade.sacola > 0.01;
      P.sacola.scale.setScalar(SACOLA.escala * esc(s.fade.sacola, true));
      const est = s.fade.sacola >= 1 ? "aberta" : "nada";
      if (est !== s.estado) { s.estado = est; estadoSacola.current(est); }
    }

    // ---- quedas, saídas, voltas
    s.quedas = s.quedas.filter((q) => {
      q.t += dt;
      const k = c01(q.t / (red ? 0.16 : 0.24));
      const base = (q.obj.userData.casa as Vector3 | undefined) ?? (q.obj.userData.casa = q.obj.position.clone());
      q.obj.position.copy(base).addScaledVector(q.de, 1 - eIn2(k));
      const pouso = seg(q.t, red ? 0.16 : 0.24, red ? 0.26 : 0.46);
      const sq = red || k < 1 ? 0 : 0.22 * Math.sin(Math.PI * pouso) * (1 - pouso);
      const sc = 0.65 + 0.35 * k;
      q.obj.scale.set(sc * (1 + sq), sc * (1 - sq * 1.4), sc * (1 + sq));
      if (pouso >= 1) { q.obj.position.copy(base); q.obj.scale.setScalar(1); return false; }
      return true;
    });
    s.saindo = s.saindo.filter((o) => {
      o.t += dt;
      const k = c01(o.t / 0.22);
      o.obj.scale.setScalar(Math.max(0.001, o.s0 * (1 - eIn2(k))));
      if (k >= 1) { o.obj.visible = false; if (!o.manter) o.obj.removeFromParent(); o.obj.scale.setScalar(1); if (o.obj.userData.casa) o.obj.position.copy(o.obj.userData.casa); return false; }
      return true;
    });
    // doses que saíram voltam a ficar prontas (escondidas) para a próxima vez
    s.voltas = s.voltas.filter((v) => {
      v.t += dt;
      const k = c01(v.t / 0.45);
      v.obj.visible = true; v.obj.scale.setScalar(esc(k, true));
      return k < 1;
    });
    s.copos.forEach((c) => {
      if (s.anim?.leva.some((l) => l.obj === c.obj) || s.sacola !== "nada") return;
      c.t += dt;
      c.obj.position.x += (c.x - c.obj.position.x) * Math.min(1, dt * 10);
      c.obj.position.z += (c.z - c.obj.position.z) * Math.min(1, dt * 10);
      c.obj.scale.setScalar(esc(c01(c.t / 0.4), true));
    });

    // ---- animação da mão
    let ok = true;
    if (!s.anim) {
      ok = conciliar();
      if (!s.anim && fase === "sacola" && opts.current.ensacar && ok && s.sacola === "nada" && s.fade.sacola >= 1) {
        s.sacola = "rodando"; s.estado = "rodando"; estadoSacola.current("rodando"); encherFila();
      }
      while (!s.anim && s.fila.length) s.anim = s.fila.shift()!();
    }
    const quieto = ok && !s.anim && !s.fila.length && s.quedas.length === 0 && s.saindo.length === 0;
    (window as unknown as { __pedidoQuieto: boolean }).__pedidoQuieto = quieto;
    if (s.ocupado === quieto) { s.ocupado = !quieto; ocupar.current(!quieto); }
    const a = s.anim;
    if (a) {
      a.t += dt * (red ? 1.5 : 1);
      const t = a.t;
      const q = a as Anim & { quadro?: (t: number) => void };
      if (q.quadro) {
        q.quadro(t);
        H.raiz.visible = false;
      } else {
        const pos = tmp.a.set(0, 0, 0);
        const ponto = new Vector3();
        const pose = passoMao(a, t, ponto);
        pos.copy(ponto);
        const inclina = t < a.tl.chega ? -0.14 * (1 - eOut3(t / Math.max(0.01, a.tl.chega))) : 0;
        maoEm(pose, pos, red ? 0 : inclina);
        if (!a.pegou && t >= a.tl.fecha) { a.pegou = true; a.aoPegar?.(); }
        if (a.pegou && !a.soltou) {
          const k = a.pega ? seg(t, a.tl.fecha, a.tl.leva) : seg(t, 0, a.tl.leva);
          a.leva.forEach((l) => {
            l.obj.visible = true;
            const sc = l.s0 + (l.s1 - l.s0) * eIO3(k);
            l.obj.scale.setScalar(sc);
            l.obj.position.copy(ponto).addScaledVector(l.off, sc / Math.max(0.001, l.s0));
          });
          if (a.punhado) { a.punhado.visible = true; a.punhado.position.copy(ponto).add(tmp.b.set(0.004, -0.012, 0)); }
        }
        if (!a.soltou && t >= a.tl.solta) {
          a.soltou = true;
          a.leva.forEach((l) => { const sc = l.s1; l.obj.scale.setScalar(sc); l.obj.position.copy(a.solta).addScaledVector(l.off, sc / Math.max(0.001, l.s0)); });
          a.aoSoltar?.();
        }
      }
      (window as unknown as { __pedidoAnim: unknown }).__pedidoAnim = { tipo: a.tipo, t: a.t, D: a.D };
      if (t >= a.D) {
        s.anim = null; H.raiz.visible = false;
        a.aoFim?.();
        (window as unknown as { __pedidoAnim: unknown }).__pedidoAnim = null;
      }
    }

    // ---- projeção dos potinhos e prateleiras para o HUD
    if (gl.xr.isPresenting && performance.now() - tempoProj.current < 50) return;
    tempoProj.current = performance.now();
    const cameraTela = gl.xr.isPresenting ? gl.xr.getCamera().cameras[0] ?? camera : camera;
    const proj = (x: number, y: number, z: number) => {
      tmp.c.set(x, y, z); P.raiz.localToWorld(tmp.c); tmp.c.project(cameraTela);
      return [(tmp.c.x + 1) / 2 * size.width, (1 - tmp.c.y) / 2 * size.height, tmp.c.z];
    };
    const out: ProjPedido = {};
    const pp = (chave: string, o: Object3D, alto: number, raio: number) => {
      const [cx, cy, prof] = proj(o.position.x, o.position.y + alto * 0.5, o.position.z);
      if (prof < -1 || prof > 1 || !Number.isFinite(cx + cy)) return;
      const [ex] = proj(o.position.x + raio, o.position.y + alto * 0.5, o.position.z);
      const [, ty] = proj(o.position.x, o.position.y + alto, o.position.z);
      out[chave] = { x: Math.round(cx), y: Math.round(cy), r: Math.round(Math.min(80, Math.max(26, Math.abs(ex - cx) * 1.25))), t: Math.round(ty) };
    };
    P.potes.forEach((p) => pp(`adicional-${p.id}`, p.g, p.alto, p.raio));
    P.pratBeb.itens.forEach((it) => pp(`bebida-${it.chave}`, it.obj, it.alto, 0.04));
    P.pratPor.itens.forEach((it) => pp(`porcao-${it.chave}`, it.obj, it.alto, 0.06));
    if (P.sacola.visible) pp("sacola", P.sacola, SACOLA.alto * P.sacola.scale.y, 0.09 * P.sacola.scale.x);
    const chave = JSON.stringify(out);
    if (chave !== ultimo.current) { ultimo.current = chave; projetar.current(out); }
  });

  return <primitive object={P.raiz} />;
}
