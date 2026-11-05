"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import {
  AdditiveBlending, Box3, BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute,
  Group, InstancedMesh, LatheGeometry, Material, MathUtils, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  PerspectiveCamera, Plane, PlaneGeometry, PMREMGenerator, PointLight, Quaternion, Raycaster, SRGBColorSpace, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  ACOES, COSTELA, CREME, MACA, MUSS, OPEN, PASTA, TAMPA, anguloTampa, c01, cremeConcha, duracao, eIO3, eIOs, eOut3, lerp, mola, pastaBico, pegadaDe, pulso, seg,
  tempoTrabalho, type Medidas, type Pegada, type Pose,
} from "./acoes";
import { CAMERAS, ESTACOES, MESA, arranjoDe, fovPara, type Arranjo, type EstacaoId, type Passo } from "./layout";

const ROOT = "/assets/models/bancada/";
// Arquivos em public/assets/models/bancada/ (contrato no blender/bancada3d/README.md). A mão é o mao-luva.glb.
const ARQUIVOS = ["tabua.glb", "pao.glb", "pasta.glb", "costela.glb", "creme.glb", "mussarela.glb", "gratinado.glb", "macarico-mao.glb", "mao-luva.glb", "bisnaga.glb", "pote-creme.glb"] as const;
const NOMES = ARQUIVOS.map((a) => a.replace(/\.glb$/, "")) as unknown as readonly ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico-mao", "mao-luva", "bisnaga", "pote-creme"];
const glb = (n: string) => `${ROOT}${n}.glb`;
useGLTF.setDecoderPath("/draco/");
export const preCarregar = () => NOMES.forEach((n) => useGLTF.preload(glb(n)));

export type Modo = "arraste" | "toque" | "auto";
export type Bus = { drag: { ativo: boolean; id: EstacaoId | null; x: number; y: number } };
export type Ponto = { x: number; y: number; r: number };
export type Projecao = { estacoes: Record<EstacaoId, Ponto>; lanche: { x0: number; y0: number; x1: number; y1: number }; arranjo: Arranjo };
export type ApiCena = {
  acao: (id: Passo, modo: Modo) => void;
  soltar: (id: EstacaoId) => void;
  reiniciar: () => void;
  interromper: () => void;
};
type Props = {
  ativo: Passo | null; reduzido: boolean;
  bus: MutableRefObject<Bus>; api: MutableRefObject<ApiCena | null>;
  aoFim: (id: Passo) => void; aoProjetar: (p: Projecao) => void; aoPronto: () => void;
  congelar: { id: Passo; t: number } | null;
};

// ---------------------------------------------------------------- mão de luva (README, seção LAR-449)
type InfoPose = { braco: [number, number, number]; ponto: [number, number, number]; base: [number, number, number] };
const POSES: Record<Pose, InfoPose> = {
  mao_bisnaga: { braco: [0.95, 0.26, 0.17], ponto: [-0.0848, -0.0968, 0.0293], base: [0, 0.18, 0] },
  mao_colher: { braco: [0.81, 0.42, 0.41], ponto: [-0.1209, -0.0939, 0.0084], base: [0, 0.46, 0] },
  mao_macarico: { braco: [0.51, 0.45, 0.73], ponto: [-0.1041, -0.1427, -0.057], base: [0, 0.62, 0.05] },
  mao_punhado: { braco: [0.86, 0.48, 0.15], ponto: [-0.0637, -0.0659, 0.0021], base: [0, 0.17, 0] },
  mao_aberta: { braco: [0.86, 0.48, 0.15], ponto: [-0.0597, -0.0473, -0.0016], base: [0, 0.17, 0] },
};
const OBJ = {
  bisnaga: { p: new Vector3(-0.0848, 0.0932, 0.0293), q: new Quaternion(0.0744, 0, 0.9972, 0) },
  colher: { p: new Vector3(-0.0454, -0.0308, -0.0511), q: new Quaternion(0.0797, 0.3176, 0.23, 0.9164) },
  macarico: { p: new Vector3(-0.0031, -0.0724, -0.057), q: new Quaternion() },
};
const CHAMA_DIR = new Vector3(-0.8192, -0.5736, 0);
const POSE_DE: Record<Passo, Pose> = { pasta: "mao_bisnaga", creme: "mao_colher", costela: "mao_punhado", tampa: "mao_aberta", mussarela: "mao_punhado", macarico: "mao_macarico" };
const qBase = (p: Pose) => new Quaternion().setFromEuler(new Euler(...POSES[p].base, "YXZ"));
// Onde a ferramenta assenta quando é solta no ar sobre o lanche: na tábua, à frente e à direita do pão.
const NA_TABUA = new Vector3(0.15, 0, 0.1);
/** Põe a ferramenta parada de modo que a mão, com a raiz em `qG`, pegue com o ponto útil em `ponta`. */
function porParaPegar(f: Object3D, obj: { p: Vector3; q: Quaternion }, qG: Quaternion, ponto: Vector3, ponta: Vector3) {
  const pG = ponta.clone().sub(ponto.clone().applyQuaternion(qG));
  f.quaternion.copy(qG).multiply(obj.q);
  f.position.copy(obj.p).applyQuaternion(qG).add(pG);
}
const cubica = (out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, k: number) => {
  const u = 1 - k;
  return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * k).addScaledVector(c, 3 * u * k * k).addScaledVector(d, k * k * k);
};

