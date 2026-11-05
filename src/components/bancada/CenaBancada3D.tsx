"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ElementRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Box3, DoubleSide, Group, MathUtils, Mesh, Object3D, Plane, Spherical, Vector3, type Material } from "three";
import Carregando from "./Carregando";
import { arquivosDoLanche, BEBIDAS, PORCOES, receitaDe, tampaFechada, type Estado, type LancheId } from "./passos";

const ROOT = "/assets/models/bancada/";
const OPEN = -1.9199;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);
const easeIO = (n: number) => { const k = clamp(n); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const glb = (nome: string) => `${ROOT}${nome}.glb`;
const ITENS_MESA = [...BEBIDAS, ...PORCOES].map((i) => i.icone);

useGLTF.setDecoderPath("/draco/");

/** Pré-carrega os modelos do lanche escolhido (e os itens de mesa) enquanto o cliente ainda lê o cardápio. */
export function preCarregar(lanche: LancheId) {
  [...arquivosDoLanche(lanche), ...ITENS_MESA].forEach((n) => useGLTF.preload(glb(n)));
}

// sacola.glb tem sacola_aberta e sacola_fechada sobrepostas (estampa em +z); macarico-mao.glb já vem na pose de uso.
// Onde cada coisa fica na mesa (x para a direita, z para a câmera; a tábua vai de x -0,21 a 0,33 e z ±0,15).
const MESA_Y = -0.028;
const POS_BEBIDA = new Vector3(-0.3, MESA_Y, -0.05);
const POS_PORCAO = new Vector3(0.1, MESA_Y, 0.235);
const SACOLA_ANTES = new Vector3(0, MESA_Y, -0.215);
const SACOLA_DEPOIS = new Vector3(0, 0, -0.01);
// Maçarico: ponta do bico no espaço do modelo (README); a chama sai dela para trás e para baixo.
const PONTA = new Vector3(-0.101, -0.0703, 0);
const DURACAO: Record<string, number> = { macarico: 2.7, sacola: 2.7, mussarela: 1.1 };
const duracaoDe = (id: string) => DURACAO[id] ?? 0.94;

type Anim = { id: string; t: number };
type Zona = { x0: number; y0: number; x1: number; y1: number };
type Fase = "montar" | "mesa" | "final";

function ItemMesa({ nome, pos, reduzido }: { nome: string; pos: Vector3; reduzido: boolean }) {
  const { scene } = useGLTF(glb(nome));
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((n) => {
      if (!(n instanceof Mesh)) return;
      n.castShadow = true; n.receiveShadow = true;
      const mats: Material[] = Array.isArray(n.material) ? n.material : [n.material];
      if (mats.some((m) => m.transparent)) {
        n.castShadow = false;
        n.renderOrder = 4;
        mats.forEach((m) => { m.depthWrite = false; m.side = DoubleSide; });
      }
    });
    return c;
  }, [scene]);
  const t = useRef(0);
  useLayoutEffect(() => { t.current = reduzido ? 9 : 0; obj.position.copy(pos).setY(pos.y + (reduzido ? 0 : 0.14)); if (reduzido) obj.position.y = pos.y; }, [obj, pos, reduzido]);
  useFrame((_, dt) => {
    if (t.current >= 0.5) return;
    t.current += Math.min(dt, 0.06);
    const k = ease(t.current / 0.42);
    obj.position.y = pos.y + 0.14 * (1 - k);
    const sq = Math.sin(Math.PI * clamp((t.current - 0.3) / 0.2)) * 0.05;
    obj.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    if (t.current >= 0.5) { obj.position.y = pos.y; obj.scale.set(1, 1, 1); }
  });
  return <primitive object={obj} />;
}

type ModelosProps = Pick<Props, "estado" | "reduzido" | "destacado" | "aoTerminar">;

