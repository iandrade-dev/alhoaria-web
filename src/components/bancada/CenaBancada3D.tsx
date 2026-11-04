"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import { MathUtils, Mesh, Plane, Vector3, type Material } from "three";
import type { EstadoBancada, PassoId } from "./passos";

const ROOT = "/assets/models/bancada/";
const FILES = ["tabua", "pao", "pasta", "costela", "creme", "mussarela", "gratinado", "macarico"] as const;
const OPEN = -1.9199;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);

useGLTF.setDecoderPath("/draco/");
FILES.forEach((file) => useGLTF.preload(`${ROOT}${file}.glb`));

type Props = { estado: EstadoBancada; orientacao: "retrato" | "paisagem"; destacado: boolean; aoTerminar: () => void };
type Animation = { id: PassoId; elapsed: number };

function Modelos({ estado, destacado, aoTerminar }: Omit<Props, "orientacao">) {
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

function Enquadramento({ orientacao }: { orientacao: Props["orientacao"] }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    // Keep the same 3/4 elevation while aiming at the bread, not the board.
    const alvoY = orientacao === "retrato" ? 0.10 : 0.17;
    camera.position.set(0.19, alvoY + 0.35, 0.63);
    camera.lookAt(0, alvoY, 0);
    // R3F sets the ortho frustum in CSS pixels; zoom converts to world meters.
    // The open lid spans ~70% / ~61% of the portrait / landscape canvas.
    camera.zoom = size.width / (orientacao === "retrato" ? 0.48 : 0.56);
    camera.updateProjectionMatrix();
  }, [camera, size.width, orientacao]);
  return null;
}

function Pronto({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

export default function CenaBancada3D({ estado, orientacao, destacado, aoTerminar }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (failed && estado.animando) aoTerminar();
  }, [failed, estado.animando, aoTerminar]);

  const camera = useMemo(() => ({ position: [0.19, 0.48, 0.63] as [number, number, number], near: 0.01, far: 4 }), []);
  return <div className="absolute overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#33231d,#1a1210)]" style={orientacao === "retrato" ? { left: 0, top: "36%", width: "100%", height: "46%" } : { left: 0, top: "11%", width: "67%", height: "89%" }}>
    {(!ready || failed) && <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: "url('/assets/bancada/lanche-pronto.webp')" }} aria-hidden="true" />}
    {failed ? null : <Canvas className="relative" dpr={[1, 2]} camera={camera} orthographic shadows="percentage" onCreated={({ gl }) => {
      gl.domElement.addEventListener("webglcontextlost", () => setFailed(true), { once: true });
    }}>
      <Enquadramento orientacao={orientacao} />
      <color attach="background" args={["#241914"]} />
      <ambientLight intensity={1.8} color="#fff0dc" />
      <directionalLight position={[-0.3, 0.8, 0.48]} intensity={3.1} color="#ffe0b0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.00015} shadow-radius={4} />
      <pointLight position={[0.33, 0.2, -0.2]} intensity={0.8} color="#ff8b43" />
      <Suspense fallback={null}><Modelos estado={estado} destacado={destacado} aoTerminar={aoTerminar} /><Pronto onReady={() => setReady(true)} /></Suspense>
      <ContactShadows position={[0, -0.036, 0]} opacity={0.35} scale={1.2} blur={2.5} far={0.2} color="#130c09" />
    </Canvas>}
  </div>;
}