// ---------------------------------------------------------------- utilidades
function clonar(o: Object3D) {
  const c = o.clone(true);
  c.traverse((n) => {
    if (!(n instanceof Mesh)) return;
    n.material = Array.isArray(n.material) ? n.material.map((m: Material) => m.clone()) : (n.material as Material).clone();
    n.castShadow = true; n.receiveShadow = true;
  });
  return c;
}
const mats = (o: Object3D) => { const r: Material[] = []; o.traverse((n) => { if (n instanceof Mesh) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m: Material) => r.push(m)); }); return r; };
function clipar(o: Object3D, planos: Plane[]) { mats(o).forEach((m) => { m.clippingPlanes = planos; m.clipShadows = true; }); }
function caixa(o: Object3D) { o.updateMatrixWorld(true); return new Box3().setFromObject(o); }
/** Põe o objeto apoiado em y (pela caixa), centrado em x/z. */
function apoiar(o: Object3D, x: number, y: number, z: number) {
  o.position.set(0, 0, 0);
  const b = caixa(o);
  o.position.set(x - (b.min.x + b.max.x) / 2, y - b.min.y, z - (b.min.z + b.max.z) / 2);
}
function gradiente(paradas: [number, string][]) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  paradas.forEach(([p, cor]) => r.addColorStop(p, cor));
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}
/** Punhado de fiapos (costela desfiada ou mussarela ralada) num único BufferGeometry com cores de vértice. */
function fiapos(n: number, raio: number, cores: string[], comp: number, esp: number, seed: number) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const partes: BufferGeometry[] = [];
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), sc = new Vector3();
  for (let i = 0; i < n; i++) {
    const g = new BoxGeometry(1, 1, 1);
    const a = rnd() * Math.PI * 2, r = raio * Math.sqrt(rnd()), h = (rnd() - 0.35) * raio * 0.9;
    p.set(Math.cos(a) * r, h * (1 - (r / raio) * 0.6), Math.sin(a) * r);
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    sc.set(esp * (0.7 + rnd() * 0.8), esp * (0.6 + rnd() * 0.6), comp * (0.6 + rnd() * 0.8));
    m.compose(p, q, sc); g.applyMatrix4(m);
    const cor = new Color(cores[Math.floor(rnd() * cores.length)]).multiplyScalar(0.85 + rnd() * 0.3);
    const cols: number[] = [];
    for (let k = 0; k < g.attributes.position.count; k++) cols.push(cor.r, cor.g, cor.b);
    g.setAttribute("color", new Float32BufferAttribute(cols, 3));
    g.deleteAttribute("uv");
    partes.push(g);
  }
  return mergeGeometries(partes)!;
}
function tigela(raio: number, alto: number, cor: string) {
  const pts = [[0, 0], [raio * 0.6, 0], [raio * 0.66, 0.004], [raio * 0.9, alto * 0.45], [raio, alto], [raio - 0.005, alto + 0.002], [raio - 0.009, alto * 0.95],
    [raio * 0.85 - 0.006, alto * 0.42], [raio * 0.6 - 0.006, 0.008], [0, 0.008]].map(([x, y]) => new Vector2(x, y));
  const m = new Mesh(new LatheGeometry(pts, 48), new MeshStandardMaterial({ color: cor, roughness: 0.32, metalness: 0, side: DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- câmera
function Camara({ arranjo, M }: { arranjo: Arranjo; M: Medidas }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const c = CAMERAS[arranjo];
    const cam = camera as PerspectiveCamera;
    cam.position.set(...c.pos);
    cam.fov = fovPara(c, size.width, size.height);
    cam.near = 0.05; cam.far = 6;
    cam.lookAt(...c.alvo);
    cam.updateProjectionMatrix();
    const dist = cam.position.distanceTo(new Vector3(...c.alvo));
    const meia = dist * Math.tan(MathUtils.degToRad(cam.fov / 2)) * (size.width / size.height);
    M.fora.set(meia + 0.38, 0.16, 0.1);
  }, [camera, size, arranjo, M]);
  return null;
}

// ---------------------------------------------------------------- tudo que é 3D
type Estacao = { id: EstacaoId; raiz: Group; ferramenta: Object3D | null; casa: { p: Vector3; q: Quaternion }; apoio: Vector3; raio: number; alto: number; mats: { m: MeshStandardMaterial; cor: Color }[]; anel: Mesh; brilho: number; luz: number };
/**
 * Ação em andamento. Na pegada: a ferramenta vai de (p0,q0) até parar em (pR,qR) — a casa, ou a tábua se foi
 * solta sobre o lanche —, a mão entra de (pS,qS), pega com a raiz em (pG,qG) e leva até (pW,qW), a pose do começo do trabalho.
 */
type Ativo = {
  id: Passo; t: number; D: number; modo: Modo; vel: number; amp: number; g: Pegada | null;
  p0: Vector3; q0: Quaternion; pR: Vector3; qR: Quaternion; pS: Vector3; qS: Quaternion; pG: Vector3; qG: Quaternion; pW: Vector3; qW: Quaternion;
};
type Mola = { p: Vector3; v: Vector3; alvo: Vector3; k: number; c: number; solta: boolean };

function Mundo({ ativo, reduzido, bus, api, aoFim, aoProjetar, aoPronto, congelar, arranjo, M }: Props & { arranjo: Arranjo; M: Medidas }) {
  const assets = useGLTF(NOMES.map(glb));
  const { gl, camera, size, scene } = useThree();
  const A = useMemo(() => Object.fromEntries(NOMES.map((n, i) => [n, assets[i].scene])) as unknown as Record<(typeof NOMES)[number], Object3D>, [assets]);

  // Ambiente para reflexos (luva acetinada, bisnaga, inox): sala neutra em PMREM.
  useEffect(() => {
    const pm = new PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    gl.localClippingEnabled = true;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);

  // ------------------------------------------------ lanche
  const L = useMemo(() => {
    const raiz = new Group();
    const tabua = clonar(A.tabua);
    const lanche = new Group();
    const pao = clonar(A.pao);
    const tampa = pao.getObjectByName("pao_tampa")!;
    const clip = { pasta: new Plane(new Vector3(-1, 0, 0), -1), creme: new Plane(new Vector3(-1, 0, 0), -1), muss: new Plane(new Vector3(-1, 0, 0), -1), grat: new Plane(new Vector3(-1, 0, 0), -1) };
    const pasta = clonar(A.pasta); clipar(pasta, [clip.pasta]);
    const creme = clonar(A.creme); clipar(creme, [clip.creme]);
    const gratinado = clonar(A.gratinado); clipar(gratinado, [clip.grat]);
    mats(gratinado).forEach((m) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; });
    // costela em 3 partes (cada uma cresce no seu punhado)
    const cortes = [-1, -0.044, 0.044, 1];
    const partes = COSTELA.xs.map((xc, i) => {
      const g = new Group(); g.position.set(xc, 0.042, 0);
      const c = clonar(A.costela); c.position.set(-xc, -0.042, 0);
      clipar(c, [new Plane(new Vector3(1, 0, 0), -cortes[i]), new Plane(new Vector3(-1, 0, 0), cortes[i + 1])]);
      g.add(c);
      return g;
    });
    const mussPiv = new Group();
    const muss = clonar(A.mussarela); clipar(muss, [clip.muss]);
    mussPiv.add(muss);
    lanche.add(pao, pasta, ...partes, creme, mussPiv, gratinado);
    raiz.add(tabua, lanche);
    // medidas
    M.pasta = caixa(pasta).max.y;
    M.costela = caixa(partes[1]).max.y;
    // O creme fica por cima da costela no modelo; como ele vem antes no passo a passo, assenta na pasta
    // e sobe junto com a costela quando ela cresce.
    const cremeTopo = caixa(creme).max.y;
    M.creme = M.pasta + 0.012;
    const cremeDy = cremeTopo - M.creme;
    const bm = caixa(muss);
    M.muss = bm.max.y - 0.006;
    mussPiv.position.set(0, bm.min.y + 0.03, 0); muss.position.set(0, -(bm.min.y + 0.03), 0);
    return { raiz, lanche, tampa, pasta, creme, partes, mussPiv, muss, gratinado, clip, cremeDy };
  }, [A, M]);

  // ------------------------------------------------ estações
  const E = useMemo(() => {
    const anelTex = gradiente([[0, "rgba(255,190,110,0)"], [0.5, "rgba(255,190,110,0)"], [0.72, "rgba(255,170,80,0.85)"], [0.86, "rgba(255,140,50,0.35)"], [1, "rgba(255,120,40,0)"]]);
    const fazer = (id: EstacaoId, raiz: Group, ferramenta: Object3D | null, raio: number, alto: number): Estacao => {
      const anel = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: anelTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
      anel.rotation.x = -Math.PI / 2; anel.scale.setScalar(raio * 3.1); anel.renderOrder = 2;
      const ms: { m: MeshStandardMaterial; cor: Color }[] = [];
      [raiz, ferramenta].forEach((o) => o && mats(o).forEach((m) => { if (m instanceof MeshStandardMaterial) ms.push({ m, cor: m.color.clone() }); }));
      return { id, raiz, ferramenta, casa: { p: new Vector3(), q: new Quaternion() }, apoio: new Vector3(), raio, alto, mats: ms, anel, brilho: 0, luz: 0 };
    };
    const metal = new MeshStandardMaterial({ color: "#2a2624", roughness: 0.3, metalness: 0.85 });
    // bisnaga de bico para baixo num suporte, como em lanchonete: a mão pega já na pose de uso
    const bis = new Group(); const bisnaga = clonar(A.bisnaga);
    const supB = new Mesh(new LatheGeometry([[0, 0], [0.048, 0], [0.048, 0.006], [0.037, 0.01], [0.037, 0.058], [0.0325, 0.058], [0.0325, 0.012], [0, 0.012]].map(([x, y]) => new Vector2(x, y)), 36), metal);
    supB.castShadow = true; supB.receiveShadow = true; bis.add(supB);
    // pote de creme com a colher
    const pc = new Group(); const pote = clonar(A["pote-creme"]);
    const colher = pote.getObjectByName("colher")!;
    const colherOrig = { pai: colher.parent!, p: colher.position.clone(), q: colher.quaternion.clone() };
    pc.add(pote);
    // costela numa tigela escura
    const pk = new Group();
    pk.add(tigela(0.072, 0.052, "#2b211c"));
    [0.4, 1.9].forEach((ry, i) => {
      const c = clonar(A.costela); c.scale.set(0.4, 0.95, 1.12); c.rotation.y = ry;
      apoiar(c, 0, 0.012 + i * 0.006, 0); pk.add(c);
    });
    const fCost = new Mesh(fiapos(46, 0.024, ["#6b3418", "#8a4521", "#4a2010", "#a85a2c"], 0.026, 0.006, 11), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
    fCost.castShadow = true;
    // mussarela ralada numa tigela de barro
    const pm = new Group();
    pm.add(tigela(0.07, 0.048, "#8c4a2b"));
    const ralada = new Mesh(fiapos(260, 0.058, ["#f3dc98", "#f6e4ae", "#ecd085"], 0.016, 0.0028, 5), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    ralada.position.y = 0.034; ralada.scale.set(1, 0.42, 1); pm.add(ralada);
    const fMuss = new Mesh(fiapos(60, 0.022, ["#f3dc98", "#f6e4ae", "#ecd085"], 0.016, 0.003, 9), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    fMuss.castShadow = true;
    // maçarico de bico para baixo num coldre (a mão pega quase na pose de uso)
    const ptm = new Group();
    const sup = new Mesh(new LatheGeometry([[0, 0], [0.045, 0], [0.045, 0.007], [0.026, 0.011], [0.023, 0.05], [0.019, 0.05], [0, 0.02]].map(([x, y]) => new Vector2(x, y)), 32), metal);
    sup.castShadow = true; ptm.add(sup);
    const maca = clonar(A["macarico-mao"]);
    maca.getObjectByName("chama")?.removeFromParent();

    const lista = {
      pasta: fazer("pasta", bis, bisnaga, 0.04, 0.19),
      creme: fazer("creme", pc, colher, 0.066, 0.08),
      costela: fazer("costela", pk, fCost, 0.075, 0.07),
      mussarela: fazer("mussarela", pm, fMuss, 0.072, 0.06),
      macarico: fazer("macarico", ptm, maca, 0.05, 0.24),
    } as Record<EstacaoId, Estacao>;
    // anel em volta do pão quando a vez é da tampa
    const anelPao = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: anelTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
    anelPao.rotation.x = -Math.PI / 2; anelPao.position.set(0, 0.0015, 0); anelPao.scale.set(0.5, 0.26, 1); anelPao.renderOrder = 2;
    return { lista, bisnaga, pote, colher, colherOrig, fCost, fMuss, maca, anelPao, brilhoPao: { v: 0 } };
  }, [A]);

  // Posiciona as estações conforme o arranjo e guarda a "casa" de cada ferramenta (pose no mundo).
  const mundoEst = useRef<Group>(null);
  useLayoutEffect(() => {
    const pos = ESTACOES[arranjo];
    const { lista, bisnaga, pote, colher, colherOrig, fCost, fMuss, maca } = E;
    (Object.keys(lista) as EstacaoId[]).forEach((id) => {
      const st = lista[id];
      const [x, z] = pos[id];
      st.raiz.position.set(x, MESA, z);
      st.anel.position.set(x, MESA + 0.0015, z);
    });
    lista.pasta.raiz.add(bisnaga);
    pote.rotation.y = -0.7;
    lista.creme.raiz.add(pote);
    colherOrig.pai.add(colher); colher.position.copy(colherOrig.p); colher.quaternion.copy(colherOrig.q); colher.scale.setScalar(1);
    fCost.position.set(0, 0.075, 0); lista.costela.raiz.add(fCost);
    fMuss.position.set(0, 0.052, 0); lista.mussarela.raiz.add(fMuss);
    lista.macarico.raiz.add(maca);
    // casa = pose no mundo; a ferramenta passa a viver solta no grupo do mundo
    const w = mundoEst.current;
    (Object.keys(lista) as EstacaoId[]).forEach((id) => {
      const st = lista[id];
      if (!st.ferramenta) return;
      st.raiz.updateMatrixWorld(true);
      if (st.ferramenta.parent !== w) w?.attach(st.ferramenta);
    });
    // Casas pensadas para a pegada: a raiz da mão na pegada é casa * (ferramenta na mão)^-1, então cada
    // ferramenta fica parada numa pose em que a mão chega em pé, do lado direito, sem virar.
    {
      // bisnaga: na mão ela já fica de bico para baixo; no suporte, o bico entra no copo
      const r = lista.pasta.raiz.position;
      porParaPegar(bisnaga, OBJ.bisnaga, qBase("mao_bisnaga"), new Vector3(...POSES.mao_bisnaga.ponto), new Vector3(r.x, MESA + 0.016, r.z));
    }
    {
      // maçarico: no coldre de bico para baixo, inclinado ~10° (a mão vem de cima e gira para a pose de uso no caminho)
      const qb = qBase("mao_macarico");
      const d = CHAMA_DIR.clone().applyQuaternion(qb);
      const qc = new Quaternion().slerp(new Quaternion().setFromUnitVectors(d, new Vector3(0, -1, 0)), 0.82);
      const r = lista.macarico.raiz.position;
      porParaPegar(maca, OBJ.macarico, qc.multiply(qb), new Vector3(...POSES.mao_macarico.ponto), new Vector3(r.x, MESA + 0.024, r.z));
    }
    {
      // colher: continua apoiada no pote como no modelo, só girada em volta do eixo do pote para o cabo
      // ficar do lado de onde a mão vem
      const qG0 = colher.quaternion.clone().multiply(OBJ.colher.q.clone().invert());
      const qd = qBase("mao_colher").multiply(qG0.invert());
      const psi = 2 * Math.atan2(qd.y, qd.w);
      const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), psi);
      const c = lista.creme.raiz.position;
      colher.position.sub(c).applyQuaternion(qy).add(c);
      colher.quaternion.premultiply(qy);
    }
    {
      // punhados: o monte não tem frente, então a mão pega girada para o braço ir para a direita e para o
      // fundo (sem atravessar a frente da cena); no caminho ela gira de volta para a pose de uso
      const qb = qBase("mao_punhado");
      const bw = new Vector3(...POSES.mao_punhado.braco).applyQuaternion(qb);
      const psi = MathUtils.degToRad(40) - Math.atan2(-bw.z, bw.x);
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), psi).multiply(qb);
      fCost.quaternion.copy(q); fMuss.quaternion.copy(q);
    }
    (Object.keys(lista) as EstacaoId[]).forEach((id) => {
      const st = lista[id]; const f = st.ferramenta;
      if (!f) return;
      st.casa.p.copy(f.position); st.casa.q.copy(f.quaternion);
      // apoio: deslocamento da origem até o centro de baixo da caixa (para assentar na tábua)
      const b = caixa(f);
      st.apoio.set(f.position.x - (b.min.x + b.max.x) / 2, f.position.y - b.min.y, f.position.z - (b.min.z + b.max.z) / 2);
    });
    return () => {
      // volta as ferramentas para as raízes, para o próximo arranjo recalcular a casa
      (Object.keys(lista) as EstacaoId[]).forEach((id) => {
        const st = lista[id];
        if (!st.ferramenta || st.ferramenta.parent !== w) return;
        st.ferramenta.position.copy(st.casa.p); st.ferramenta.quaternion.copy(st.casa.q); st.ferramenta.scale.setScalar(1);
        st.raiz.updateMatrixWorld(true); st.raiz.attach(st.ferramenta);
      });
    };
  }, [E, arranjo]);

  // ------------------------------------------------ mão
  const H = useMemo(() => {
    const raiz = new Group();
    const mao = A["mao-luva"].clone(true);
    raiz.add(mao);
    const poses = {} as Record<Pose, Object3D>;
    (Object.keys(POSES) as Pose[]).forEach((p) => {
      const o = mao.getObjectByName(p)!;
      poses[p] = o;
      o.traverse((n) => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; } });
      // Manga estendida: um tubo fechado continua a manga a partir do corte, para a boca oca nunca aparecer.
      const d = new Vector3(...POSES[p].braco).normalize();
      mao.updateMatrixWorld(true);
      let melhor: Mesh | null = null, max = -1;
      o.traverse((n) => {
        if (!(n instanceof Mesh)) return;
        const pos = n.geometry.attributes.position; const v = new Vector3();
        for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld); const k = v.dot(d); if (k > max) { max = k; melhor = n; } }
      });
      if (!melhor) return;
      const mm = melhor as Mesh;
      const pos = mm.geometry.attributes.position; const v = new Vector3(); const anel: Vector3[] = [];
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mm.matrixWorld); if (v.dot(d) > max - 0.012) anel.push(v.clone()); }
      const c = anel.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / Math.max(1, anel.length));
      const raio = anel.reduce((a, b) => { const w = b.clone().sub(c); w.addScaledVector(d, -w.dot(d)); return a + w.length(); }, 0) / Math.max(1, anel.length);
      const comp = 0.9;
      const tubo = new Mesh(new CylinderGeometry(raio * 1.0, raio * 1.12, comp, 28, 1, false), Array.isArray(mm.material) ? mm.material[0] : mm.material);
      tubo.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d);
      tubo.position.copy(c).addScaledVector(d, comp / 2 - 0.022);
      tubo.castShadow = true;
      o.add(tubo);
    });
    // ferramentas na mão (no espaço da raiz da mão)
    const bis = clonar(A.bisnaga); bis.position.copy(OBJ.bisnaga.p); bis.quaternion.copy(OBJ.bisnaga.q);
    const pote2 = clonar(A["pote-creme"]);
    const col = pote2.getObjectByName("colher")!; col.removeFromParent(); col.position.copy(OBJ.colher.p); col.quaternion.copy(OBJ.colher.q);
    const mac = clonar(A["macarico-mao"]); mac.position.copy(OBJ.macarico.p); mac.quaternion.copy(OBJ.macarico.q);
    const chama = mac.getObjectByName("chama")!;
    chama.traverse((n) => { if (n instanceof Mesh) { n.castShadow = false; } });
    const solta = new Vector3(...POSES.mao_punhado.ponto);
    const cost = E.fCost.clone(); cost.position.copy(solta).add(new Vector3(0, 0.01, 0));
    const muss = E.fMuss.clone(); muss.position.copy(solta).add(new Vector3(0, 0.01, 0));
    const fer: Record<Passo, Object3D | null> = { pasta: bis, creme: col, macarico: mac, costela: cost, mussarela: muss, tampa: null };
    Object.values(fer).forEach((f) => { if (f) { f.visible = false; raiz.add(f); } });
    raiz.visible = false;
    return { raiz, poses, fer, chama };
  }, [A, E]);

  // ------------------------------------------------ efeitos
  const FX = useMemo(() => {
    const fio = new Mesh(new CylinderGeometry(0.0021, 0.0032, 1, 10, 1, true).translate(0, -0.5, 0), new MeshStandardMaterial({ color: "#f2e7c8", roughness: 0.32 }));
    fio.visible = false;
    const quedas = [0, 1, 2].map(() => { const c = E.fCost.clone(); c.visible = false; return c; });
    const N = 70;
    const ralada = new InstancedMesh(new BoxGeometry(0.003, 0.003, 0.016), new MeshStandardMaterial({ color: "#f3dc98", roughness: 0.5 }), N);
    ralada.visible = false; ralada.frustumCulled = false;
    const sem: number[][] = [];
    let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) sem.push([rnd(), rnd(), rnd(), rnd(), rnd()]);
    const brilho = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: gradiente([[0, "rgba(255,210,140,1)"], [0.35, "rgba(255,140,40,0.55)"], [1, "rgba(255,90,20,0)"]]), transparent: true, depthWrite: false, blending: AdditiveBlending }));
    brilho.rotation.x = -Math.PI / 2; brilho.scale.setScalar(0.11); brilho.visible = false; brilho.renderOrder = 3;
    const luz = new PointLight("#ff8a33", 0, 0.5, 1.6);
    const luzMesa = new PointLight("#ffb070", 0, 0.6, 2);
    return { fio, quedas, ralada, sem, N, brilho, luz, luzMesa };
  }, [E]);

  // ------------------------------------------------ estado da animação (tudo em refs: nada re-renderiza por quadro)
  const at = useRef<Ativo | null>(null);
  const feitos = useRef(new Set<Passo>());
  const molas = useRef<Partial<Record<EstacaoId, Mola>>>({});
  const pops = useRef<Partial<Record<EstacaoId, number>>>({});
  const ativoRef = useRef(ativo); ativoRef.current = ativo;
  const opts = useRef({ reduzido, congelar }); opts.current = { reduzido, congelar };
  const fim = useRef(aoFim); fim.current = aoFim;
  const lean = useRef({ p: new Vector3(), v: new Vector3(), ok: false });
  const press = useRef(1);

  const aplicarFinal = (id: Passo) => {
    if (id === "pasta") { L.pasta.visible = true; L.clip.pasta.constant = 1; }
    if (id === "creme") { L.creme.visible = true; L.clip.creme.constant = 1; }
    if (id === "costela") L.partes.forEach((p) => { p.visible = true; p.scale.set(1, 1, 1); });
    if (id === "tampa") L.tampa.rotation.x = 0;
    if (id === "mussarela") { L.mussPiv.visible = true; L.mussPiv.scale.set(1, 1, 1); L.clip.muss.constant = 1; }
    if (id === "macarico") { L.gratinado.visible = true; L.clip.grat.constant = 1; }
  };
  const zerar = () => {
    L.pasta.visible = false; L.creme.visible = false; L.mussPiv.visible = false; L.gratinado.visible = false;
    L.partes.forEach((p) => { p.visible = false; p.scale.set(1, 0.001, 1); });
    L.tampa.rotation.x = OPEN;
    Object.values(L.clip).forEach((c) => { c.constant = -1; });
    L.lanche.scale.set(1, 1, 1);
    H.raiz.visible = false;
    FX.fio.visible = false; FX.quedas.forEach((q) => { q.visible = false; }); FX.ralada.visible = false; FX.brilho.visible = false; FX.luz.intensity = 0;
    feitos.current.clear();
  };

  // pose da mão num instante (sem a inclinação por velocidade)
  const tmpP = useMemo(() => ({ ponto: new Vector3(), q: new Quaternion(), e: new Euler(), qt: new Quaternion(), dirW: new Vector3(), pos: new Vector3() }), []);
  const poseMao = (id: Passo, t: number, amp: number, outPos: Vector3, outQ: Quaternion) => {
    const ac = ACOES[id];
    const rot = ac.mao(t, M, amp, tmpP.ponto);
    tmpP.qt.setFromEuler(tmpP.e.set(rot[0], rot[1], rot[2], "XYZ"));
    outQ.copy(tmpP.qt).multiply(qBase(ac.pose));
    if (id === "macarico") {
      // ponto = alvo da chama: a ponta fica atrás dele, na direção da chama
      tmpP.dirW.copy(CHAMA_DIR).applyQuaternion(outQ);
      tmpP.ponto.addScaledVector(tmpP.dirW, -MACA.alcance);
    }
    outPos.copy(tmpP.ponto).sub(new Vector3(...POSES[ac.pose].ponto).applyQuaternion(outQ));
  };

  /** Pose da raiz da mão durante a pegada (tempo real t < g.leva). */
  const pgTmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), c: new Vector3() }), []);
  const posePegada = (a: Ativo, g: Pegada, t: number, outPos: Vector3, outQ: Quaternion) => {
    const sobre = pgTmp.a.copy(a.pG); sobre.y += g.sobre;
    if (t < g.chega) {
      // entra de fora desacelerando (ease-out), em arco, e chega por cima da ferramenta
      const k = t / g.chega, e = eOut3(k);
      const c1 = pgTmp.b.lerpVectors(a.pS, sobre, 0.45); c1.y += 0.1;
      const c2 = pgTmp.c.copy(sobre); c2.y += 0.08;
      cubica(outPos, a.pS, c1, c2, sobre, e);
      outQ.slerpQuaternions(a.qS, a.qG, e);
    } else if (t < g.fecha) {
      // assenta na ferramenta (ou desce no pote) e fica parada um instante: aí fecha
      outPos.lerpVectors(sobre, a.pG, eIOs(seg(t, g.chega, g.assenta)));
      outQ.copy(a.qG);
    } else {
      // levanta e leva até o começo do trabalho, girando para a orientação de uso (ease in-out)
      const k = seg(t, g.fecha, g.leva);
      const c1 = pgTmp.b.copy(a.pG); c1.y += g.ergue;
      const c2 = pgTmp.c.copy(a.pW); c2.y += 0.06;
      cubica(outPos, a.pG, c1, c2, a.pW, eIO3(k));
      outQ.slerpQuaternions(a.qG, a.qW, eIOs(seg(k, 0.06, 0.94)));
    }
  };
  /** Pose da raiz da mão no instante real t (sem a inclinação por velocidade). */
  const poseAcao = (a: Ativo, t: number, outPos: Vector3, outQ: Quaternion) => {
    if (a.g && t < a.g.leva) posePegada(a, a.g, t, outPos, outQ);
    else poseMao(a.id, tempoTrabalho(ACOES[a.id], t), a.amp, outPos, outQ);
  };
  /** Peso da inclinação por velocidade: zero em volta da pegada, para a troca da ferramenta ser exata. */
  const pesoLean = (a: Ativo, t: number) => (a.g ? Math.max(1 - seg(t, a.g.chega - 0.16, a.g.chega - 0.02), seg(t, a.g.fecha + 0.04, a.g.fecha + 0.24)) : 1);

  useEffect(() => {
    zerar();
    api.current = {
      acao(id, modo) {
        if (at.current) return;
        const red = opts.current.reduzido;
        const ac = ACOES[id];
        const amp = red ? 0 : 1;
        const D = duracao(ac);
        // auto: ~1,25x a velocidade normal; movimento reduzido: curtas e sem quique
        const vel = red ? D / 0.8 : modo === "auto" ? 1.25 : 1;
        const g = pegadaDe(ac);
        const a: Ativo = {
          id, t: 0, D, modo, vel, amp, g,
          p0: new Vector3(), q0: new Quaternion(), pR: new Vector3(), qR: new Quaternion(), pS: new Vector3(), qS: new Quaternion(),
          pG: new Vector3(), qG: new Quaternion(), pW: new Vector3(), qW: new Quaternion(),
        };
        if (g && id !== "tampa") {
          const st = E.lista[id as EstacaoId];
          const f = st.ferramenta!, fer = H.fer[id]!;
          a.p0.copy(f.position); a.q0.copy(f.quaternion);
          // solta no ar sobre o lanche: assenta na tábua ao lado do pão; senão volta/fica na casa
          if (modo === "arraste") a.pR.copy(NA_TABUA).add(st.apoio); else a.pR.copy(st.casa.p);
          a.qR.copy(st.casa.q);
          // raiz da mão na pegada: a cópia na mão coincide com a ferramenta parada
          a.qG.copy(a.qR).multiply(fer.quaternion.clone().invert());
          a.pG.copy(a.pR).sub(fer.position.clone().applyQuaternion(a.qG));
          poseMao(id, ac.ini!, amp, a.pW, a.qW);
          a.pS.set(Math.max(a.pG.x, 0.07) + M.fora.x, a.pG.y + g.sobre + M.fora.y, a.pG.z + M.fora.z);
          a.qS.setFromAxisAngle(new Vector3(0, 0, 1), -0.12).multiply(a.qG);
          delete molas.current[id as EstacaoId];
        }
        if (id === "pasta") { L.pasta.visible = true; L.clip.pasta.constant = -1; }
        if (id === "creme") { L.creme.visible = true; L.clip.creme.constant = -1; }
        lean.current.ok = false;
        at.current = a;
        Object.values(H.poses).forEach((o) => { o.visible = false; });
        H.poses[ac.pose].visible = true;
        Object.values(H.fer).forEach((f) => { if (f) f.visible = false; });
        H.raiz.visible = true;
      },
      soltar(id) {
        // soltou fora do lanche: volta para a casa com mola
        const m = molas.current[id];
        if (m) { m.solta = true; m.alvo.copy(E.lista[id].casa.p); m.k = 170; m.c = 11; }
      },
      reiniciar() {
        at.current = null;
        zerar();
        (Object.keys(E.lista) as EstacaoId[]).forEach((id) => {
          const st = E.lista[id]; const f = st.ferramenta;
          if (f) { f.position.copy(st.casa.p); f.quaternion.copy(st.casa.q); f.scale.setScalar(1); f.visible = true; }
        });
        molas.current = {};
      },
      interromper() { /* a ação atual termina sozinha; quem encadeia é o HUD */ },
    };
    return () => { api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, E, H, FX]);

  useEffect(() => { aoPronto(); }, [aoPronto]);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    (window as unknown as { __cena: unknown }).__cena = { L, E, H, M, FX };
  }, [L, E, H, M, FX]);

  // ------------------------------------------------ quadro a quadro
  const ray = useMemo(() => ({ r: new Raycaster(), ndc: new Vector2(), plano: new Plane(new Vector3(0, 1, 0), -0.14), hit: new Vector3() }), []);
  const ultimaProj = useRef("");
  const relogio = useRef(0);
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), q: new Quaternion(), e: new Euler(), m: new Matrix4(), s: new Vector3(1, 1, 1), qq: new Quaternion() }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    relogio.current += dt;
    const T = relogio.current;
    const red = opts.current.reduzido;

    // estações: brilho da ativa, as outras apagadas
    const atv = ativoRef.current;
    (Object.keys(E.lista) as EstacaoId[]).forEach((id) => {
      const st = E.lista[id];
      const alvo = atv === id ? 1 : 0;
      st.brilho += (alvo - st.brilho) * Math.min(1, dt * 6);
      const pul = red ? 0.8 : 0.72 + 0.28 * Math.sin(T * 3.4);
      (st.anel.material as MeshBasicMaterial).opacity = st.brilho * pul * 0.95;
      st.anel.scale.setScalar(st.raio * 3.1 * (1 + (red ? 0 : 0.05 * Math.sin(T * 3.4))));
      // a estação da ação em andamento fica com a cor normal: a ferramenta parada tem de bater com a cópia na mão
      // (o brilho emissivo some sozinho em ~0,5 s, antes da pegada)
      const emAcao = at.current?.id === id;
      st.luz += ((alvo || emAcao ? 1 : 0) - st.luz) * Math.min(1, dt * 6);
      const f = emAcao ? 1 : 0.16 + 0.84 * st.luz;
      const em = st.brilho * (red ? 0.6 : 0.5 + 0.5 * Math.sin(T * 3.4));
      st.mats.forEach(({ m, cor }) => { m.color.copy(cor).multiplyScalar(f); m.emissive.setRGB(0.09, 0.045, 0.012).multiplyScalar(em); });
    });

    {
      const g = L.partes.reduce((s, p) => s + (p.visible ? Math.min(1, p.scale.y) : 0), 0) / 3;
      L.creme.position.y = -L.cremeDy * (1 - g);
      const bp = E.brilhoPao;
      bp.v += ((atv === "tampa" && !at.current ? 1 : 0) - bp.v) * Math.min(1, dt * 6);
      (E.anelPao.material as MeshBasicMaterial).opacity = bp.v * (red ? 0.8 : 0.72 + 0.28 * Math.sin(T * 3.4));
    }
    // arraste: a ferramenta segue o dedo num plano acima da bancada
    const d = bus.current.drag;
    if (d.ativo && d.id && !at.current) {
      const st = E.lista[d.id];
      let m = molas.current[d.id];
      if (!m) { m = { p: st.ferramenta!.position.clone(), v: new Vector3(), alvo: new Vector3(), k: 320, c: 26, solta: false }; molas.current[d.id] = m; }
      m.solta = false; m.k = 320; m.c = 26;
      const r = gl.domElement.getBoundingClientRect();
      ray.ndc.set(((d.x - r.left) / r.width) * 2 - 1, -((d.y - r.top) / r.height) * 2 + 1);
      ray.r.setFromCamera(ray.ndc, camera);
      ray.plano.constant = -(MESA + 0.1 + st.alto * 0.25);
      if (ray.r.ray.intersectPlane(ray.plano, ray.hit)) m.alvo.copy(ray.hit).sub(tmp.a.set(0, st.alto * 0.25, 0));
    }
    (Object.keys(molas.current) as EstacaoId[]).forEach((id) => {
      const m = molas.current[id]!;
      const st = E.lista[id]; const f = st.ferramenta!;
      const n = 3, h = dt / n;
      for (let i = 0; i < n; i++) {
        tmp.a.copy(m.alvo).sub(m.p).multiplyScalar(m.k).addScaledVector(m.v, -m.c);
        m.v.addScaledVector(tmp.a, h); m.p.addScaledVector(m.v, h);
      }
      f.position.copy(m.p);
      const ix = MathUtils.clamp(m.v.z * 0.9, -0.45, 0.45), iz = MathUtils.clamp(-m.v.x * 0.9, -0.45, 0.45);
      tmp.qq.setFromEuler(tmp.e.set(ix, 0, iz));
      f.quaternion.copy(tmp.qq).multiply(st.casa.q);
      if (m.solta && m.p.distanceTo(m.alvo) < 0.0008 && m.v.length() < 0.01) { f.position.copy(st.casa.p); f.quaternion.copy(st.casa.q); delete molas.current[id]; }
    });

    // ferramentas que voltam para a estação depois da ação: aparecem com mola
    (Object.keys(pops.current) as EstacaoId[]).forEach((id) => {
      const st = E.lista[id]; const f = st.ferramenta!;
      pops.current[id]! += dt;
      const k = pops.current[id]! / 0.5;
      f.visible = true; f.position.copy(st.casa.p); f.quaternion.copy(st.casa.q);
      f.scale.setScalar(Math.max(0.001, red ? c01(k) : mola(k, 0.8)));
      if (k >= 1) { f.scale.setScalar(1); delete pops.current[id]; }
    });

    // ação em andamento
    const a = at.current;
    if (a) {
      const cg = opts.current.congelar;
      if (cg && cg.id === a.id) a.t = cg.t; else a.t += dt * a.vel;
      const t = a.t;
      const ac = ACOES[a.id];
      const amp = a.amp;
      // mão
      const pos = tmp.b, q = tmp.q;
      poseAcao(a, t, pos, q);
      const tv = tempoTrabalho(ac, t);
      const ln = lean.current;
      if (!ln.ok) { ln.p.copy(pos); ln.v.set(0, 0, 0); ln.ok = true; }
      const vel = tmp.a.copy(pos).sub(ln.p).multiplyScalar(1 / Math.max(dt, 1e-3));
      ln.v.lerp(vel, Math.min(1, dt * 10)); ln.p.copy(pos);
      const wl = pesoLean(a, t);
      if (!red && !(cg && cg.id === a.id) && wl > 0) {
        tmp.qq.setFromEuler(tmp.e.set(wl * MathUtils.clamp(ln.v.z * 0.35, -0.25, 0.25), 0, wl * MathUtils.clamp(-ln.v.x * 0.3, -0.25, 0.25)));
        // gira em torno do ponto útil: mantém o bico/concha no lugar e inclina o punho
        const pu = new Vector3(...POSES[ac.pose].ponto).applyQuaternion(q).add(pos);
        q.premultiply(tmp.qq);
        pos.copy(pu).sub(new Vector3(...POSES[ac.pose].ponto).applyQuaternion(q));
      }
      H.raiz.position.copy(pos); H.raiz.quaternion.copy(q);
      // ferramenta: parada (assentando suave se estava no ar) até a mão fechar; aí troca pela cópia na mão,
      // que nesse instante está exatamente na mesma pose no mundo
      const fer = H.fer[a.id];
      if (a.g && a.id !== "tampa") {
        const st = E.lista[a.id as EstacaoId]; const f = st.ferramenta!;
        if (t < a.g.fecha) {
          const k = eIO3(seg(t, 0, a.g.chega - 0.08));
          f.visible = true; f.scale.setScalar(1);
          f.position.lerpVectors(a.p0, a.pR, k);
          f.quaternion.slerpQuaternions(a.q0, a.qR, k);
          if (fer) fer.visible = false;
        } else {
          f.visible = false;
          if (fer) fer.visible = true;
        }
      }
      efeitos(a.id, tv, amp, red);
      if (t >= a.D) {
        at.current = null;
        H.raiz.visible = false;
        Object.values(H.fer).forEach((f) => { if (f) { f.visible = false; f.scale.setScalar(1); } });
        FX.fio.visible = false; FX.brilho.visible = false; FX.luz.intensity = 0; FX.ralada.visible = false; FX.quedas.forEach((q2) => { q2.visible = false; });
        if (H.chama) H.chama.visible = false;
        L.lanche.scale.set(1, 1, 1);
        aplicarFinal(a.id);
        feitos.current.add(a.id);
        if (a.id !== "tampa") pops.current[a.id as EstacaoId] = 0;
        fim.current(a.id);
      }
    }

    // tempo da ação atual, para o QA tirar prints no meio de cada ação
    (window as unknown as { __protoT: number }).__protoT = at.current ? at.current.t : -1;
    // projeção das estações e do lanche para o HUD (só quando muda)
    const proj = (x: number, y: number, z: number) => { tmp.a.set(x, y, z).project(camera); return [(tmp.a.x + 1) / 2 * size.width, (1 - tmp.a.y) / 2 * size.height]; };
    const est = {} as Record<EstacaoId, Ponto>;
    (Object.keys(E.lista) as EstacaoId[]).forEach((id) => {
      const st = E.lista[id]; const p = st.raiz.position;
      const [cx, cy] = proj(p.x, MESA + st.alto * 0.45, p.z);
      const [ex] = proj(p.x + st.raio, MESA + st.alto * 0.45, p.z);
      est[id] = { x: Math.round(cx), y: Math.round(cy), r: Math.round(Math.max(30, Math.abs(ex - cx) * 1.25)) };
    });
    const xs: number[] = [], ys: number[] = [];
    for (const x of [-0.16, 0.16]) for (const y of [0, 0.11]) for (const z of [-0.07, 0.07]) { const [px, py] = proj(x, y, z); xs.push(px); ys.push(py); }
    const lan = { x0: Math.round(Math.min(...xs)), y0: Math.round(Math.min(...ys)), x1: Math.round(Math.max(...xs)), y1: Math.round(Math.max(...ys)) };
    const chave = JSON.stringify([est, lan, arranjo]);
    if (chave !== ultimaProj.current) { ultimaProj.current = chave; aoProjetar({ estacoes: est, lanche: lan, arranjo }); }
  });

  // ------------------------------------------------ efeitos de cada ação
  const fxTmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), q: new Quaternion(), m: new Matrix4(), s: new Vector3(), e: new Euler() }), []);
  function efeitos(id: Passo, t: number, amp: number, red: boolean) {
    const ac = ACOES[id];
    if (id === "pasta") {
      const [a, b] = PASTA.varre;
      const u = seg(t, a, b);
      const bico = pastaBico(u, M, fxTmp.a);
      L.clip.pasta.constant = t < a ? -1 : t < b ? bico.x - 0.003 : 1;
      // fio saindo do bico
      const on = t > a - 0.02 && t < b + 0.03;
      FX.fio.visible = on;
      if (on) {
        // ponta real do bico (a mão pode estar inclinada)
        const tip = fxTmp.b.set(...POSES.mao_bisnaga.ponto).applyQuaternion(H.raiz.quaternion).add(H.raiz.position);
        const chao = M.pasta - 0.004;
        const alvo = fxTmp.a.set(tip.x - lean.current.v.x * 0.025, chao, tip.z - lean.current.v.z * 0.025);
        const dir = alvo.clone().sub(tip);
        FX.fio.position.copy(tip);
        FX.fio.quaternion.setFromUnitVectors(fxTmp.s.set(0, -1, 0), dir.clone().normalize());
        const fino = t > b ? 1 - seg(t, b, b + 0.03) : seg(t, a - 0.02, a + 0.04);
        FX.fio.scale.set(fino, dir.length(), fino);
      }
      // bisnaga apertada: encolhe um pouco
      const sq = seg(t, a - 0.08, a + 0.02) * (1 - seg(t, b, b + 0.12));
      const wob = red ? 0 : 0.015 * Math.sin(t * 40) * sq;
      H.fer.pasta!.scale.set(1 - 0.09 * sq + wob, 1 + 0.03 * sq, 1 - 0.09 * sq - wob);
    } else if (id === "creme") {
      const [a, b] = CREME.varre;
      const u = seg(t, a, b);
      let mx = -1;
      if (t >= a) for (let i = 0; i <= 24; i++) { const ui = (u * i) / 24; mx = Math.max(mx, cremeConcha(ui, M, fxTmp.a).x); }
      L.clip.creme.constant = t < a ? -1 : t < b ? mx + 0.012 : 1;
    } else if (id === "costela") {
      const { xs, solta, queda } = COSTELA;
      solta.forEach((s, i) => {
        const q = FX.quedas[i];
        const parte = L.partes[i];
        const x = xs[i], topo = M.costela - 0.012;
        if (t < s) { q.visible = false; parte.visible = false; parte.scale.set(1, 0.001, 1); return; }
        const tq = t - s;
        // cai, achata e some dentro da camada que cresce
        const y0 = M.costela + 0.085;
        if (tq < queda) {
          const k = tq / queda;
          q.visible = true;
          q.position.set(x, lerp(y0 - 0.006, topo, k * k), 0.004 * (i - 1));
          const st = red ? 0 : 0.35 * k * k;
          q.scale.set(1 - st * 0.4, 1 + st, 1 - st * 0.4);
        } else {
          const k = seg(tq, queda, queda + 0.16);
          q.visible = k < 1;
          const sq = red ? 0 : 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.4));
          q.position.set(x, topo - 0.01 * k, 0.004 * (i - 1));
          q.scale.set((1 + sq) * (1 - k * 0.8), (1 - sq) * (1 - k * 0.9), (1 + sq) * (1 - k * 0.8));
        }
        // camada: cresce com mola (squash and stretch)
        const g = seg(tq, queda * 0.6, queda + 0.42);
        parte.visible = g > 0;
        const y = Math.max(0.001, amp ? mola(g, 1) : eOut3(g));
        const lat = red ? 1 : 1 + 0.12 * (1 - y) * (g > 0 ? 1 : 0);
        parte.scale.set(lat, y, lat);
      });
      // o punhado na mão diminui a cada soltura
      const saiu = solta.reduce((s, si) => s + seg(t, si, si + 0.08), 0);
      H.fer.costela!.scale.setScalar(Math.max(0.001, 1 - saiu / 3));
    } else if (id === "tampa") {
      L.tampa.rotation.x = anguloTampa(t, amp);
      const [a, b] = TAMPA.aperta;
      const p = pulso(t, a, b) * (amp ? 1 : 0.4);
      L.lanche.scale.set(1 + 0.02 * p, 1 - 0.055 * p, 1 + 0.02 * p);
      if (t > b) { const k = seg(t, b, b + 0.4); const e = amp ? 1 + 0.03 * Math.sin(Math.PI * k * 2) * (1 - k) : 1; L.lanche.scale.set(1, e, 1); }
    } else if (id === "mussarela") {
      const [a, b] = MUSS.varre;
      L.mussPiv.visible = t > a + 0.12;
      const u = seg(t, a, b);
      const hx = lerp(MUSS.x0, MUSS.x1, u);
      L.clip.muss.constant = t < a + 0.1 ? -1 : t < b + 0.2 ? hx - 0.01 + seg(t, b, b + 0.2) * 0.4 : 1;
      // derrete: começa alta e "escorre" até assentar
      const k = seg(t, a + 0.1, ac.D - 0.05);
      const y = amp ? 1 + 0.6 * (1 - mola(k, 0.9)) : 1 + 0.6 * (1 - eOut3(k));
      L.mussPiv.scale.set(1 - 0.04 * (y - 1), y, 1 - 0.04 * (y - 1));
      // fiapos caindo
      FX.ralada.visible = t > a && t < b + 0.45;
      const solta = new Vector3(...POSES.mao_punhado.ponto).applyQuaternion(H.raiz.quaternion).add(H.raiz.position);
      for (let i = 0; i < FX.N; i++) {
        const [r0, r1, r2, r3, r4] = FX.sem[i];
        const nasce = a + (b - a) * r0;
        const vida = t - nasce;
        const fall = 0.2;
        let esc = 0;
        const p = fxTmp.a;
        if (vida > 0) {
          const xi = lerp(MUSS.x0, MUSS.x1, r0) + (r1 - 0.5) * 0.03;
          const zi = (r2 - 0.5) * 0.06;
          const yi = M.muss + 0.06;
          const k = c01(vida / fall);
          p.set(xi, lerp(yi, M.muss - 0.002, k * k), zi);
          if (vida < 0.02) p.lerp(solta, 1 - vida / 0.02);
          esc = vida < fall ? 1 : 1 - c01((vida - fall) / 0.25);
        }
        fxTmp.q.setFromEuler(fxTmp.e.set(r3 * 3, r4 * 3, (r3 + r4) * 2));
        fxTmp.m.compose(p, fxTmp.q, fxTmp.s.setScalar(Math.max(0.0001, esc)));
        FX.ralada.setMatrixAt(i, fxTmp.m);
      }
      FX.ralada.instanceMatrix.needsUpdate = true;
      const fm = H.fer.mussarela!;
      fm.scale.setScalar(Math.max(0.001, 1 - 0.85 * u));
    } else if (id === "macarico") {
      const [a, b] = MACA.varre;
      const on = t > a - 0.06 && t < b + 0.02;
      H.chama.visible = on;
      const tip = fxTmp.a.set(...POSES.mao_macarico.ponto).applyQuaternion(H.raiz.quaternion).add(H.raiz.position);
      const dir = fxTmp.b.copy(CHAMA_DIR).applyQuaternion(H.raiz.quaternion);
      const hit = tip.clone().addScaledVector(dir, MACA.alcance);
      if (on && !red) H.chama.scale.setScalar(0.94 + 0.12 * Math.abs(Math.sin(t * 37) * Math.cos(t * 23)));
      L.gratinado.visible = t >= a;
      L.clip.grat.constant = t < a ? -1 : t < b ? hit.x - 0.006 : 1;
      const brilhoK = on ? 1 : t >= b ? 1 - seg(t, b, b + 0.35) : 0;
      FX.brilho.visible = brilhoK > 0;
      FX.brilho.position.set(hit.x, M.muss + 0.004, hit.z);
      (FX.brilho.material as MeshBasicMaterial).opacity = brilhoK * (0.75 + (red ? 0 : 0.25 * Math.sin(t * 31)));
      FX.brilho.scale.setScalar(0.1 + 0.015 * Math.sin(t * 17));
      FX.luz.position.set(hit.x, M.muss + 0.03, hit.z + 0.01);
      FX.luz.intensity = brilhoK * (0.9 + (red ? 0 : 0.3 * Math.sin(t * 29)));
    }
  }

  return <>
    <primitive object={L.raiz} />
    <group ref={mundoEst}>
      {(Object.keys(E.lista) as EstacaoId[]).map((id) => <primitive key={id} object={E.lista[id].raiz} />)}
      {(Object.keys(E.lista) as EstacaoId[]).map((id) => <primitive key={`a-${id}`} object={E.lista[id].anel} />)}
    </group>
    <primitive object={E.anelPao} />
    <primitive object={H.raiz} />
    <primitive object={FX.fio} />
    {FX.quedas.map((q, i) => <primitive key={i} object={q} />)}
    <primitive object={FX.ralada} />
    <primitive object={FX.brilho} />
    <primitive object={FX.luz} />
  </>;
}