function Modelos({ estado, reduzido, destacado, aoTerminar }: ModelosProps) {
  const receita = receitaDe(estado)!;
  const pao = receita.tampa.modelo === "pao";
  const nomes = useMemo(() => arquivosDoLanche(receita.id), [receita.id]);
  const assets = useGLTF(nomes.map(glb));
  // O cache do GLTF é compartilhado: nunca gire uma dobradiça nem troque materiais do original.
  const objs = useMemo(() => {
    const m: Record<string, Object3D> = {};
    nomes.forEach((n, i) => { m[n === "macarico-mao" ? "macarico" : n] = assets[i].scene.clone(true); });
    return m;
  }, [nomes, assets]);
  const { gl } = useThree();
  const lanche = useRef<Group>(null);
  const clip = useMemo(() => new Plane(new Vector3(-1, 0, 0), 1), []);
  const anim = useRef<Anim | null>(null);
  const ultimo = useRef<string | null>(null);
  const montado = useRef(false);
  const lid = useRef({ cur: OPEN, de: OPEN, para: OPEN, t: 1, dur: 0.6 });
  const fim = useRef(aoTerminar); fim.current = aoTerminar;
  const reduz = useRef(reduzido); reduz.current = reduzido;

  const tampa = useMemo(() => objs[receita.tampa.modelo]?.getObjectByName(receita.tampa.no), [objs, receita]);
  const chama = useMemo(() => objs.macarico?.getObjectByName("chama"), [objs]);
  const sacolaAberta = useMemo(() => objs.sacola.getObjectByName("sacola_aberta"), [objs]);
  const sacolaFechada = useMemo(() => objs.sacola.getObjectByName("sacola_fechada"), [objs]);
  const camadas = useMemo(() => receita.etapas.map((e) => e.id).filter((id) => id !== "macarico"), [receita]);

  useEffect(() => {
    Object.values(objs).forEach((o) => o.traverse((n) => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; } }));
  }, [objs]);

  useEffect(() => {
    const g = objs.gratinado;
    if (!g) return;
    gl.localClippingEnabled = true;
    g.traverse((n) => {
      if (!(n instanceof Mesh)) return;
      const m = n.material as Material | Material[];
      n.material = Array.isArray(m) ? m.map((x) => x.clone()) : m.clone();
      (Array.isArray(n.material) ? n.material : [n.material]).forEach((x: Material) => { x.clippingPlanes = [clip]; x.clipShadows = true; });
    });
    return () => {
      gl.localClippingEnabled = false;
      g.traverse((n) => { if (n instanceof Mesh) (Array.isArray(n.material) ? n.material : [n.material]).forEach((x: Material) => x.dispose()); });
    };
  }, [gl, objs, clip]);

  // Estado discreto -> cena: visibilidade, tampa e início das animações.
  useLayoutEffect(() => {
    const { colocados, tela, animando, ensacado } = estado;
    const a = anim.current;
    const final = tela === "final";
    const repouso = (id: string) => { const o = objs[id]; if (o) { o.position.set(0, 0, 0); o.scale.set(1, 1, 1); } };
    camadas.forEach((id) => { objs[id].visible = colocados.includes(id); if (a?.id !== id) repouso(id); });
    if (objs["dog-cesta"]) objs["dog-cesta"].visible = true;
    if (objs.gratinado) { objs.gratinado.visible = colocados.includes("macarico"); if (a?.id !== "macarico") clip.constant = 1; }
    if (objs.macarico && a?.id !== "macarico") { objs.macarico.visible = false; objs.macarico.position.set(0.6, 0, 0); if (chama) chama.visible = false; }
    // Tampa: fecha/abre como tween; no pão de alho a mussarela espera a tampa descer.
    const alvo = tampaFechada(estado) ? 0 : OPEN;
    const L = lid.current;
    if (!montado.current) { L.cur = L.de = L.para = alvo; L.t = 1; if (tampa) tampa.rotation.x = alvo; }
    else if (L.para !== alvo) { L.de = L.cur; L.para = alvo; L.t = 0; L.dur = reduzido ? 0.001 : alvo === 0 ? (pao ? 0.55 : 0.7) : 0.4; }
    montado.current = true;
    // Lanche e sacola.
    const sac = objs.sacola;
    const l = lanche.current;
    if (l && a?.id !== "sacola") { l.position.set(0, 0, 0); l.scale.set(1, 1, 1); l.visible = !(final && ensacado); }
    if (a?.id !== "sacola") {
      sac.visible = final;
      sac.scale.set(1, 1, 1);
      sac.position.copy(ensacado ? SACOLA_DEPOIS : SACOLA_ANTES);
      if (sacolaAberta) sacolaAberta.visible = !ensacado;
      if (sacolaFechada) sacolaFechada.visible = ensacado;
    }
    // Animação nova.
    if (animando !== ultimo.current) {
      ultimo.current = animando;
      if (!animando) anim.current = null;
      else if (animando === "tampa") {
        anim.current = { id: "tampa", t: 0 };
        if (L.t >= 1 && L.cur === L.para) { anim.current = null; fim.current(); }
      } else {
        anim.current = { id: animando, t: 0 };
        if (animando === "sacola") {
          sac.visible = true; sac.position.copy(SACOLA_ANTES);
          if (sacolaAberta) sacolaAberta.visible = true;
          if (sacolaFechada) sacolaFechada.visible = false;
          if (l) l.visible = true;
        } else if (objs[animando]) objs[animando].visible = true;
        if (animando === "macarico" && objs.macarico) { objs.macarico.visible = true; clip.constant = -0.4; }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, objs, camadas, chama, clip]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.06);
    const L = lid.current;
    if (L.t < 1) {
      L.t = Math.min(1, L.t + dt / L.dur);
      if (L.para === 0) L.cur = L.t < 0.82 ? MathUtils.lerp(L.de, 0.045, ease(L.t / 0.82)) : 0.045 * (1 - ease((L.t - 0.82) / 0.18));
      else L.cur = MathUtils.lerp(L.de, OPEN, easeIO(L.t));
      if (L.t >= 1) L.cur = L.para;
      if (tampa) tampa.rotation.x = L.cur;
      if (L.t >= 1 && anim.current?.id === "tampa") { anim.current = null; fim.current(); }
    }
    const a = anim.current;
    if (!a || a.id === "tampa") return;
    a.t += reduz.current ? 99 : dt;
    const t = a.t;
    const o = objs[a.id];
    if (a.id === "macarico") {
      const m = objs.macarico;
      // Ponta do bico: entra pela direita, mira o topo do lanche, varre de ponta a ponta e sai.
      const X0 = -0.085, X1 = 0.215, Y = 0.137, FORA = 0.5;
      let x: number, y = Y, flame = false;
      if (t < 0.6) { const k = ease(t / 0.6); x = MathUtils.lerp(FORA, X0, k); y = Y + 0.05 * (1 - k); }
      else if (t < 2.05) { x = MathUtils.lerp(X0, X1, easeIO((t - 0.7) / 1.3)); y = Y + 0.004 * Math.sin(t * 11); flame = t >= 0.66 && t < 2.0; }
      else { const k = ease((t - 2.05) / 0.6); x = MathUtils.lerp(X1, FORA, k); y = Y + 0.06 * k; }
      m.position.set(x - PONTA.x, y - PONTA.y, 0);
      if (chama) { chama.visible = flame; chama.scale.set(1, 0.9 + 0.2 * Math.abs(Math.sin(t * 23)), 1); }
      clip.constant = t < 0.7 ? -0.4 : t < 2.0 ? x - 0.067 : 1;
    } else if (a.id === "sacola") {
      const l = lanche.current!, sac = objs.sacola;
      const TOPO = 0.234;
      // 0-0,8 sobe e encolhe; 0,8-1,3 vai até a boca; 1,3-1,8 desce; 1,8 fecha; 2,0-2,7 a sacola vem para a tábua.
      const up = ease(t / 0.8), over = easeIO((t - 0.8) / 0.5), down = easeIO((t - 1.3) / 0.5);
      l.scale.setScalar(MathUtils.lerp(1, 0.34, up));
      l.position.set(SACOLA_ANTES.x * over, MathUtils.lerp(0, TOPO + 0.075, up) * (1 - down) + (TOPO - 0.05) * down, SACOLA_ANTES.z * over);
      l.visible = t < 1.78;
      const fechada = t >= 1.8;
      if (sacolaAberta) sacolaAberta.visible = !fechada;
      if (sacolaFechada) sacolaFechada.visible = fechada;
      sac.position.lerpVectors(SACOLA_ANTES, SACOLA_DEPOIS, easeIO((t - 2.0) / 0.7));
      const sq = Math.sin(Math.PI * clamp((t - 1.8) / 0.25)) * 0.04;
      sac.scale.set(1 + sq, 1 - sq, 1 + sq);
    } else if (o) {
      if (a.id === "pao" || a.id === "dog-brioche") {
        o.position.y = t < 0.63 ? 0.28 * (1 - ease(t / 0.63)) : t < 0.81 ? 0.016 * Math.sin(Math.PI * (t - 0.63) / 0.18) : 0;
        const sq = t < 0.63 ? 0 : Math.sin(Math.PI * clamp((t - 0.63) / 0.37)) * 0.08;
        o.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      } else if (a.id === "mussarela") {
        o.visible = t >= 0.52;
        o.position.y = 0.17 * (1 - ease((t - 0.52) / 0.56));
        const sq = Math.sin(Math.PI * clamp((t - 0.52) / 0.56)) * 0.05;
        o.scale.set(1 + sq, 1 - sq, 1 + sq);
      } else {
        o.position.y = 0.18 * (1 - ease(t / 0.76));
        const sq = Math.sin(Math.PI * clamp((t - 0.54) / 0.38)) * 0.07;
        o.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      }
    }
    if (t >= duracaoDe(a.id)) {
      anim.current = null;
      if (a.id === "macarico") { objs.macarico.visible = false; objs.macarico.position.set(0.6, 0, 0); if (chama) chama.visible = false; clip.constant = 1; }
      else if (a.id === "sacola") {
        const l = lanche.current!;
        l.visible = false; l.position.set(0, 0, 0); l.scale.set(1, 1, 1);
        objs.sacola.position.copy(SACOLA_DEPOIS); objs.sacola.scale.set(1, 1, 1);
        if (sacolaAberta) sacolaAberta.visible = false;
        if (sacolaFechada) sacolaFechada.visible = true;
      } else if (o) { o.position.set(0, 0, 0); o.scale.set(1, 1, 1); }
      fim.current();
    }
  });

  const dog = !pao;
  const mostraBeb = estado.tela === "bebida" || estado.tela === "porcao" || estado.tela === "final";
  const mostraPor = estado.tela === "porcao" || estado.tela === "final";
  const beb = BEBIDAS.find((b) => b.id === estado.bebida);
  const por = PORCOES.find((p) => p.id === estado.porcao);
  return <>
    <primitive object={objs.tabua} />
    <group ref={lanche}>
      {objs["dog-cesta"] && <primitive object={objs["dog-cesta"]} />}
      {camadas.map((id) => <primitive key={id} object={objs[id]} />)}
      {objs.gratinado && <primitive object={objs.gratinado} />}
    </group>
    {objs.macarico && <primitive object={objs.macarico} />}
    <primitive object={objs.sacola} />
    {mostraBeb && beb && <Suspense fallback={null}><ItemMesa key={beb.icone} nome={beb.icone} pos={POS_BEBIDA} reduzido={reduzido} /></Suspense>}
    {mostraPor && por && <Suspense fallback={null}><ItemMesa key={por.icone} nome={por.icone} pos={POS_PORCAO} reduzido={reduzido} /></Suspense>}
    {destacado && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[dog ? 1.3 : 1.15, dog ? 0.8 : 0.78, 1]}><ringGeometry args={[0.145, 0.16, 64]} /><meshBasicMaterial color="#ffd37d" transparent opacity={0.6} depthWrite={false} /></mesh>}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, MESA_Y - 0.0005, 0]} receiveShadow>
      <circleGeometry args={[1.6, 64]} /><meshStandardMaterial color="#1a120e" roughness={1} metalness={0} />
    </mesh>
  </>;
}

