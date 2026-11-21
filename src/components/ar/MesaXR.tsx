"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry } from "three";
import { SessaoMesa, type EstadoAR } from "./sessao";
import { eBack } from "../bancada-proto/acoes";

export type ModoMesa = {
  estado: EstadoAR;
  overlay: RefObject<HTMLDivElement | null>;
  gestos: RefObject<HTMLDivElement | null>;
  sessao: MutableRefObject<SessaoMesa | null>;
  aoEstado: (e: EstadoAR) => void;
  aoDisponivel: () => void;
  zoom: number; giro: number; aoZoom: (v: number) => void;
};

/** Tábua da bancada no espaço da cena (x de -0,21 a 0,33 com o cabo; z ±0,15), para a sombra dela na mesa. */
const TABUA = { x: 0.06, largura: 0.54, profundidade: 0.3 };
/** Duração da entrada do conjunto na mesa (s). */
const ENTRADA_S = 0.6;

/**
 * Sombra de contato barata da tábua na mesa real: uma mancha macia num plano, sem outra passada de render dentro
 * da sessão AR (a ContactShadows da bancada fica desligada na câmera). Sem ela o conjunto parece flutuar.
 */
function sombraNaMesa() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,.75)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const textura = new CanvasTexture(canvas);
  const material = new MeshBasicMaterial({ map: textura, transparent: true, opacity: 0, depthWrite: false, color: "#000" });
  const sombra = new Mesh(new PlaneGeometry(1, 1), material);
  sombra.rotation.x = -Math.PI / 2;
  sombra.scale.set(TABUA.largura + 0.08, TABUA.profundidade + 0.08, 1);
  sombra.position.set(TABUA.x, 0.0006, 0);
  sombra.renderOrder = -1;
  sombra.name = "sombra_na_mesa";
  return { sombra, material, descartar: () => { textura.dispose(); material.dispose(); sombra.geometry.dispose(); } };
}

/** A mesma cena e as mesmas animações permanecem montadas ao trocar de ambiente. */
export default function MesaXR({ modo, children }: { modo: ModoMesa; children: ReactNode }) {
  const { gl, camera } = useThree();
  const origem = useRef<Group>(null), reticulo = useRef<Mesh>(null);
  const estado = useRef(modo); estado.current = modo;
  const emAR = modo.estado.fase !== "3d" && modo.estado.fase !== "iniciando";
  // Entrada: ao posicionar, o conjunto desce uns centímetros e cresce até o tamanho real com um assentar macio,
  // e a sombra aparece junto, em vez de surgir de uma vez. Movimento reduzido: aparece direto.
  const entrada = useRef<Group>(null);
  const anim = useRef({ t: 1 });
  const fase = modo.estado.fase;
  const posta = fase === "ajustando" || fase === "colocado";
  const postaAntes = useRef(posta);
  useEffect(() => {
    if (posta && !postaAntes.current) {
      const reduzido = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      anim.current.t = reduzido ? 1 : 0;
    }
    postaAntes.current = posta;
  }, [posta]);
  const sombra = useMemo(() => sombraNaMesa(), []);
  useEffect(() => () => sombra.descartar(), [sombra]);
  useFrame((_, delta) => {
    const g = entrada.current;
    if (!g) return;
    const a = anim.current;
    if (!emAR) { if (a.t < 1 || g.scale.x !== 1) { a.t = 1; g.scale.setScalar(1); g.position.y = 0; } return; }
    if (a.t < 1) a.t = Math.min(1, a.t + Math.min(delta, 0.05) / ENTRADA_S);
    const k = a.t;
    // cresce de 60% com um leve passar do ponto (~2%) e volta; desce de 4 cm desacelerando
    const s = 1 - Math.pow(1 - k, 3);
    g.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * eBack(k, 0.6)));
    g.position.y = 0.04 * (1 - s);
    sombra.material.opacity = 0.5 * s;
  });
  useEffect(() => {
    if (!origem.current || !reticulo.current || !modo.overlay.current) return;
    const controle = new SessaoMesa(gl, modo.overlay.current, origem.current, reticulo.current, (e) => estado.current.aoEstado(e));
    modo.sessao.current = controle;
    estado.current.aoDisponivel();
    return () => { modo.sessao.current = null; controle.destruir(); };
  }, [gl, modo.overlay, modo.sessao]);
  useEffect(() => {
    gl.setClearColor(0x120c09, emAR ? 0 : 1);
    if (camera instanceof PerspectiveCamera && emAR) camera.clearViewOffset();
  }, [emAR, gl, camera]);
  useEffect(() => {
    if (!emAR || !modo.gestos.current) return;
    const alvo = modo.gestos.current, pontos = new Map<number, { x: number; y: number }>();
    let inicio = 0, zoom = 1;
    const distancia = () => { const [a, b] = [...pontos.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      pontos.set(e.pointerId, { x: e.clientX, y: e.clientY }); alvo.setPointerCapture(e.pointerId);
      if (pontos.size === 2) { inicio = distancia(); zoom = estado.current.zoom; }
    };
    const move = (e: PointerEvent) => {
      if (!pontos.has(e.pointerId)) return;
      pontos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pontos.size === 2 && inicio > 0) { e.preventDefault(); estado.current.aoZoom(zoom * distancia() / inicio); }
    };
    const up = (e: PointerEvent) => { pontos.delete(e.pointerId); inicio = 0; };
    alvo.addEventListener("pointerdown", down); alvo.addEventListener("pointermove", move);
    alvo.addEventListener("pointerup", up); alvo.addEventListener("pointercancel", up); alvo.addEventListener("lostpointercapture", up);
    return () => {
      alvo.removeEventListener("pointerdown", down); alvo.removeEventListener("pointermove", move);
      alvo.removeEventListener("pointerup", up); alvo.removeEventListener("pointercancel", up); alvo.removeEventListener("lostpointercapture", up);
    };
  }, [emAR, modo.gestos]);
  useFrame((_, __, frame) => modo.sessao.current?.atualizar(frame), -1);
  return <>
    <mesh ref={reticulo} matrixAutoUpdate={false} visible={false}>
      <ringGeometry args={[0.085, 0.1, 48]} onUpdate={(g) => { g.rotateX(-Math.PI / 2); }} />
      <meshBasicMaterial color="#ffc66a" depthTest={false} transparent opacity={0.9} />
    </mesh>
    <group ref={origem}><group ref={entrada}><group scale={emAR ? modo.zoom : 1} rotation={[0, emAR ? modo.giro : 0, 0]} position={[0, emAR ? 0.028 * modo.zoom : 0, 0]}>
      {children}
      {/* a sombra fica no fundo da tábua (MESA = -0,028), que encosta no ponto da mesa real */}
      {emAR && <primitive object={sombra.sombra} position-y={-0.028 + 0.0006} dispose={null} />}
    </group></group></group>
  </>;
}
