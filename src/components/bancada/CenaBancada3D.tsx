"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, MathUtils, Mesh, Plane, Spherical, Vector3, type Material } from "three";
import { layouts, type Ponto } from "./layout";
import type { EstadoBancada, PassoId } from "./passos";

const ROOT = "/assets/models/bancada/";
const FILES = ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico"] as const;
const OPEN = -1.9199;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);

useGLTF.setDecoderPath("/draco/");
FILES.forEach((file) => useGLTF.preload(`${ROOT}${file}.glb`));

type Animation = { id: PassoId; elapsed: number };

function Modelos({ estado, destacado, aoTerminar }: Pick<Props, "estado" | "destacado" | "aoTerminar">) {
  const assets = FILES.map((file) => useGLTF(`${ROOT}${file}.glb`));
  // GLTF's cache is shared; never rotate a cached hinge or change its materials directly.
  const models = useMemo(() => assets.map((asset) => asset.scene.clone(true)), [assets[0], assets[1], assets[2], assets[3], assets[4], assets[5], assets[6], assets[7]]);
  const [tabua, pao, pasta, costela, creme, mussarela, gratinado, macarico] = models;
  const tampa = useMemo(() => pao.getObjectByName("pao_tampa"), [pao]);
  const chama = useMemo(() => macarico.getObjectByName("chama"), [macarico]);
  const clip = useMemo(() => new Plane(new Vector3(-1, 0, 0), -0.19), []);
  const animation = useRef<Animation | null>(null);
  const lastKey = useRef("");
  const finish = useRef(aoTerminar);
  finish.current = aoTerminar;
  const { gl } = useThree();

  useEffect(() => {
    models.forEach((model) => model.traverse((node) => {
      if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; }
    }));
  }, [models]);

  useEffect(() => {
    gl.localClippingEnabled = true;
    gratinado.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const material = node.material as Material | Material[];
      node.material = (Array.isArray(material) ? material.map((m) => m.clone()) : material.clone());
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((m) => { m.clippingPlanes = [clip]; m.clipShadows = true; });
    });
    return () => {
      gl.localClippingEnabled = false;
      gratinado.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((m) => m.dispose());
      });
    };
  }, [gl, gratinado, clip]);

  useLayoutEffect(() => {
    const active = estado.animando ? (["pao", "pasta", "costela", "creme", "mussarela", "macarico"] as const)[estado.passoAtual] : undefined;
    const key = active ? `${estado.passoAtual}:${[...estado.colocados].join(",")}` : "";
    if (key && lastKey.current === key) return;
    lastKey.current = key;
    animation.current = active ? { id: active, elapsed: 0 } : null;
    pao.visible = estado.colocados.has("pao");
    pasta.visible = estado.colocados.has("pasta");
    costela.visible = estado.colocados.has("costela");
    creme.visible = estado.colocados.has("creme");
    mussarela.visible = estado.colocados.has("mussarela");
    gratinado.visible = estado.colocados.has("macarico") && (estado.colocados.has("mussarela") || estado.colocados.has("creme"));
    // Without mozzarella the toasted surface rests on the cream instead of hovering above an absent lid.
    gratinado.position.y = estado.colocados.has("mussarela") ? 0 : -0.04;
    clip.constant = animation.current?.id === "macarico" ? -0.19 : 1;
    if (tampa) tampa.rotation.x = active === "mussarela" ? OPEN : estado.colocados.has("mussarela") ? 0 : OPEN;
    chama && (chama.visible = false);
    macarico.position.set(0, 0, 0);
    macarico.rotation.z = 0;
    for (const model of [pao, pasta, costela, creme, mussarela]) {
      model.position.y = 0;
      model.scale.set(1, 1, 1);
    }
    if (active === "pao") { pao.position.y = 0.28; pao.scale.set(0.92, 1, 0.92); }
    if (active === "pasta" || active === "costela" || active === "creme") models[FILES.indexOf(active)].position.y = 0.18;
    if (active === "mussarela") { mussarela.visible = false; mussarela.position.y = 0.17; }
  }, [estado, models, pao, pasta, costela, creme, mussarela, gratinado, macarico, tampa, chama, clip]);

  useFrame((_, delta) => {
    const a = animation.current;
    if (!a) return;
    a.elapsed += Math.min(delta, 0.06);
    const t = a.elapsed;
    if (a.id === "pao") {
      pao.position.y = t < 0.63 ? 0.28 * (1 - ease(t / 0.63)) : t < 0.81 ? 0.016 * Math.sin(Math.PI * (t - 0.63) / 0.18) : 0;
      const squash = t < 0.63 ? 0 : Math.sin(Math.PI * clamp((t - 0.63) / 0.37)) * 0.08;
      pao.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    } else if (a.id === "mussarela") {
      if (tampa) {
        const close = ease(t / 0.53);
        tampa.rotation.x = t < 0.53 ? MathUtils.lerp(OPEN, 0.045, close) : 0.045 * (1 - ease((t - 0.53) / 0.12));
      }
      mussarela.visible = t >= 0.52;
      mussarela.position.y = 0.17 * (1 - ease((t - 0.52) / 0.56));
      const squash = Math.sin(Math.PI * clamp((t - 0.52) / 0.56)) * 0.05;
      mussarela.scale.set(1 + squash, 1 - squash, 1 + squash);
    } else if (a.id === "macarico") {
      const lift = ease(t / 0.18) * (1 - ease((t - 0.91) / 0.27));
      macarico.position.y = lift * 0.065;
      macarico.position.x = lift * (-0.006 + 0.33 * ease((t - 0.18) / 0.72));
      macarico.rotation.z = lift * -0.10;
      if (chama) chama.visible = t >= 0.18 && t < 0.96;
      clip.constant = t < 0.18 ? -0.19 : t < 0.96 ? -0.19 + 0.38 * ease((t - 0.18) / 0.78) : 1;
    } else {
      const model = models[FILES.indexOf(a.id)];
      model.position.y = 0.18 * (1 - ease(t / 0.76));
      const squash = Math.sin(Math.PI * clamp((t - 0.54) / 0.38)) * 0.07;
      model.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    }
    const duration = a.id === "macarico" ? 1.2 : a.id === "mussarela" ? 1.1 : 0.94;
    if (t >= duration) {
      animation.current = null;
      pao.position.y = 0; pao.scale.set(1, 1, 1);
      for (const model of [pasta, costela, creme, mussarela]) { model.position.y = 0; model.scale.set(1, 1, 1); }
      if (tampa && a.id === "mussarela") tampa.rotation.x = 0;
      macarico.position.set(0, 0, 0); macarico.rotation.z = 0;
      if (chama) chama.visible = false;
      clip.constant = 1;
      finish.current();
    }
  });

  return <>
    <primitive object={tabua} />
    <primitive object={pao} />
    <primitive object={pasta} />
    <primitive object={costela} />
    <primitive object={creme} />
    <primitive object={mussarela} />
    <primitive object={gratinado} />
    <primitive object={macarico} />
    {destacado && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}><ringGeometry args={[0.145, 0.16, 64]} /><meshBasicMaterial color="#ffd37d" transparent opacity={0.55} depthWrite={false} /></mesh>}
  </>;
}