// Vista padrão: 3/4 de cima, mirando o lanche. Os limites da órbita são relativos a ela.
const DIST = new Vector3(0.19, 0.35, 0.63);
const AZIMUTE0 = Math.atan2(DIST.x, DIST.z);
const GIRO = MathUtils.degToRad(35);
const ELEVACAO = [MathUtils.degToRad(20), MathUtils.degToRad(65)] as const;
const ZOOM = [0.7, 1.6] as const;
const OCIOSO = 3;
const VOLTA = 0.8;
const CAIXA_PAO = new Box3(new Vector3(-0.15, 0, -0.12), new Vector3(0.15, 0.15, 0.052));
const CAIXA_DOG = new Box3(new Vector3(-0.165, 0, -0.1), new Vector3(0.165, 0.14, 0.1));

// Metros visíveis em cada eixo da tela por fase (o zoom ortográfico é o menor ajuste que cabe nos dois).
function enquadramento(fase: Fase, dog: boolean) {
  if (fase === "montar") return dog ? { alvo: new Vector3(0, 0.04, 0), ancho: 0.54, alto: 0.3 } : { alvo: new Vector3(0, 0.05, 0), ancho: 0.5, alto: 0.3 };
  if (fase === "mesa") return { alvo: new Vector3(-0.02, 0.03, 0.02), ancho: 0.78, alto: 0.42 };
  return { alvo: new Vector3(-0.02, 0.1, 0.02), ancho: 0.74, alto: 0.48 };
}

