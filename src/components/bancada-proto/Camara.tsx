"use client";

// Câmera da bancada: enquadramento padrão por arranjo (layout.ts) e órbita limitada em volta do alvo.
// Gestos no próprio canvas (só chegam aqui os toques em área vazia: estações, potinhos, bebidas e porções são botões
// do HUD por cima): arrastar gira, pinça e roda dão zoom, setas e +/- no teclado com o foco na cena. Volta sozinha
// para a padrão depois de ORBITA.ocioso segundos sem tocar, ou quando uma ação começa fora do quadro.
import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { Medidas } from "./acoes";
import { CAMERAS, ORBITA, enquadrar, type Arranjo } from "./layout";

export type ApiCamara = {
  /** Volta para a câmera padrão. */
  centralizar: () => void;
  /** Volta para a padrão se algum destes pontos (mundo) estiver fora do quadro atual. */
  garantir: (pontos: Vector3[]) => void;
};
type Orb = { az: number; pol: number; zoom: number };

const RAD = Math.PI / 180;
const igual = (a: Orb, b: Orb) => Math.abs(a.az - b.az) < 0.004 && Math.abs(a.pol - b.pol) < 0.004 && Math.abs(a.zoom - b.zoom) < 0.004;

/** `?cam=az,pol,dist` (graus de giro, graus de inclinação polar absoluta, fator da distância; vazio = padrão). */
function camDaUrl(): { az?: number; pol?: number; zoom?: number } | null {
  if (typeof window === "undefined") return null;
  const c = new URLSearchParams(window.location.search).get("cam");
  if (!c) return null;
  const [az, pol, z] = c.split(",").map((s) => (s.trim() === "" ? undefined : Number(s)));
  return { az: Number.isFinite(az) ? az : undefined, pol: Number.isFinite(pol) ? pol : undefined, zoom: Number.isFinite(z) ? z : undefined };
}