// ---------------------------------------------------------------- canvas
export default function Cena(props: Props) {
  const camera = useMemo(() => ({ position: [0, 1, 0.7] as [number, number, number], fov: 46, near: 0.05, far: 6 }), []);
  return <Canvas className="!absolute inset-0" dpr={[1, 1.5]} camera={camera} shadows gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    style={{ touchAction: "none" }} onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}>
    <Interno {...props} />
  </Canvas>;
}

function Interno(props: Props) {
  const { size } = useThree();
  const arranjo = arranjoDe(size.width, size.height);
  const M = useMemo<Medidas>(() => ({ pasta: 0.05, costela: 0.08, creme: 0.085, muss: 0.1, fora: new Vector3(0.7, 0.24, 0.1) }), []);
  return <>
    <Camara arranjo={arranjo} M={M} />
    <hemisphereLight args={["#ffe6c8", "#1a0f0a", 0.55]} />
    <ambientLight intensity={0.25} color="#ffe2c0" />
    <directionalLight position={[0.15, 1.1, 0.35]} intensity={2.6} color="#ffd9a8" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.01}
      shadow-camera-left={-0.6} shadow-camera-right={0.6} shadow-camera-top={0.6} shadow-camera-bottom={-0.6} shadow-camera-near={0.2} shadow-camera-far={2.2} />
    <directionalLight position={[-0.6, 0.5, 0.8]} intensity={0.7} color="#fff1dc" />
    <pointLight position={[0.55, 0.3, -0.45]} intensity={1.6} distance={2} decay={1.5} color="#ff9a4a" />
    <Suspense fallback={null}>
      <Mundo {...props} arranjo={arranjo} M={M} />
    </Suspense>
    <ContactShadows position={[0, MESA + 0.0008, 0]} scale={2.4} far={0.35} blur={2.2} opacity={0.75} resolution={512} color="#000000" frames={Infinity} />
  </>;
}

