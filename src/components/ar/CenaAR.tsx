"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from "three";
import { Ambiente, Mundo, type ApiCena, type Bus } from "../bancada-proto/Cena";
import { clonar } from "../bancada-proto/kit";
import type { Medidas } from "../bancada-proto/acoes";
import type { LancheDef } from "../bancada-proto/layout";
import type { ApiCamara } from "../bancada-proto/Camara";
import { SABORES_LATA, SABORES_SODA, type Bebida, type Opcoes, type PorcaoId } from "../bancada-proto/cardapio";
import { SessaoMesa, type EstadoAR } from "./sessao";

export type PropsCenaAR = {
  def: LancheDef; rodada: number; pronto: boolean; pausado: boolean; reduzido: boolean;
  ativo: string | null; opcoes: Opcoes | null; bebida: Bebida | null; porcao: PorcaoId | null;
  ar: EstadoAR; giro: number; painelAberto: boolean; overlay: RefObject<HTMLDivElement | null>;
  api: MutableRefObject<ApiCena | null>; sessao: MutableRefObject<SessaoMesa | null>;
  aoPronto: () => void; aoFim: (id: string) => void; aoEstadoAR: (e: EstadoAR) => void; aoFalhar: () => void;
};
const ignorar = () => {};
const mesa = [0, 0.06, 0] as [number, number, number];

export default function CenaAR(props: PropsCenaAR) {
  return <Canvas className="!absolute inset-0" frameloop="demand" dpr={[1, 1.5]}
    camera={{ position: [0.65, 0.65, 1.15], fov: 40, near: 0.025, far: 20 }}
    gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    style={{ touchAction: "none" }} onCreated={({ gl }) => {
      gl.setClearColor(0x000000, 0);
      gl.xr.enabled = true;
    }}>
    <Conteudo {...props} />
  </Canvas>;
}

function Conteudo(props: PropsCenaAR) {
  const { gl, camera, invalidate, size } = useThree();
  const origem = useRef<Group>(null);
  const reticulo = useRef<Mesh>(null);
  const bus = useRef<Bus>({ drag: { ativo: false, id: null, x: 0, y: 0 } });
  const camApi = useRef<ApiCamara | null>(null);
  const M = useMemo<Medidas>(() => ({ pasta: 0.05, costela: 0.08, creme: 0.085, muss: 0.1,
    fora: new Vector3(0.5, 0.16, 0.1), h: {}, p: {} }), [props.def.id, props.rodada]);
  const emAR = props.ar.fase !== "3d" && props.ar.fase !== "iniciando";
  const montando = !props.pronto && !props.pausado;
  const aoEstado = useRef(props.aoEstadoAR); aoEstado.current = props.aoEstadoAR;
  const aoFalhar = useRef(props.aoFalhar); aoFalhar.current = props.aoFalhar;

  useEffect(() => {
    if (!props.overlay.current || !origem.current || !reticulo.current) return;
    const controle = new SessaoMesa(gl, props.overlay.current, origem.current, reticulo.current, (e) => aoEstado.current(e));
    props.sessao.current = controle;
    return () => { props.sessao.current = null; controle.destruir(); };
  }, [gl, props.overlay, props.sessao]);
  useEffect(() => {
    const canvas = gl.domElement;
    const falhou = (e: Event) => { e.preventDefault(); void props.sessao.current?.sair(); aoFalhar.current(); };
    canvas.addEventListener("webglcontextlost", falhou);
    return () => canvas.removeEventListener("webglcontextlost", falhou);
  }, [gl, props.sessao]);
  useEffect(() => {
    if (emAR) { if (camera instanceof PerspectiveCamera) camera.clearViewOffset(); return; }
    const distancia = Math.max(1, 0.82 * size.height / size.width) * (props.pronto ? 1 : 1.12);
    camera.position.set(0.65, 0.65 - mesa[1], 1.15).multiplyScalar(distancia);
    camera.position.y += mesa[1]; camera.lookAt(...mesa);
    if (camera instanceof PerspectiveCamera) {
      camera.setViewOffset(size.width, size.height, 0, props.painelAberto && size.width <= 700 ? size.height * 0.18 : 0, size.width, size.height);
    }
    camera.updateProjectionMatrix(); invalidate();
  }, [emAR, camera, invalidate, size.width, size.height, props.pronto, props.painelAberto]);
  // Preview parado usa render sob demanda; WebXR mantém o laço nativo do aparelho.
  useEffect(() => invalidate(), [props, invalidate]);
  useFrame((_, __, frame) => {
    props.sessao.current?.atualizar(frame);
    if (montando) invalidate();
  }, -1);

  return <>
    <hemisphereLight args={["#fff1d8", "#654b38", 1.25]} />
    <ambientLight intensity={0.6} />
    <directionalLight position={[1, 2, 1.5]} intensity={2.4} color="#ffe1b5" />
    <directionalLight position={[-1, 1, -1]} intensity={0.8} color="#ffffff" />
    <Ambiente />
    {!emAR && <OrbitControls makeDefault target={mesa} minDistance={0.48} maxDistance={4.5}
      maxPolarAngle={Math.PI / 2.1} enablePan={false} enableDamping />}
    <mesh ref={reticulo} matrixAutoUpdate={false} visible={false}>
      <ringGeometry args={[0.085, 0.1, 48]} onUpdate={(g) => { g.rotateX(-Math.PI / 2); }} />
      <meshBasicMaterial color="#ffc66a" depthTest={false} transparent opacity={0.9} />
    </mesh>
    <group ref={origem}>
      <group rotation={[0, props.giro, 0]} position={[0, 0.028, 0]}>
        <Suspense fallback={null}>
          <Mundo key={`${props.def.id}:${props.rodada}`} def={props.def} arranjo="retrato" M={M}
            ativo={props.ativo} reduzido={props.reduzido} bus={bus} api={props.api}
            aoFim={props.aoFim} aoPronto={props.aoPronto} aoProjetar={ignorar} congelar={null}
            camApi={camApi} aoCamFora={ignorar} opcoes={props.opcoes}
            apresentacao={{ pronto: props.pronto, pausado: props.pausado }} />
        </Suspense>
        {props.bebida && <Suspense fallback={null}><Bebida3D bebida={props.bebida} /></Suspense>}
        {props.porcao && <Suspense fallback={null}><Peca arquivo={`porcao-${props.porcao}`} x={-0.25} /></Suspense>}
      </group>
    </group>
  </>;
}

function Bebida3D({ bebida }: { bebida: Bebida }) {
  const cor = bebida.id === "lata" ? SABORES_LATA[bebida.sabor].cor
    : bebida.id === "soda" ? SABORES_SODA[bebida.sabor].cor : undefined;
  return <Peca arquivo={`beb-${bebida.id}`} x={0.25} cor={cor} />;
}
function Peca({ arquivo, x, cor }: { arquivo: string; x: number; cor?: string }) {
  const { scene } = useGLTF(`/assets/models/bancada/${arquivo}.glb`);
  const peca = useMemo(() => clonar(scene), [scene]);
  useEffect(() => {
    peca.traverse((o) => {
      if (!(o instanceof Mesh) || !cor || !(o.material instanceof MeshStandardMaterial)) return;
      if (o.name.includes("lata_corpo") || o.name.includes("soda_liquido")) {
        o.material.map = null; o.material.vertexColors = false; o.material.color.set(cor); o.material.needsUpdate = true;
      }
    });
  }, [peca, cor]);
  useEffect(() => () => peca.traverse((o) => {
    if (o instanceof Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  }), [peca]);
  return <primitive object={peca} position={[x, -0.028, 0.12]} />;
}