export default function Camara({ arranjo, M, travada, reduzido, api, aoFora, segurando }: {
  arranjo: Arranjo; M: Medidas;
  /** Uma ferramenta está sendo arrastada (conta como mexer: a câmera não volta no meio do arraste). */
  segurando: () => boolean;
  /** QA (`?congelar=`): câmera padrão fixa. */
  travada: boolean; reduzido: boolean;
  api: MutableRefObject<ApiCamara | null>;
  aoFora: (fora: boolean) => void;
}) {
  const { camera, size, gl } = useThree();
  const cam = camera as PerspectiveCamera;
  const S = useRef({
    pol0: 0, dist0: 1, alvo: new Vector3(),
    alvoOrb: { az: 0, pol: 0, zoom: 1 } as Orb, // para onde a câmera vai (o gesto mexe aqui)
    orb: { az: 0, pol: 0, zoom: 1 } as Orb, // onde ela está (amortecida)
    volta: null as null | { t: number; de: Orb },
    ultimo: 0, ptrs: new Map<number, { x: number; y: number }>(), pinca: 0, zoomPinca: 1,
    fora: false, forcada: null as ReturnType<typeof camDaUrl>,
  });
  const opts = useRef({ travada, reduzido }); opts.current = { travada, reduzido };
  const fora = useRef(aoFora); fora.current = aoFora;
  const seg = useRef(segurando); seg.current = segurando;

  // enquadramento padrão (por arranjo e tamanho da tela); o giro do usuário fica
  useLayoutEffect(() => {
    const c = CAMERAS[arranjo];
    const s = S.current;
    const { fov, dist } = enquadrar(c, size.width, size.height);
    s.alvo.set(...c.alvo);
    const dir = new Vector3(...c.pos).sub(s.alvo).normalize();
    s.pol0 = Math.acos(dir.y);
    s.dist0 = dist;
    cam.fov = fov; cam.near = 0.05; cam.far = 12;
    cam.layers.enable(1);
    cam.setViewOffset(size.width, size.height, 0, -c.desce * size.height, size.width, size.height);
    cam.updateProjectionMatrix();
    // a mão entra e sai pela direita, fora do quadro padrão
    const meia = dist * Math.tan((fov * Math.PI) / 360) * (size.width / size.height);
    M.fora.set(meia + 0.38, 0.16, 0.1);
    s.forcada = camDaUrl();
  }, [cam, size, arranjo, M]);

  const limitar = (o: Orb) => {
    const az = ORBITA.azimute * RAD;
    o.az = MathUtils.clamp(o.az, -az, az);
    o.pol = MathUtils.clamp(o.pol, ORBITA.inclinacao[0] * RAD, ORBITA.inclinacao[1] * RAD);
    o.zoom = MathUtils.clamp(o.zoom, ORBITA.zoom[0], ORBITA.zoom[1]);
    return o;
  };
  const tocou = () => { const s = S.current; s.ultimo = performance.now() / 1000; s.volta = null; };
  const centralizar = () => {
    const s = S.current;
    if (opts.current.reduzido) { s.alvoOrb = { az: 0, pol: 0, zoom: 1 }; s.orb = { az: 0, pol: 0, zoom: 1 }; s.volta = null; return; }
    s.volta = { t: 0, de: { ...s.orb } };
  };

  useEffect(() => {
    api.current = {
      centralizar,
      garantir(pontos) {
        const s = S.current;
        if (igual(s.orb, { az: 0, pol: 0, zoom: 1 }) || s.volta) return;
        camera.updateMatrixWorld();
        const v = new Vector3();
        const escondido = pontos.some((p) => { v.copy(p).project(camera); return Math.abs(v.x) > 0.94 || Math.abs(v.y) > 0.94 || v.z > 1; });
        if (escondido) centralizar();
      },
    };
    return () => { api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // gestos no canvas
  useEffect(() => {
    const el = gl.domElement;
    el.tabIndex = 0;
    el.setAttribute("role", "application");
    el.setAttribute("aria-label", "Cozinha 3D. Arraste para girar a câmera; setas giram e + ou - dão zoom.");
    const s = S.current;
    const livre = () => !opts.current.travada && !s.forcada;
    const down = (e: PointerEvent) => {
      if (!livre() || (e.pointerType === "mouse" && e.button !== 0)) return;
      el.setPointerCapture(e.pointerId);
      s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (s.ptrs.size === 2) { const [a, b] = [...s.ptrs.values()]; s.pinca = Math.hypot(a.x - b.x, a.y - b.y); s.zoomPinca = s.alvoOrb.zoom; }
      tocou();
    };
    const move = (e: PointerEvent) => {
      const p = s.ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (s.ptrs.size === 1) {
        // a largura toda da tela = 120° de giro; arrastar para a direita traz a cena junto (a câmera vai para a esquerda)
        const k = (120 * RAD) / Math.max(320, el.clientWidth);
        s.alvoOrb.az -= dx * k;
        s.alvoOrb.pol -= dy * k * 0.7;
      } else if (s.ptrs.size === 2 && s.pinca > 0) {
        const [a, b] = [...s.ptrs.values()];
        s.alvoOrb.zoom = s.zoomPinca * (s.pinca / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)));
      }
      limitar(s.alvoOrb);
      tocou();
    };
    const up = (e: PointerEvent) => {
      if (!s.ptrs.delete(e.pointerId)) return;
      s.pinca = 0;
      tocou();
    };
    const roda = (e: WheelEvent) => {
      if (!livre()) return;
      e.preventDefault();
      s.alvoOrb.zoom *= Math.exp(MathUtils.clamp(e.deltaY, -120, 120) * 0.0016);
      limitar(s.alvoOrb);
      tocou();
    };
    const tecla = (e: KeyboardEvent) => {
      if (!livre()) return;
      const o = s.alvoOrb;
      const passo = 6 * RAD;
      if (e.key === "ArrowLeft") o.az -= passo;
      else if (e.key === "ArrowRight") o.az += passo;
      else if (e.key === "ArrowUp") o.pol -= passo * 0.6;
      else if (e.key === "ArrowDown") o.pol += passo * 0.6;
      else if (e.key === "+" || e.key === "=") o.zoom *= 0.92;
      else if (e.key === "-" || e.key === "_") o.zoom /= 0.92;
      else return;
      e.preventDefault();
      limitar(o);
      tocou();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("wheel", roda, { passive: false });
    el.addEventListener("keydown", tecla);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", up);
      el.removeEventListener("wheel", roda);
      el.removeEventListener("keydown", tecla);
    };
  }, [gl]);

  const dir = useRef(new Vector3());
  useFrame((_, delta) => {
    const s = S.current;
    const dt = Math.min(delta, 0.1);
    const agora = performance.now() / 1000;
    if (seg.current()) s.ultimo = agora;
    const zero: Orb = { az: 0, pol: 0, zoom: 1 };
    if (opts.current.travada) { s.alvoOrb = { ...zero }; s.orb = { ...zero }; s.volta = null; }
    else if (s.forcada) {
      const f = s.forcada;
      s.orb = limitar({ az: (f.az ?? 0) * RAD, pol: f.pol !== undefined ? f.pol * RAD - s.pol0 : 0, zoom: f.zoom ?? 1 });
      s.alvoOrb = { ...s.orb }; s.volta = null;
    } else if (s.volta) {
      const v = s.volta;
      v.t += Math.min(delta, 0.3) / ORBITA.volta; // tempo real: em aparelho lento a volta não se arrasta
      const t = Math.min(1, v.t);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // começa e termina macio
      s.orb = { az: MathUtils.lerp(v.de.az, 0, e), pol: MathUtils.lerp(v.de.pol, 0, e), zoom: MathUtils.lerp(v.de.zoom, 1, e) };
      s.alvoOrb = { ...s.orb };
      if (v.t >= 1) { s.volta = null; s.orb = { ...zero }; s.alvoOrb = { ...zero }; }
    } else {
      // amortecimento: a câmera persegue o alvo do gesto
      const k = 1 - Math.exp(-dt * 14);
      s.orb.az += (s.alvoOrb.az - s.orb.az) * k;
      s.orb.pol += (s.alvoOrb.pol - s.orb.pol) * k;
      s.orb.zoom += (s.alvoOrb.zoom - s.orb.zoom) * k;
      if (s.ptrs.size === 0 && agora - s.ultimo > ORBITA.ocioso && !igual(s.alvoOrb, zero)) centralizar();
    }
    const pol = s.pol0 + s.orb.pol, dist = s.dist0 * s.orb.zoom;
    dir.current.setFromSphericalCoords(dist, pol, s.orb.az);
    cam.position.copy(s.alvo).add(dir.current);
    cam.lookAt(s.alvo);
    const f = !igual(s.orb, zero) || !igual(s.alvoOrb, zero);
    if (f !== s.fora) { s.fora = f; fora.current(f); }
    (window as unknown as { __protoCam: { az: number; pol: number; dist: number } }).__protoCam = {
      az: Math.round((s.orb.az / RAD) * 10) / 10, pol: Math.round((pol / RAD) * 10) / 10, dist: Math.round(s.orb.zoom * 1000) / 1000,
    };
  });
  return null;
}
