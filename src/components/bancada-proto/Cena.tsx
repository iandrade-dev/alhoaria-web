"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF, useProgress } from "@react-three/drei";
import {
  AdditiveBlending, CylinderGeometry, Euler, Group, Material, MathUtils, Matrix4, Mesh, MeshBasicMaterial, Object3D,
  Plane, PlaneGeometry, PMREMGenerator, Quaternion, Raycaster, SpotLight, Vector2, Vector3,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CHAMA_DIR, POSES, anelTextura, qBase, type Kit, type Volta } from "./kit";
import { c01, duracao, eIO3, eIOs, eOut3, mola, pegadaDe, seg, tempoTrabalho, type Medidas, type Pegada } from "./acoes";
import { kitPao } from "./kitPao";
import { kitDog } from "./kitDog";
import { MESA, arranjoDe, passoDe, type Arranjo, type EstacaoId, type LancheDef, type Passo } from "./layout";
import Camara, { type ApiCamara } from "./Camara";
import Pedido3D, { type EstadoSacola, type FasePedido, type ProjPedido } from "./Pedido3D";
import type { Opcoes, Pedido } from "./cardapio";
import { liberarMontagem } from "../ar/recursos";
import MesaXR, { type ModoMesa } from "../ar/MesaXR";

const ROOT = "/assets/models/bancada/";
// Arquivos em public/assets/models/bancada/ (contrato no blender/bancada3d/README.md). A mão é o mao-luva.glb.
// Cada lanche carrega só os seus (LancheDef.arquivos), já com os comuns (tábua, mão, bisnaga, pote).
const glb = (n: string) => `${ROOT}${n}.glb`;
useGLTF.setDecoderPath("/draco/");
export const preCarregar = (def: LancheDef) => def.arquivos.forEach((n) => useGLTF.preload(glb(n)));

export type Modo = "arraste" | "toque" | "auto";
export type Bus = { drag: { ativo: boolean; id: EstacaoId | null; x: number; y: number } };
export type Ponto = { x: number; y: number; r: number };
export type Projecao = { estacoes: Record<EstacaoId, Ponto>; lanche: { x0: number; y0: number; x1: number; y1: number }; arranjo: Arranjo };
export type ApiCena = {
  /** `id` = estação (a etapa, ou `<etapa>:<opção>` nas etapas com opções). */
  acao: (id: EstacaoId, modo: Modo) => void;
  soltar: (id: EstacaoId) => void;
  reiniciar: () => void;
  interromper: () => void;
  mostrarPronto: (opcoes: Opcoes | null) => void;
};
export type Props = {
  def: LancheDef | null;
  ativo: Passo | null; reduzido: boolean;
  bus: MutableRefObject<Bus>; api: MutableRefObject<ApiCena | null>;
  /** Fim da ação da estação `id`. */
  aoFim: (id: EstacaoId) => void; aoProjetar: (p: Projecao) => void; aoPronto: () => void;
  congelar: { id: Passo; t: number } | null;
  /** Contexto WebGL perdido com a cena montada. */
  aoFalhar?: () => void;
  leve?: boolean; suspenso?: boolean; aoProgresso?: (valor: number) => void;
  /** Câmera: centralizar e o aviso de "fora da posição padrão" (botão Centralizar). */
  camApi: MutableRefObject<ApiCamara | null>;
  aoCamFora: (fora: boolean) => void;
  /** Mantém a geometria local e pausa a montagem durante o posicionamento AR. */
  apresentacao?: { pronto: boolean; pausado: boolean; interativo?: boolean; estacao?: string };
  modoMesa?: ModoMesa;
  /** Escolhas do pedido que mudam o lanche na tábua (pão parmesão ou roseta). */
  opcoes?: Opcoes | null;
  /** Pedido: potinhos do Turbinar (durante a montagem), bebida, acompanhamento e sacola (depois do lanche pronto). */
  pedido?: {
    fase: FasePedido; atual: Pedido | null; rodada: number;
    aoProjetar: (p: ProjPedido) => void; aoSacola: () => void; aoOcupado: (ocupado: boolean) => void;
    /** A pessoa pôs o lanche na sacola (arrastou ou tocou nela): começa a ensacar. */
    ensacar: boolean; aoSacolaEstado: (e: EstadoSacola) => void;
  };
};

const cubica = (out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, k: number) => {
  const u = 1 - k;
  return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * k).addScaledVector(c, 3 * u * k * k).addScaledVector(d, k * k * k);
};