// Default view: 3/4 elevation aimed at the bread (not the board). Orbit limits are relative to it.
const DIST = new Vector3(0.19, 0.35, 0.63);
const AZIMUTE0 = Math.atan2(DIST.x, DIST.z);
const GIRO = MathUtils.degToRad(35);
const ELEVACAO = [MathUtils.degToRad(20), MathUtils.degToRad(65)] as const;
const ZOOM = [0.7, 1.6] as const;
const OCIOSO = 3;
const VOLTA = 0.8;
// Bread with the lid open (x ±0.15, z -0.12..0.052, up to ~0.15 m): its projection is the drop zone.
const PAO = new Box3(new Vector3(-0.15, 0, -0.12), new Vector3(0.15, 0.15, 0.052));
// The projected box (lid open) is generous; trim it a little so the drop zone stays on the bread.
const FOLGA = 0.92;
const POUSO = new Vector3(0, 0.04, 0);
// Where the scene sits inside the shell (same fractions as the wrapper style below).
const CANTO = { retrato: { top: 0.36, altura: 0.46 }, paisagem: { top: 0.11, altura: 0.89 } } as const;

export type ZonaCena = { orientacao: Props["orientacao"]; pao: Ponto; raio: Ponto; pouso: Ponto };
type Props = {
  estado: EstadoBancada; orientacao: "retrato" | "paisagem"; destacado: boolean; aoTerminar: () => void;
  bloqueado?: boolean; aoMudarZona?: (zona: ZonaCena) => void;
};