function Camera({ fase, dog, bloqueado, aoMudarZona, voltar }: { fase: Fase; dog: boolean; bloqueado: boolean; aoMudarZona: (z: Zona) => void; voltar: MutableRefObject<() => void> }) {
  const { camera, size } = useThree();
  const controles = useRef<ElementRef<typeof OrbitControls>>(null);
  const enq = enquadramento(fase, dog);
  const zoomPadrao = Math.min(size.width / enq.ancho, size.height / enq.alto);
  const padrao = useRef({ zoom: zoomPadrao, alvo: enq.alvo.clone() });
  const zoomAnterior = useRef(zoomPadrao);
  const chave = useRef("");
  const ultima = useRef(performance.now() / 1000);
  const ativo = useRef(false);
  const volta = useRef<{ t: number; de: Spherical; zoom: number; alvo: Vector3; dur: number } | null>(null);
  const ultimaZona = useRef<number[]>([]);
  padrao.current.zoom = zoomPadrao;
  padrao.current.alvo.copy(enq.alvo);

  const iniciarVolta = useMemo(() => (dur = VOLTA) => {
    const c = controles.current;
    if (!c) return;
    volta.current = { t: 0, de: new Spherical().setFromVector3(camera.position.clone().sub(c.target)), zoom: camera.zoom, alvo: c.target.clone(), dur };
  }, [camera]);
  voltar.current = () => iniciarVolta();

  // Primeira montagem: já na vista padrão. Mudança de fase/lanche: viaja até o novo enquadramento.
  useLayoutEffect(() => {
    const k = `${fase}:${dog}`;
    if (chave.current === "") {
      camera.position.copy(padrao.current.alvo).add(DIST);
      camera.lookAt(padrao.current.alvo);
      camera.zoom = zoomPadrao;
      controles.current?.target.copy(padrao.current.alvo);
      controles.current?.update();
    } else if (chave.current !== k) iniciarVolta(1.1);
    chave.current = k;
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, fase, dog]);

  // Redimensionou: preserva a vista do usuário, só reescala o zoom.
  useLayoutEffect(() => {
    if (zoomAnterior.current !== zoomPadrao) camera.zoom *= zoomPadrao / zoomAnterior.current;
    zoomAnterior.current = zoomPadrao;
    camera.updateProjectionMatrix();
  }, [camera, zoomPadrao]);

  useFrame((_, delta) => {
    const c = controles.current;
    if (!c) return;
    const agora = performance.now() / 1000;
    const { zoom, alvo } = padrao.current;
    if (bloqueado || ativo.current) ultima.current = agora;
    const v = volta.current;
    if (v) {
      v.t += delta / v.dur;
      const k = easeIO(v.t);
      const para = new Spherical().setFromVector3(DIST);
      c.target.lerpVectors(v.alvo, alvo, k);
      const s = new Spherical(MathUtils.lerp(v.de.radius, para.radius, k), MathUtils.lerp(v.de.phi, para.phi, k), MathUtils.lerp(v.de.theta, para.theta, k));
      camera.position.copy(c.target).add(new Vector3().setFromSpherical(s));
      camera.zoom = MathUtils.lerp(v.zoom, zoom, k);
      camera.updateProjectionMatrix();
      c.update();
      if (v.t >= 1) volta.current = null;
    } else if (agora - ultima.current > OCIOSO) {
      const fora = camera.position.distanceTo(new Vector3().copy(alvo).add(DIST)) > 1e-3 || Math.abs(camera.zoom - zoom) > 1e-3 * zoom || c.target.distanceTo(alvo) > 1e-4;
      if (fora) iniciarVolta(); else ultima.current = agora;
    }
    // Projeta a caixa do lanche em pixels do canvas: é a zona de soltura do arrasto.
    const caixa = dog ? CAIXA_DOG : CAIXA_PAO;
    const xs: number[] = [], ys: number[] = [];
    for (const x of [caixa.min.x, caixa.max.x]) for (const y of [caixa.min.y, caixa.max.y]) for (const z of [caixa.min.z, caixa.max.z]) {
      const n = new Vector3(x, y, z).project(camera);
      xs.push((n.x + 1) / 2 * size.width); ys.push((1 - n.y) / 2 * size.height);
    }
    const atual = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const antiga = ultimaZona.current;
    if (antiga.length && atual.every((n, i) => Math.abs(n - antiga[i]) < 0.5)) return;
    ultimaZona.current = atual;
    aoMudarZona({ x0: atual[0], y0: atual[1], x1: atual[2], y1: atual[3] });
  });

  return <OrbitControls ref={controles} makeDefault enabled={!bloqueado} enablePan={false} enableDamping dampingFactor={0.1} enableRotate enableZoom
    minAzimuthAngle={AZIMUTE0 - GIRO} maxAzimuthAngle={AZIMUTE0 + GIRO}
    minPolarAngle={Math.PI / 2 - ELEVACAO[1]} maxPolarAngle={Math.PI / 2 - ELEVACAO[0]}
    minZoom={zoomPadrao * ZOOM[0]} maxZoom={zoomPadrao * ZOOM[1]}
    onStart={() => { ativo.current = true; ultima.current = performance.now() / 1000; volta.current = null; }}
    onEnd={() => { ativo.current = false; ultima.current = performance.now() / 1000; }} />;
}