// ---------------------------------------------------------------- cozinha
/** O cenário: parado na origem, na camada 1 (a câmera vê; as sombras de contato não renderizam a cozinha). */
function Cozinha({ arranjo }: { arranjo: Arranjo }) {
  const { scene } = useGLTF(glb("cozinha"));
  // no retrato a câmera alta vê a cúpula de cima, bem no meio da prateleira: some
  useLayoutEffect(() => {
    ["luminaria", "lampada"].forEach((n) => { const o = scene.getObjectByName(n); if (o) o.visible = arranjo !== "retrato"; });
  }, [scene, arranjo]);
  useLayoutEffect(() => {
    scene.traverse((n) => {
      n.layers.set(1);
      if (n instanceof Mesh) { n.castShadow = false; n.receiveShadow = false; }
      n.updateMatrix(); n.matrixAutoUpdate = false;
    });
    scene.updateMatrixWorld(true);
  }, [scene]);
  return <primitive object={scene} />;
}

// ---------------------------------------------------------------- tudo que é 3D
/**
 * Ação em andamento. Na pegada: a ferramenta vai de (p0,q0) até parar em (pR,qR) — a casa, ou a tábua se foi
 * solta sobre o lanche —, a mão entra de (pS,qS), pega com a raiz em (pG,qG) e leva até (pW,qW), a pose do começo do trabalho.
 */
type Ativo = {
  id: Passo; t: number; D: number; modo: Modo; vel: number; amp: number; g: Pegada | null;
  p0: Vector3; q0: Quaternion; pR: Vector3; qR: Quaternion; pS: Vector3; qS: Quaternion; pG: Vector3; qG: Quaternion; pW: Vector3; qW: Quaternion;
};
type Mola = { p: Vector3; v: Vector3; alvo: Vector3; k: number; c: number; solta: boolean };
type Pop = Volta & { t: number };

