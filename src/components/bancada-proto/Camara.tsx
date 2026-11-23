"use client";

// Câmera da bancada: enquadramento padrão por arranjo (layout.ts) e órbita limitada em volta do alvo.
// Gestos no próprio canvas (só chegam aqui os toques em área vazia: estações, potinhos, bebidas e porções são botões
// do HUD por cima): arrastar gira, pinça e roda dão zoom, setas e +/- no teclado com o foco na cena. Volta sozinha
// para a padrão depois de ORBITA.ocioso segundos sem tocar, ou quando uma ação começa fora do quadro.
import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import {
  atualizarOrbita, centralizarOrbita, criarOrbita, escutarGestosOrbita, lerOrbitaDaUrl, orbitaFora, RADIANOS_POR_GRAU as RAD,
} from "@cardapios/bancada-3d";
import type { Medidas } from "./acoes";
import { CAMERAS, CAMERAS_PRONTO, ORBITA, enquadrar, type Arranjo } from "./layout";

export type ApiCamara = {
  /** Volta para a câmera padrão. */
  centralizar: () => void;
  /** Volta para a padrão se algum destes pontos (mundo) estiver fora do quadro atual. */
  garantir: (pontos: Vector3[]) => void;
};

export default function Camara({ arranjo, M, travada, reduzido, api, aoFora, segurando, destaque = false }: {
  arranjo: Arranjo; M: Medidas;
  /** Lanche pronto: a câmera desliza para perto e mais baixa (CAMERAS_PRONTO) e balança devagar enquanto ninguém mexe. */
  destaque?: boolean;
  /** Uma ferramenta está sendo arrastada (conta como mexer: a câmera não volta no meio do arraste). */
  segurando: () => boolean;
  /** QA (`?congelar=`): câmera padrão fixa. */
  travada: boolean; reduzido: boolean;
  api: MutableRefObject<ApiCamara | null>;
  aoFora: (fora: boolean) => void;
}) {
  const { camera, size, gl } = useThree();
  const cam = camera as PerspectiveCamera;
  const orbitaRef = useRef<ReturnType<typeof criarOrbita> | null>(null);
  if (orbitaRef.current === null) orbitaRef.current = criarOrbita(ORBITA);
  const orbita = orbitaRef.current;
  const S = useRef({
    pol0: 0, dist0: 1, alvo: new Vector3(),
    fora: false,
    // Enquadramento para onde a câmera vai; ela chega lá deslizando (em vez de cortar) quando muda o destaque.
    quadro: null as null | { alvo: Vector3; pol0: number; dist0: number; fov: number; desce: number },
    desce: 0, chave: "",
    // balanço lento do destaque: peso (0..1, amortecido) e fase (s)
    balanco: 0, faseBalanco: 0,
  });
  const opts = useRef({ travada, reduzido, destaque }); opts.current = { travada, reduzido, destaque };
  const fora = useRef(aoFora); fora.current = aoFora;
  const seg = useRef(segurando); seg.current = segurando;

  // enquadramento padrão (por arranjo e tamanho da tela); o giro do usuário fica
  useLayoutEffect(() => {
    const padrao = CAMERAS[arranjo];
    const c = destaque ? CAMERAS_PRONTO[arranjo] : padrao;
    const s = S.current;
    const { fov, dist } = enquadrar(c, size.width, size.height);
    const alvo = new Vector3(...c.alvo);
    s.quadro = { alvo, pol0: Math.acos(new Vector3(...c.pos).sub(alvo).normalize().y), dist0: dist, fov, desce: c.desce };
    cam.near = 0.05; cam.far = 12;
    cam.layers.enable(1);
    // Primeira vez, tela que mudou de tamanho/arranjo ou movimento reduzido: vale na hora. Destaque: desliza.
    const chave = `${size.width}x${size.height}:${arranjo}`;
    if (s.chave !== chave || reduzido) {
      s.chave = chave;
      s.alvo.copy(alvo); s.pol0 = s.quadro.pol0; s.dist0 = dist; s.desce = c.desce; cam.fov = fov;
      cam.setViewOffset(size.width, size.height, 0, -s.desce * size.height, size.width, size.height);
      cam.updateProjectionMatrix();
    }
    // a mão entra e sai pela direita, fora do quadro padrão (o destaque não muda o caminho da mão)
    const p = destaque ? enquadrar(padrao, size.width, size.height) : { fov, dist };
    const meia = p.dist * Math.tan((p.fov * Math.PI) / 360) * (size.width / size.height);
    M.fora.set(meia + 0.38, 0.16, 0.1);
    orbita.forcada = lerOrbitaDaUrl(window.location.search);
  }, [cam, size, arranjo, M, destaque, reduzido, orbita]);

  useEffect(() => {
    const centralizar = () => centralizarOrbita(orbita, opts.current.reduzido);
    api.current = {
      centralizar,
      garantir(pontos) {
        if (!orbitaFora(orbita, false) || orbita.volta) return;
        camera.updateMatrixWorld();
        const v = new Vector3();
        const escondido = pontos.some((p) => { v.copy(p).project(camera); return Math.abs(v.x) > 0.94 || Math.abs(v.y) > 0.94 || v.z > 1; });
        if (escondido) centralizar();
      },
    };
    return () => { api.current = null; };
  }, [api, camera, orbita]);

  useEffect(() => escutarGestosOrbita(gl.domElement, orbita, () => opts.current.travada), [gl, orbita]);

  const dir = useRef(new Vector3());
  useFrame((_, delta) => {
    const s = S.current;
    const dt = Math.min(delta, 0.1);
    // desliza o enquadramento (alvo, inclinação, distância, fov e deslocamento do quadro) até o pedido
    const q = s.quadro;
    if (q) {
      const kq = opts.current.reduzido ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 3.2);
      s.alvo.lerp(q.alvo, kq); s.pol0 += (q.pol0 - s.pol0) * kq; s.dist0 += (q.dist0 - s.dist0) * kq;
      let mudou = false;
      if (Math.abs(q.fov - cam.fov) > 0.01) { cam.fov += (q.fov - cam.fov) * kq; mudou = true; }
      if (Math.abs(q.desce - s.desce) > 0.0004) { s.desce += (q.desce - s.desce) * kq; mudou = true; }
      if (mudou) {
        cam.setViewOffset(size.width, size.height, 0, -s.desce * size.height, size.width, size.height);
        cam.updateProjectionMatrix();
      }
    }
    const agora = performance.now() / 1000;
    atualizarOrbita(orbita, s.pol0, delta, agora, opts.current, seg.current());
    // destaque: balanço lento de ±7° em volta do lanche, só parado (sem toque recente) e sem movimento reduzido
    const balancar = opts.current.destaque && !opts.current.reduzido && !opts.current.travada && !orbita.forcada
      && orbita.ponteiros.size === 0 && agora - orbita.ultimo > 1.5;
    s.balanco += ((balancar ? 1 : 0) - s.balanco) * (1 - Math.exp(-dt * 1.4));
    if (s.balanco > 0.001) s.faseBalanco += dt; else s.faseBalanco = 0;
    const az = orbita.atual.az + s.balanco * 7 * RAD * Math.sin((s.faseBalanco * 2 * Math.PI) / 9);
    const pol = s.pol0 + orbita.atual.pol, dist = s.dist0 * orbita.atual.zoom;
    dir.current.setFromSphericalCoords(dist, pol, az);
    cam.position.copy(s.alvo).add(dir.current);
    cam.lookAt(s.alvo);
    const f = orbitaFora(orbita);
    if (f !== s.fora) { s.fora = f; fora.current(f); }
    (window as unknown as { __protoCam: { az: number; pol: number; dist: number } }).__protoCam = {
      az: Math.round((orbita.atual.az / RAD) * 10) / 10, pol: Math.round((pol / RAD) * 10) / 10, dist: Math.round(orbita.atual.zoom * 1000) / 1000,
    };
  });
  return null;
}
