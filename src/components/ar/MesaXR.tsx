"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, PerspectiveCamera } from "three";
import { SessaoMesa, type EstadoAR } from "./sessao";

export type ModoMesa = {
  estado: EstadoAR;
  overlay: RefObject<HTMLDivElement | null>;
  gestos: RefObject<HTMLDivElement | null>;
  sessao: MutableRefObject<SessaoMesa | null>;
  aoEstado: (e: EstadoAR) => void;
  aoDisponivel: () => void;
  zoom: number; giro: number; aoZoom: (v: number) => void;
};

/** A mesma cena e as mesmas animações permanecem montadas ao trocar de ambiente. */
export default function MesaXR({ modo, children }: { modo: ModoMesa; children: ReactNode }) {
  const { gl, camera } = useThree();
  const origem = useRef<Group>(null), reticulo = useRef<Mesh>(null);
  const estado = useRef(modo); estado.current = modo;
  const emAR = modo.estado.fase !== "3d" && modo.estado.fase !== "iniciando";
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
    <group ref={origem}><group scale={emAR ? modo.zoom : 1} rotation={[0, emAR ? modo.giro : 0, 0]} position={[0, emAR ? 0.028 : 0, 0]}>{children}</group></group>
  </>;
}