export function Mundo({ def, ativo, reduzido, bus, api, aoFim, aoProjetar, aoPronto, congelar, arranjo, M, pedido, opcoes, camApi, apresentacao }: Props & { def: LancheDef; arranjo: Arranjo; M: Medidas }) {
  const assets = useGLTF(def.arquivos.map(glb));
  const { gl, camera, size } = useThree();
  const A = useMemo(() => Object.fromEntries(def.arquivos.map((n, i) => [n, assets[i].scene])) as Record<string, Object3D>, [assets, def]);


  // ------------------------------------------------ lanche, estações, ferramentas e efeitos do lanche escolhido
  const K: Kit = useMemo(() => (def.forma === "dog" ? kitDog(def, A, M) : kitPao(def, A, M)), [def, A, M]);
  const anelPao = useMemo(() => {
    const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: anelTextura(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.0015, 0); m.scale.set(K.anel[0], K.anel[1], 1); m.renderOrder = 2;
    return { m, v: 0 };
  }, [K]);

  // Posiciona as estações conforme o arranjo e guarda a "casa" de cada ferramenta (pose no mundo).
  const mundoEst = useRef<Group>(null);
  const raizLocal = useRef<Group>(null);
  useLayoutEffect(() => {
    // O kit calcula as pegadas no espaço da bancada. Isolá-lo durante o layout
    // preserva essas medidas mesmo quando ele nasce numa âncora AR já posicionada.
    const local = raizLocal.current!;
    const emCoordenadasLocais = (f: () => void) => {
      const pai = local.parent;
      pai?.remove(local);
      local.updateMatrixWorld(true);
      try { f(); } finally { pai?.add(local); local.updateWorldMatrix(true, true); }
    };
    let limpar: (() => void) | undefined;
    emCoordenadasLocais(() => { limpar = K.layout(arranjo, mundoEst.current); });
    return () => emCoordenadasLocais(() => limpar?.());
  }, [K, arranjo]);

  useLayoutEffect(() => {
    if (!apresentacao) return;
    // Os planos animados pertencem ao kit; o renderer precisa deles no mundo AR.
    // Converte só na renderização, sem alterar os planos usados pela animação.
    const restaurar: (() => void)[] = [];
    raizLocal.current?.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const antes = o.onBeforeRender, depois = o.onAfterRender;
      const materiais: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      const planos = materiais.filter((m) => m.clippingPlanes?.length).map((m) => ({ m, locais: m.clippingPlanes!, mundo: m.clippingPlanes!.map((p) => p.clone()) }));
      if (!planos.length) return;
      o.onBeforeRender = function (...args) {
        antes.apply(this, args);
        planos.forEach(({ m, locais, mundo }) => {
          mundo.forEach((p, i) => p.copy(locais[i]).applyMatrix4(raizLocal.current!.matrixWorld));
          m.clippingPlanes = mundo;
        });
      };
      o.onAfterRender = function (...args) {
        planos.forEach(({ m, locais }) => { m.clippingPlanes = locais; });
        depois.apply(this, args);
      };
      restaurar.push(() => { o.onBeforeRender = antes; o.onAfterRender = depois; });
    });
    return () => restaurar.forEach((f) => f());
  }, [K, !!apresentacao]);

  // ------------------------------------------------ mão
  const H = useMemo(() => {
    const raiz = new Group();
    const mao = A["mao-luva"].clone(true);
    raiz.add(mao);
    const poses = {} as Record<keyof typeof POSES, Object3D>;
    (Object.keys(POSES) as (keyof typeof POSES)[]).forEach((p) => {
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
    // ferramentas na mão (no espaço da raiz da mão), do kit do lanche
    Object.values(K.fer).forEach((f) => { if (f) { f.visible = false; raiz.add(f); } });
    raiz.visible = false;
    return { raiz, poses, fer: K.fer };
  }, [A, K]);

  useEffect(() => {
    if (!apresentacao) return;
    return () => liberarMontagem([K.raiz, H.raiz, anelPao.m, ...Object.values(K.estacoes).flatMap((s) => [s.raiz, s.anel]), ...K.extras], Object.values(A));
  }, [K, H, A, anelPao, !!apresentacao]);

  // ------------------------------------------------ estado da animação (tudo em refs: nada re-renderiza por quadro)
  const at = useRef<Ativo | null>(null);
  const molas = useRef<Partial<Record<EstacaoId, Mola>>>({});
  const pops = useRef<Partial<Record<EstacaoId, number>>>({});
  const voltas = useRef<Pop[]>([]);
  const ativoRef = useRef(ativo); ativoRef.current = ativo;
  const opts = useRef({ reduzido, congelar }); opts.current = { reduzido, congelar };
  const apresentacaoRef = useRef(apresentacao); apresentacaoRef.current = apresentacao;
  const fim = useRef(aoFim); fim.current = aoFim;
  const lean = useRef({ p: new Vector3(), v: new Vector3(), ok: false });

  const zerar = () => {
    K.zerar();
    K.lanche.scale.set(1, 1, 1);
    H.raiz.visible = false;
    voltas.current = [];
  };

  // pose da mão num instante (sem a inclinação por velocidade)
  const tmpP = useMemo(() => ({ ponto: new Vector3(), q: new Quaternion(), e: new Euler(), qt: new Quaternion(), dirW: new Vector3(), pos: new Vector3() }), []);
  const poseMao = (id: Passo, t: number, amp: number, outPos: Vector3, outQ: Quaternion) => {
    const ac = K.acoes[id];
    const rot = ac.mao(t, M, amp, tmpP.ponto);
    tmpP.qt.setFromEuler(tmpP.e.set(rot[0], rot[1], rot[2], "XYZ"));
    outQ.copy(tmpP.qt).multiply(qBase(ac.pose));
    if (ac.alcance) {
      // ponto = alvo da chama: a ponta fica atrás dele, na direção da chama
      tmpP.dirW.copy(CHAMA_DIR).applyQuaternion(outQ);
      tmpP.ponto.addScaledVector(tmpP.dirW, -ac.alcance);
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
    else poseMao(a.id, tempoTrabalho(K.acoes[a.id], t), a.amp, outPos, outQ);
  };
  /** Peso da inclinação por velocidade: zero em volta da pegada, para a troca da ferramenta ser exata. */
  const pesoLean = (a: Ativo, t: number) => (a.g ? Math.max(1 - seg(t, a.g.chega - 0.16, a.g.chega - 0.02), seg(t, a.g.fecha + 0.04, a.g.fecha + 0.24)) : 1);

  useEffect(() => {
    zerar();
    api.current = {
      acao(id, modo) {
        if (at.current) return;
        const red = opts.current.reduzido;
        const ac = K.acoes[id];
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
        const st = K.estacoes[id];
        if (g && st) {
          const f = st.ferramenta!, fer = H.fer[id]!;
          a.p0.copy(f.position); a.q0.copy(f.quaternion);
          // solta no ar sobre o lanche: assenta na tábua ao lado do pão; senão volta/fica na casa
          if (modo === "arraste") a.pR.copy(K.naTabua).add(st.apoio); else a.pR.copy(st.casa.p);
          a.qR.copy(st.casa.q);
          // raiz da mão na pegada: a cópia na mão coincide com a ferramenta parada
          a.qG.copy(a.qR).multiply(fer.quaternion.clone().invert());
          a.pG.copy(a.pR).sub(fer.position.clone().applyQuaternion(a.qG));
          poseMao(id, ac.ini!, amp, a.pW, a.qW);
          a.pS.set(Math.max(a.pG.x, 0.07) + M.fora.x, a.pG.y + g.sobre + M.fora.y, a.pG.z + M.fora.z);
          a.qS.setFromAxisAngle(new Vector3(0, 0, 1), -0.12).multiply(a.qG);
          delete molas.current[id];
        }
        K.inicio(id);
        // a câmera girada não pode esconder a ação: lanche, estação e o caminho da mão
        {
          const cx = K.caixa, pts = [new Vector3(cx.x[0], cx.y[1], 0), new Vector3(cx.x[1], cx.y[1], 0), new Vector3(0, cx.y[0], cx.z[1])];
          if (st) pts.push(st.raiz.position.clone().setY(MESA + st.alto));
          camApi.current?.garantir(pts);
        }
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
        if (m) { m.solta = true; m.alvo.copy(K.estacoes[id].casa.p); m.k = 170; m.c = 11; }
      },
      reiniciar() {
        at.current = null;
        zerar();
        K.reiniciar();
        molas.current = {};
        pops.current = {};
      },
      interromper() { /* a ação atual termina sozinha; quem encadeia é o HUD */ },
      mostrarPronto(escolhas) {
        at.current = null;
        zerar(); K.reiniciar(); molas.current = {}; pops.current = {};
        for (const passo of def.passos) {
          if (passo.tipo === "turbinar") continue;
          const opcao = passo.grupo ? escolhas?.[passo.grupo] : null;
          if (opcao === "sem" || (passo.tipo === "macarico" && escolhas?.queijo === "sem")) continue;
          const id = passo.grupo && opcao ? `${passo.id}:${opcao}` : passo.id;
          K.inicio(id); K.final(id);
        }
        K.vestir?.(escolhas);
        H.raiz.visible = false;
      },
    };
    return () => { api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [K, H]);

  useEffect(() => { aoPronto(); }, [aoPronto]);
  useEffect(() => { K.vestir?.(opcoes ?? null); }, [K, opcoes]);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    (window as unknown as { __cena: unknown }).__cena = { K, H, M };
  }, [K, H, M]);

  // ------------------------------------------------ quadro a quadro
  const ray = useMemo(() => ({ r: new Raycaster(), ndc: new Vector2(), plano: new Plane(new Vector3(0, 1, 0), -0.14), hit: new Vector3() }), []);
  const ultimaProj = useRef("");
  const tempoProj = useRef(0);
  const relogio = useRef(0);
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), q: new Quaternion(), e: new Euler(), m: new Matrix4(), s: new Vector3(1, 1, 1), qq: new Quaternion() }), []);

  useFrame((_, delta) => {
    if (apresentacaoRef.current?.pausado || apresentacaoRef.current?.pronto) return;
    const dt = Math.min(delta, 0.1);
    relogio.current += dt;
    const T = relogio.current;
    const red = opts.current.reduzido;
    const lista = K.estacoes;

    // estações: brilho da ativa (todas as opções da etapa), as outras apagadas
    const atv = ativoRef.current;
    Object.keys(lista).forEach((id) => {
      const st = lista[id];
      const alvo = atv === passoDe(id) && (!apresentacaoRef.current?.interativo || !apresentacaoRef.current.estacao || apresentacaoRef.current.estacao === id) ? 1 : 0;
      st.brilho += (alvo - st.brilho) * Math.min(1, dt * 6);
      const pul = red ? 0.8 : 0.72 + 0.28 * Math.sin(T * 3.4);
      (st.anel.material as MeshBasicMaterial).opacity = st.brilho * pul * 0.95;
      const s = st.raio * 3.1 * (1 + (red ? 0 : 0.05 * Math.sin(T * 3.4)));
      st.anel.scale.set(s, s * st.alonga, s);
      // a estação da ação em andamento fica com a cor normal: a ferramenta parada tem de bater com a cópia na mão
      // (o brilho emissivo some sozinho em ~0,5 s, antes da pegada)
      const emAcao = at.current?.id === id;
      st.luz += ((alvo || emAcao ? 1 : 0) - st.luz) * Math.min(1, dt * 6);
      const f = emAcao ? 1 : 0.16 + 0.84 * st.luz;
      const em = st.brilho * (red ? 0.6 : 0.5 + 0.5 * Math.sin(T * 3.4));
      st.mats.forEach(({ m, cor }) => { m.color.copy(cor).multiplyScalar(f); m.emissive.setRGB(0.09, 0.045, 0.012).multiplyScalar(em); });
    });

    {
      K.quadro?.(dt);
      const bp = anelPao;
      const vezTampa = !!atv && !lista[atv] && K.acoes[atv]?.ini === null;
      bp.v += ((vezTampa && !at.current ? 1 : 0) - bp.v) * Math.min(1, dt * 6);
      (bp.m.material as MeshBasicMaterial).opacity = bp.v * (red ? 0.8 : 0.72 + 0.28 * Math.sin(T * 3.4));
    }
    // arraste: a ferramenta segue o dedo num plano acima da bancada
    const d = bus.current.drag;
    if (d.ativo && d.id && !at.current && lista[d.id]) {
      const st = lista[d.id];
      let m = molas.current[d.id];
      if (!m) { m = { p: st.ferramenta!.position.clone(), v: new Vector3(), alvo: new Vector3(), k: 320, c: 26, solta: false }; molas.current[d.id] = m; }
      m.solta = false; m.k = 320; m.c = 26;
      const r = gl.domElement.getBoundingClientRect();
      ray.ndc.set(((d.x - r.left) / r.width) * 2 - 1, -((d.y - r.top) / r.height) * 2 + 1);
      const cameraToque = gl.xr.isPresenting ? gl.xr.getCamera().cameras[0] ?? camera : camera;
      ray.r.setFromCamera(ray.ndc, cameraToque);
      ray.plano.set(tmp.a.set(0, 1, 0), -(MESA + 0.1 + st.alto * 0.25));
      if (apresentacaoRef.current) {
        raizLocal.current!.updateWorldMatrix(true, false);
        ray.plano.applyMatrix4(raizLocal.current!.matrixWorld);
      }
      if (ray.r.ray.intersectPlane(ray.plano, ray.hit)) {
        if (apresentacaoRef.current) raizLocal.current!.worldToLocal(ray.hit);
        m.alvo.copy(ray.hit).sub(tmp.a.set(0, st.alto * 0.25, 0));
      }
    }
    (Object.keys(molas.current) as EstacaoId[]).forEach((id) => {
      const m = molas.current[id]!;
      const st = lista[id]; const f = st.ferramenta!;
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
      const st = lista[id]; const f = st.ferramenta!;
      pops.current[id]! += dt;
      const k = pops.current[id]! / 0.5;
      f.visible = true; f.position.copy(st.casa.p); f.quaternion.copy(st.casa.q);
      f.scale.setScalar(Math.max(0.001, red ? c01(k) : mola(k, 0.8)));
      if (k >= 1) { f.scale.setScalar(1); delete pops.current[id]; }
    });
    voltas.current = voltas.current.filter((v) => {
      v.t += dt;
      const k = v.t / 0.5;
      v.obj.visible = true; v.obj.position.copy(v.p); v.obj.quaternion.copy(v.q);
      v.obj.scale.setScalar(k >= 1 ? 1 : Math.max(0.001, red ? c01(k) : mola(k, 0.8)));
      return k < 1;
    });

    // ação em andamento
    const a = at.current;
    if (a) {
      const cg = opts.current.congelar;
      const congelada = !!cg && cg.id === passoDe(a.id);
      if (congelada) a.t = cg.t; else a.t += dt * a.vel;
      const t = a.t;
      const ac = K.acoes[a.id];
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
      if (!red && !congelada && wl > 0) {
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
      const st = lista[a.id];
      if (a.g && st) {
        const f = st.ferramenta!;
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
      K.efeitos(a.id, tv, amp, red, {
        mao: H.raiz, lean: ln.v,
        pegou: a.g ? t >= a.g.fecha : true,
        leva: a.g ? seg(t, a.g.fecha, a.g.leva) : 1,
      });
      if (t >= a.D) {
        at.current = null;
        H.raiz.visible = false;
        Object.values(H.fer).forEach((f) => { if (f) { f.visible = false; f.scale.setScalar(1); } });
        K.lanche.scale.set(1, 1, 1);
        const extra = K.final(a.id);
        if (extra) extra.forEach((v) => voltas.current.push({ ...v, t: 0 }));
        if (st && (K.volta ? K.volta(a.id) : true)) pops.current[a.id] = 0;
        fim.current(a.id);
      }
    }

    if (apresentacaoRef.current && !apresentacaoRef.current.interativo) return;
    if (apresentacaoRef.current && performance.now() - tempoProj.current < 50) return;
    tempoProj.current = performance.now();
    // tempo da ação atual, para o QA tirar prints no meio de cada ação
    (window as unknown as { __protoT: number }).__protoT = at.current ? at.current.t : -1;
    (window as unknown as { __protoId: string | null }).__protoId = at.current ? at.current.id : null;
    // projeção das estações e do lanche para o HUD (só quando muda)
    const cameraTela = gl.xr.isPresenting ? gl.xr.getCamera().cameras[0] ?? camera : camera;
    const proj = (x: number, y: number, z: number) => {
      tmp.a.set(x, y, z);
      if (apresentacaoRef.current) raizLocal.current!.localToWorld(tmp.a);
      tmp.a.project(cameraTela);
      return [(tmp.a.x + 1) / 2 * size.width, (1 - tmp.a.y) / 2 * size.height, tmp.a.z];
    };
    const est = {} as Record<EstacaoId, { x: number; y: number; r: number }>;
    Object.keys(lista).forEach((id) => {
      const st = lista[id]; const p = st.raiz.position;
      const [cx, cy, profundidade] = proj(p.x, MESA + st.alto * 0.45, p.z);
      if (apresentacaoRef.current && (profundidade < -1 || profundidade > 1 || !Number.isFinite(cx + cy))) return;
      const [ex] = proj(p.x + st.raio, MESA + st.alto * 0.45, p.z);
      est[id] = { x: Math.round(cx), y: Math.round(cy), r: Math.round(apresentacaoRef.current ? Math.min(65, Math.max(24, Math.abs(ex - cx) * 1.25)) : Math.max(30, Math.abs(ex - cx) * 1.25)) };
    });
    const xs: number[] = [], ys: number[] = [];
    const cx = K.caixa;
    for (const x of cx.x) for (const y of cx.y) for (const z of cx.z) {
      const [px, py, profundidade] = proj(x, y, z);
      if (!apresentacaoRef.current || (profundidade >= -1 && profundidade <= 1 && Number.isFinite(px + py))) { xs.push(px); ys.push(py); }
    }
    const lan = xs.length ? { x0: Math.round(Math.min(...xs)), y0: Math.round(Math.min(...ys)), x1: Math.round(Math.max(...xs)), y1: Math.round(Math.max(...ys)) } : { x0: 0, y0: 0, x1: 0, y1: 0 };
    const chave = JSON.stringify([est, lan, arranjo]);
    if (chave !== ultimaProj.current) { ultimaProj.current = chave; aoProjetar({ estacoes: est, lanche: lan, arranjo }); }
  });

  return <group ref={raizLocal} dispose={null}>
    <primitive object={K.raiz} />
    <group ref={mundoEst} visible={!apresentacao?.pronto}>
      {Object.keys(K.estacoes).map((id) => <primitive key={id} object={K.estacoes[id].raiz} />)}
      {Object.keys(K.estacoes).map((id) => <primitive key={`a-${id}`} object={K.estacoes[id].anel} />)}
    </group>
    <primitive object={anelPao.m} />
    <primitive object={H.raiz} />
    {K.extras.map((o, i) => <primitive key={`x-${i}`} object={o} />)}
    {pedido?.atual && <Suspense fallback={null}>
      <Pedido3D K={K} H={H} M={M} arranjo={arranjo} fase={pedido.fase} pedido={pedido.atual} rodada={pedido.rodada} reduzido={reduzido}
        bus={bus}
        pausado={apresentacao?.pausado}
        aoProjetar={pedido.aoProjetar} aoSacola={pedido.aoSacola} aoOcupado={pedido.aoOcupado}
        ensacar={pedido.ensacar} aoSacolaEstado={pedido.aoSacolaEstado} camApi={camApi} />
    </Suspense>}
  </group>;
}

// ---------------------------------------------------------------- canvas
export default function Cena(props: Props) {
  const { progress } = useProgress();
  useEffect(() => props.aoProgresso?.(Math.round(progress)), [props.aoProgresso, progress]);
  const camera = useMemo(() => ({ position: [0, 1, 1.4] as [number, number, number], fov: 50, near: 0.05, far: 12 }), []);
  // Perda de contexto só conta como falha enquanto a cena está montada: ao desmontar, o R3F chama forceContextLoss.
  const falhar = useRef(props.aoFalhar);
  falhar.current = props.aoFalhar;
  const montada = useRef(true);
  useEffect(() => { montada.current = true; return () => { montada.current = false; }; }, []);
  // Sem sombras em tempo real: só as sombras de contato (a luz da cozinha já vem assada no GLB).
  return <Canvas className="!absolute inset-0" frameloop={props.suspenso ? "never" : "always"} dpr={props.leve ? 1 : [1, 1.5]} camera={camera} gl={{ alpha: true, antialias: !props.leve, powerPreference: "default" }}
    style={{ touchAction: "none" }} onCreated={({ gl }) => {
      gl.setClearColor(0x120c09, 1);
      gl.xr.enabled = true;
      gl.domElement.addEventListener("webglcontextlost", () => { if (montada.current) falhar.current?.(); }, { once: true });
    }}>
    <Interno {...props} />
  </Canvas>;
}

function Interno(props: Props) {
  const { size } = useThree();
  const arranjo = arranjoDe(size.width, size.height);
  const M = useMemo<Medidas>(() => ({ pasta: 0.05, costela: 0.08, creme: 0.085, muss: 0.1, fora: new Vector3(0.7, 0.24, 0.1), h: {}, p: {} }), []);
  const { def } = props;
  const estado = props.modoMesa?.estado;
  const emAR = !!estado && estado.fase !== "3d" && estado.fase !== "iniciando";
  const pausado = !!props.suspenso || !!estado && estado.fase !== "3d" && (estado.fase !== "colocado" || !estado.rastreando);
  const mundo = def && <Suspense fallback={null}>
    <Mundo key={def.id} {...props} def={def} arranjo={arranjo} M={M}
      apresentacao={props.modoMesa ? { pronto: false, pausado, interativo: true } : undefined} />
  </Suspense>;
  return <>
    {!emAR && <Camara arranjo={arranjo} M={M} travada={!!props.congelar} reduzido={props.reduzido} api={props.camApi} aoFora={props.aoCamFora} segurando={() => props.bus.current.drag.ativo} />}
    {/* luzes do README (as mesmas dos renders da cozinha) e uma poça quente da luminária sobre a tábua */}
    <hemisphereLight args={["#ffe6c8", "#1a0f0a", 0.55]} />
    <ambientLight intensity={0.25} color="#ffe2c0" />
    <directionalLight position={[0.15, 1.1, 0.35]} intensity={2.6} color="#ffd9a8" />
    <directionalLight position={[-0.6, 0.5, 0.8]} intensity={0.7} color="#fff1dc" />
    {!emAR && <Poca />}
    <Ambiente />
    {!emAR && <Suspense fallback={null}><Cozinha arranjo={arranjo} /></Suspense>}
    {props.modoMesa ? <MesaXR modo={props.modoMesa}>{mundo}</MesaXR> : mundo}
    {def && !emAR && !props.leve && <ContactShadows position={[0, MESA + 0.0008, 0]} scale={1.6} far={0.35} blur={2.2} opacity={0.75} resolution={256} color="#000000" frames={Infinity} />}
  </>;
}

/** Ambiente para reflexos (luva acetinada, bisnaga, inox, brilho do azulejo): sala neutra em PMREM, fraca. */
export function Ambiente() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    gl.localClippingEnabled = true;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

/** Luz da luminária pendente: cone quente e macio sobre a tábua (sem sombra). */
function Poca() {
  const luz = useMemo(() => {
    const l = new SpotLight("#ffc27a", 1.6, 0, 0.62, 0.85, 2);
    l.position.set(0.02, 0.78, -0.02);
    l.target.position.set(0, MESA, 0.02);
    return l;
  }, []);
  return <><primitive object={luz} /><primitive object={luz.target} /></>;
}