function Camera({ orientacao, terminou, bloqueado, aoMudarZona, voltar }: { orientacao: Props["orientacao"]; terminou: boolean; bloqueado: boolean; aoMudarZona?: Props["aoMudarZona"]; voltar: MutableRefObject<() => void> }) {
  const { camera, size } = useThree();
  const controles = useRef<ElementRef<typeof OrbitControls>>(null);
  const retrato = orientacao === "retrato";
  const alvoY = retrato ? 0.10 : 0.07;
  // R3F sets the ortho frustum in CSS pixels; zoom converts to world meters.
  // Landscape: the canvas spans the whole shell and shows 0.66 m, so the bread is ~65-66% of the left column.
  const zoomPadrao = size.width / (retrato ? 0.48 : 0.66);
  const padrao = useRef({ zoom: zoomPadrao, alvo: new Vector3(0, alvoY, 0) });
  padrao.current.zoom = zoomPadrao; padrao.current.alvo.set(0, alvoY, 0);
  const ultima = useRef(performance.now() / 1000);
  const ativo = useRef(false);
  const volta = useRef<{ t: number; de: Spherical; zoom: number } | null>(null);
  const ultimaZona = useRef<number[]>([]);
  const larguraAnterior = useRef(0);

  // Initial / orientation change: back to the default view.
  useLayoutEffect(() => {
    camera.position.set(0, alvoY, 0).add(DIST);
    camera.lookAt(0, alvoY, 0);
    camera.zoom = padrao.current.zoom;
    larguraAnterior.current = size.width;
    volta.current = null;
    controles.current?.target.set(0, alvoY, 0);
    controles.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, orientacao]);

  // Resize: keep the user's view, only rescale the zoom with the width.
  useLayoutEffect(() => {
    if (larguraAnterior.current && larguraAnterior.current !== size.width) camera.zoom *= size.width / larguraAnterior.current;
    larguraAnterior.current = size.width;
    if (retrato) {
      // Once finished, lift the snack ~36 shell units so the final card sits below it.
      if (terminou) camera.setViewOffset(size.width, size.height, 0, 0.135 * size.height, size.width, size.height);
      else camera.clearViewOffset();
    } else {
      // Slide the view so the bread sits in the left column (0-67% of the shell), between the buttons and the bottom.
      camera.setViewOffset(size.width, size.height, 0.1726 * size.width, -0.0653 * size.height, size.width, size.height);
    }
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, retrato, terminou]);

  const iniciarVolta = useMemo(() => () => {
    const c = controles.current;
    if (!c) return;
    const de = new Spherical().setFromVector3(camera.position.clone().sub(c.target));
    volta.current = { t: 0, de, zoom: camera.zoom };
  }, [camera]);
  voltar.current = iniciarVolta;

  useFrame((_, delta) => {
    const c = controles.current;
    if (!c) return;
    const agora = performance.now() / 1000;
    const { zoom, alvo } = padrao.current;
    if (bloqueado || ativo.current) ultima.current = agora;
    const v = volta.current;
    if (v) {
      v.t += delta / VOLTA;
      const k = ease(v.t);
      const para = new Spherical().setFromVector3(DIST);
      const s = new Spherical(MathUtils.lerp(v.de.radius, para.radius, k), MathUtils.lerp(v.de.phi, para.phi, k), MathUtils.lerp(v.de.theta, para.theta, k));
      camera.position.copy(alvo).add(new Vector3().setFromSpherical(s));
      camera.zoom = MathUtils.lerp(v.zoom, zoom, k);
      camera.updateProjectionMatrix();
      c.update();
      if (v.t >= 1) volta.current = null;
    } else if (agora - ultima.current > OCIOSO) {
      const fora = camera.position.distanceTo(new Vector3().copy(alvo).add(DIST)) > 1e-3 || Math.abs(camera.zoom - zoom) > 1e-3 * zoom;
      if (fora) iniciarVolta(); else ultima.current = agora;
    }
    // Project the bread to shell units for the drop zone / flight target.
    if (!aoMudarZona) return;
    const L = layouts[orientacao], q = CANTO[orientacao];
    const aShell = (p: Vector3): Ponto => {
      const n = p.clone().project(camera);
      return { x: (n.x + 1) / 2 * L.largura, y: (q.top + (1 - n.y) / 2 * q.altura) * L.altura };
    };
    const xs: number[] = [], ys: number[] = [];
    for (const x of [PAO.min.x, PAO.max.x]) for (const y of [PAO.min.y, PAO.max.y]) for (const z of [PAO.min.z, PAO.max.z]) {
      const p = aShell(new Vector3(x, y, z)); xs.push(p.x); ys.push(p.y);
    }
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pouso = aShell(POUSO);
    const atual = [x0, x1, y0, y1, pouso.x, pouso.y];
    const antiga = ultimaZona.current;
    if (antiga.length && atual.every((n, i) => Math.abs(n - antiga[i]) < 0.05)) return;
    ultimaZona.current = atual;
    aoMudarZona({ orientacao, pao: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, raio: { x: (x1 - x0) / 2 * FOLGA, y: (y1 - y0) / 2 * FOLGA }, pouso });
  });

  return <OrbitControls ref={controles} makeDefault enabled={!bloqueado} enablePan={false} enableDamping dampingFactor={0.1}
    enableRotate enableZoom
    target={[0, alvoY, 0]}
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

export default function CenaBancada3D({ estado, orientacao, destacado, aoTerminar, bloqueado = false, aoMudarZona }: Props) {
  const voltar = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (failed && estado.animando) aoTerminar();
  }, [failed, estado.animando, aoTerminar]);

  const camera = useMemo(() => ({ position: [0.19, 0.48, 0.63] as [number, number, number], near: 0.01, far: 4 }), []);
  return <div className="absolute overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#33231d,#1a1210)]" style={orientacao === "retrato" ? { left: 0, top: "36%", width: "100%", height: "46%" } : { left: 0, top: "11%", width: "100%", height: "89%" }}>
    {(!ready || failed) && <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: "url('/assets/bancada/lanche-pronto.webp')" }} aria-hidden="true" />}
    {failed ? null : <Canvas className="relative" dpr={[1, 2]} camera={camera} orthographic shadows="percentage" style={{ touchAction: "none" }} onCreated={({ gl }) => {
      gl.domElement.addEventListener("webglcontextlost", () => setFailed(true), { once: true });
    }}>
      <Camera orientacao={orientacao} terminou={estado.passoAtual >= 6} bloqueado={bloqueado} aoMudarZona={aoMudarZona} voltar={voltar} />
      <color attach="background" args={["#241914"]} />
      <ambientLight intensity={1.8} color="#fff0dc" />
      <directionalLight position={[-0.3, 0.8, 0.48]} intensity={3.1} color="#ffe0b0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.00015} shadow-radius={4} />
      <pointLight position={[0.33, 0.2, -0.2]} intensity={0.8} color="#ff8b43" />
      <Suspense fallback={null}><Modelos estado={estado} destacado={destacado} aoTerminar={aoTerminar} /><Pronto onReady={() => setReady(true)} /></Suspense>
      <ContactShadows position={[0, -0.036, 0]} opacity={0.35} scale={1.2} blur={2.5} far={0.2} color="#130c09" />
    </Canvas>}
    {!failed && <button type="button" onClick={() => voltar.current()} className={`absolute right-2 z-30 ${orientacao === "retrato" && estado.passoAtual >= 6 ? "top-2" : "bottom-2"} flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-[#e4b684] bg-[#37251f]/90 px-3 font-sans text-[11px] font-bold text-osso sm:text-sm`}><span aria-hidden="true">⟲</span> Ver de frente</button>}
  </div>;
}
