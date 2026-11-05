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
  ACOES, COSTELA, CREME, DOBRA, MACA, MUSS, OPEN, PASTA, TAMPA, anguloTampa, c01, cremeConcha, eBack, eIO3, eOut3, lerp, mola, pastaBico, pulso, seg,
  type Medidas, type Pose,
} from "./acoes";
import { CAMERAS, ESTACOES, MESA, arranjoDe, fovPara, type Arranjo, type EstacaoId, type Passo } from "./layout";

const ROOT = "/assets/models/bancada/";
const glb = (n: string) => `${ROOT}${n}.glb`;
const NOMES = ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico-mao", "mao-luva", "bisnaga", "pote-creme"] as const;
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
type Estacao = { id: EstacaoId; raiz: Group; ferramenta: Object3D | null; casa: { p: Vector3; q: Quaternion }; raio: number; alto: number; mats: { m: MeshStandardMaterial; cor: Color }[]; anel: Mesh; brilho: number };
type Ativo = { id: Passo; t: number; modo: Modo; p0: Vector3; q0: Quaternion; encP: Vector3; encQ: Quaternion; vel: number; amp: number };
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
      return { id, raiz, ferramenta, casa: { p: new Vector3(), q: new Quaternion() }, raio, alto, mats: ms, anel, brilho: 0 };
    };
    // bisnaga em pé
    const bis = new Group(); const bisnaga = clonar(A.bisnaga);
    // pote de creme com a colher
    const pc = new Group(); const pote = clonar(A["pote-creme"]);
    const colher = pote.getObjectByName("colher")!;
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
    // maçarico em pé num suporte
    const ptm = new Group();
    const sup = new Mesh(new LatheGeometry([[0, 0], [0.045, 0], [0.045, 0.007], [0.026, 0.011], [0.023, 0.05], [0.019, 0.05], [0, 0.02]].map(([x, y]) => new Vector2(x, y)), 32),
      new MeshStandardMaterial({ color: "#2a2624", roughness: 0.3, metalness: 0.85 }));
    sup.castShadow = true; ptm.add(sup);
    const maca = clonar(A["macarico-mao"]);
    const chamaSt = maca.getObjectByName("chama"); if (chamaSt) chamaSt.visible = false;
    maca.rotation.set(0, 0.5, MathUtils.degToRad(-120));

    const lista = {
      pasta: fazer("pasta", bis, bisnaga, 0.04, 0.19),
      creme: fazer("creme", pc, colher, 0.066, 0.08),
      costela: fazer("costela", pk, fCost, 0.075, 0.07),
      mussarela: fazer("mussarela", pm, fMuss, 0.072, 0.06),
      macarico: fazer("macarico", ptm, maca, 0.05, 0.17),
    } as Record<EstacaoId, Estacao>;
    // anel em volta do pão quando a vez é da tampa
    const anelPao = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: anelTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
    anelPao.rotation.x = -Math.PI / 2; anelPao.position.set(0, 0.0015, 0); anelPao.scale.set(0.5, 0.26, 1); anelPao.renderOrder = 2;
    return { lista, bisnaga, pote, colher, fCost, fMuss, maca, anelPao, brilhoPao: { v: 0 } };
  }, [A]);

  // Posiciona as estações conforme o arranjo e guarda a "casa" de cada ferramenta (pose no mundo).
  const mundoEst = useRef<Group>(null);
  useLayoutEffect(() => {
    const pos = ESTACOES[arranjo];
    const { lista, bisnaga, pote, colher, fCost, fMuss, maca } = E;
    (Object.keys(lista) as EstacaoId[]).forEach((id) => {
      const st = lista[id];
      const [x, z] = pos[id];
      st.raiz.position.set(x, MESA, z);
      st.anel.position.set(x, MESA + 0.0015, z);
    });
    bisnaga.position.set(0, 0, 0); bisnaga.rotation.set(0, -0.3, 0);
    lista.pasta.raiz.add(bisnaga);
    pote.rotation.y = -0.7;
    lista.creme.raiz.add(pote);
    fCost.position.set(0, 0.075, 0); lista.costela.raiz.add(fCost);
    fMuss.position.set(0, 0.052, 0); lista.mussarela.raiz.add(fMuss);
    lista.macarico.raiz.add(maca); maca.position.set(0, 0, 0);
    lista.macarico.raiz.updateMatrixWorld(true);
    const b = caixa(maca); const r = lista.macarico.raiz.position;
    maca.position.set(r.x - (b.min.x + b.max.x) / 2, r.y + 0.012 - b.min.y, r.z - (b.min.z + b.max.z) / 2);
    // casa = pose no mundo; a ferramenta passa a viver solta no grupo do mundo
    const w = mundoEst.current;
    (Object.keys(lista) as EstacaoId[]).forEach((id) => {
      const st = lista[id];
      if (!st.ferramenta) return;
      if (st.ferramenta.parent !== w) { st.raiz.updateMatrixWorld(true); w?.attach(st.ferramenta); }
      st.casa.p.copy(st.ferramenta.position); st.casa.q.copy(st.ferramenta.quaternion);
    });
    void colher;
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

  const pegarCasa = (id: EstacaoId) => {
    const st = E.lista[id];
    const f = st.ferramenta!;
    return { p: f.position.clone(), q: f.quaternion.clone() };
  };

  useEffect(() => {
    zerar();
    api.current = {
      acao(id, modo) {
        if (at.current) return;
        const red = opts.current.reduzido;
        const rap = modo === "auto";
        const ac = ACOES[id];
        const amp = red ? 0 : 1;
        const vel = rap ? ac.D / 0.62 : red ? ac.D / 0.7 : 1;
        const encP = new Vector3(), encQ = new Quaternion();
        let p0 = new Vector3(), q0 = new Quaternion();
        if (ac.pega !== null && id !== "tampa") {
          const st = E.lista[id as EstacaoId];
          const pm = new Vector3(), qm = new Quaternion();
          poseMao(id, ac.pega, amp, pm, qm);
          const f = H.fer[id]!;
          encP.copy(f.position).applyQuaternion(qm).add(pm);
          encQ.copy(qm).multiply(f.quaternion);
          const atual = pegarCasa(id as EstacaoId);
          p0 = atual.p; q0 = atual.q;
          delete molas.current[id as EstacaoId];
          void st;
        }
        if (id === "pasta") { L.pasta.visible = true; L.clip.pasta.constant = -1; }
        if (id === "creme") { L.creme.visible = true; L.clip.creme.constant = -1; }
        lean.current.ok = false;
        at.current = { id, t: 0, modo, p0, q0, encP, encQ, vel, amp };
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
      const f = 0.16 + 0.84 * st.brilho;
      st.mats.forEach(({ m, cor }) => { m.color.copy(cor).multiplyScalar(f); m.emissive.setRGB(0.09, 0.045, 0.012).multiplyScalar(st.brilho * (red ? 0.6 : 0.5 + 0.5 * Math.sin(T * 3.4))); });
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
      poseMao(a.id, t, amp, pos, q);
      const ln = lean.current;
      if (!ln.ok) { ln.p.copy(pos); ln.v.set(0, 0, 0); ln.ok = true; }
      const vel = tmp.a.copy(pos).sub(ln.p).multiplyScalar(1 / Math.max(dt, 1e-3));
      ln.v.lerp(vel, Math.min(1, dt * 10)); ln.p.copy(pos);
      if (!red && !(cg && cg.id === a.id)) {
        tmp.qq.setFromEuler(tmp.e.set(MathUtils.clamp(ln.v.z * 0.35, -0.25, 0.25), 0, MathUtils.clamp(-ln.v.x * 0.3, -0.25, 0.25)));
        // gira em torno do ponto útil: mantém o bico/concha no lugar e inclina o punho
        const pu = new Vector3(...POSES[ac.pose].ponto).applyQuaternion(q).add(pos);
        q.premultiply(tmp.qq);
        pos.copy(pu).sub(new Vector3(...POSES[ac.pose].ponto).applyQuaternion(q));
      }
      H.raiz.position.copy(pos); H.raiz.quaternion.copy(q);
      // ferramenta: solta/encaixando até a mão pegar
      const fer = H.fer[a.id];
      if (ac.pega !== null && a.id !== "tampa") {
        const st = E.lista[a.id as EstacaoId]; const f = st.ferramenta!;
        if (t < ac.pega) {
          const tEnc = Math.min(0.4, ac.pega - 0.05);
          const k = seg(t, 0, tEnc);
          const ek = amp ? eBack(k, 0.7) : eIO3(k);
          f.visible = true; f.scale.setScalar(1);
          f.position.lerpVectors(a.p0, a.encP, ek);
          if (a.modo !== "arraste") f.position.y += (amp ? 0.09 : 0.03) * Math.sin(Math.PI * k);
          f.quaternion.slerpQuaternions(a.q0, a.encQ, eOut3(k));
          if (fer) fer.visible = false;
        } else {
          f.visible = false;
          if (fer) fer.visible = true;
        }
      }
      efeitos(a.id, t, amp, red);
      if (t >= ac.D) {
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