function Pronto({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

type Props = {
  estado: Estado; reduzido: boolean; destacado: boolean; bloqueado: boolean; pronto: boolean;
  aoTerminar: () => void; aoMudarZona: (z: Zona) => void; aoPronto: () => void; aoFalhar: () => void;
  voltar: MutableRefObject<() => void>;
};
export type { Zona };

export default function CenaBancada3D({ estado, reduzido, destacado, bloqueado, pronto, aoTerminar, aoMudarZona, aoPronto, aoFalhar, voltar }: Props) {
  const { progress } = useProgress();
  const receita = receitaDe(estado)!;
  const fase: Fase = estado.tela === "final" ? "final" : estado.tela === "montar" ? "montar" : "mesa";
  const camera = useMemo(() => ({ position: [0.19, 0.4, 0.63] as [number, number, number], near: 0.01, far: 4 }), []);
  return <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#33231d,#1a1210)]">
    <Canvas className="relative" dpr={[1, 2]} camera={camera} orthographic shadows="percentage" style={{ touchAction: "none" }}
      onCreated={({ gl }) => { gl.domElement.addEventListener("webglcontextlost", aoFalhar, { once: true }); }}>
      <Camera fase={fase} dog={receita.id === "dogalho"} bloqueado={bloqueado} aoMudarZona={aoMudarZona} voltar={voltar} />
      <color attach="background" args={["#1c1411"]} />
      <ambientLight intensity={1.8} color="#fff0dc" />
      <directionalLight position={[-0.3, 0.8, 0.48]} intensity={3.1} color="#ffe0b0" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-radius={4}
        shadow-camera-left={-0.7} shadow-camera-right={0.7} shadow-camera-top={0.7} shadow-camera-bottom={-0.7} shadow-camera-near={0.1} shadow-camera-far={2.5} />
      <pointLight position={[0.33, 0.2, -0.2]} intensity={0.55} color="#ff8b43" />
      <Suspense fallback={null}>
        <Modelos key={receita.id} estado={estado} reduzido={reduzido} destacado={destacado} aoTerminar={aoTerminar} />
        <Pronto onReady={aoPronto} />
      </Suspense>
    </Canvas>
    {!pronto && <Carregando foto={receita.foto} progresso={progress} />}
  </div>;
}
