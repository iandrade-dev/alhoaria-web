import { MathUtils } from "three";

export const RADIANOS_POR_GRAU = Math.PI / 180;

type Posicao = { az: number; pol: number; zoom: number };
type Ponto = { x: number; y: number };
type Limites = {
  azimute: number;
  inclinacao: readonly [number, number];
  zoom: readonly [number, number];
  ocioso: number;
  volta: number;
};

type EstadoOrbita = {
  limites: Limites;
  alvo: Posicao;
  atual: Posicao;
  forcada: Partial<Posicao> | null;
  volta: { t: number; de: Posicao } | null;
  ultimo: number;
  ponteiros: Map<number, Ponto>;
  pinca: number;
  zoomPinca: number;
};

const PADRAO: Readonly<Posicao> = { az: 0, pol: 0, zoom: 1 };
const RAD = RADIANOS_POR_GRAU;

export function criarOrbita(limites: Limites): EstadoOrbita {
  return {
    limites,
    alvo: { ...PADRAO },
    atual: { ...PADRAO },
    forcada: null,
    volta: null,
    ultimo: 0,
    ponteiros: new Map(),
    pinca: 0,
    zoomPinca: 1,
  };
}

const noCentro = ({ az, pol, zoom }: Posicao) =>
  Math.abs(az) < 0.004 && Math.abs(pol) < 0.004 && Math.abs(zoom - 1) < 0.004;

export function orbitaFora(orbita: EstadoOrbita, incluirAlvo = true) {
  return !noCentro(orbita.atual) || (incluirAlvo && !noCentro(orbita.alvo));
}

/** Valores de ?cam=az,pol,dist em graus de giro, graus polares absolutos e fator da distância. */
export function lerOrbitaDaUrl(busca: string): Partial<Posicao> | null {
  const valores = new URLSearchParams(busca).get("cam");
  if (!valores) return null;
  const [az, pol, zoom] = valores.split(",").map((valor) => {
    const numero = valor.trim() === "" ? undefined : Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  });
  return { az, pol, zoom };
}

function limitar(limites: Limites, posicao: Posicao) {
  const az = limites.azimute * RAD;
  posicao.az = MathUtils.clamp(posicao.az, -az, az);
  posicao.pol = MathUtils.clamp(posicao.pol, limites.inclinacao[0] * RAD, limites.inclinacao[1] * RAD);
  posicao.zoom = MathUtils.clamp(posicao.zoom, limites.zoom[0], limites.zoom[1]);
}

function voltarAoPadrao(orbita: EstadoOrbita) {
  orbita.alvo = { ...PADRAO };
  orbita.atual = { ...PADRAO };
  orbita.volta = null;
}

export function centralizarOrbita(orbita: EstadoOrbita, reduzido: boolean) {
  if (reduzido) voltarAoPadrao(orbita);
  else orbita.volta = { t: 0, de: { ...orbita.atual } };
}

export function atualizarOrbita(
  orbita: EstadoOrbita,
  polarPadrao: number,
  delta: number,
  agora: number,
  opcoes: { travada: boolean; reduzido: boolean },
  segurando: boolean,
) {
  if (segurando) orbita.ultimo = agora;
  if (opcoes.travada) {
    voltarAoPadrao(orbita);
  } else if (orbita.forcada) {
    const { az = 0, pol, zoom = 1 } = orbita.forcada;
    orbita.atual = { az: az * RAD, pol: pol === undefined ? 0 : pol * RAD - polarPadrao, zoom };
    limitar(orbita.limites, orbita.atual);
    orbita.alvo = { ...orbita.atual };
    orbita.volta = null;
  } else if (orbita.volta) {
    const volta = orbita.volta;
    volta.t += Math.min(delta, 0.3) / orbita.limites.volta;
    const t = Math.min(1, volta.t);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    orbita.atual = {
      az: MathUtils.lerp(volta.de.az, 0, e),
      pol: MathUtils.lerp(volta.de.pol, 0, e),
      zoom: MathUtils.lerp(volta.de.zoom, 1, e),
    };
    orbita.alvo = { ...orbita.atual };
    if (volta.t >= 1) voltarAoPadrao(orbita);
  } else {
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 14);
    orbita.atual.az += (orbita.alvo.az - orbita.atual.az) * k;
    orbita.atual.pol += (orbita.alvo.pol - orbita.atual.pol) * k;
    orbita.atual.zoom += (orbita.alvo.zoom - orbita.atual.zoom) * k;
    if (orbita.ponteiros.size === 0 && agora - orbita.ultimo > orbita.limites.ocioso && !noCentro(orbita.alvo)) {
      centralizarOrbita(orbita, opcoes.reduzido);
    }
  }
}

function distanciaEntrePonteiros(ponteiros: Map<number, Ponto>) {
  const [a, b] = ponteiros.values();
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Arrasto, pinça, roda e teclado na superfície 3D. Retorna a limpeza dos eventos. */
export function escutarGestosOrbita(el: HTMLElement, orbita: EstadoOrbita, travada: () => boolean) {
  el.tabIndex = 0;
  el.setAttribute("role", "application");
  el.setAttribute("aria-label", "Cozinha 3D. Arraste para girar a câmera; setas giram e + ou - dão zoom.");
  const livre = () => !travada() && !orbita.forcada;
  const tocou = () => {
    orbita.ultimo = performance.now() / 1000;
    orbita.volta = null;
  };
  const down = (e: PointerEvent) => {
    if (!livre() || (e.pointerType === "mouse" && e.button !== 0)) return;
    el.setPointerCapture(e.pointerId);
    orbita.ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (orbita.ponteiros.size === 2) {
      orbita.pinca = distanciaEntrePonteiros(orbita.ponteiros);
      orbita.zoomPinca = orbita.alvo.zoom;
    }
    tocou();
  };
  const move = (e: PointerEvent) => {
    const p = orbita.ponteiros.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (orbita.ponteiros.size === 1) {
      const k = (120 * RAD) / Math.max(320, el.clientWidth);
      orbita.alvo.az -= dx * k;
      orbita.alvo.pol -= dy * k * 0.7;
    } else if (orbita.ponteiros.size === 2 && orbita.pinca > 0) {
      orbita.alvo.zoom = orbita.zoomPinca * (orbita.pinca / Math.max(1, distanciaEntrePonteiros(orbita.ponteiros)));
    }
    limitar(orbita.limites, orbita.alvo);
    tocou();
  };
  const up = (e: PointerEvent) => {
    if (!orbita.ponteiros.delete(e.pointerId)) return;
    orbita.pinca = 0;
    tocou();
  };
  const roda = (e: WheelEvent) => {
    if (!livre()) return;
    e.preventDefault();
    orbita.alvo.zoom *= Math.exp(MathUtils.clamp(e.deltaY, -120, 120) * 0.0016);
    limitar(orbita.limites, orbita.alvo);
    tocou();
  };
  const tecla = (e: KeyboardEvent) => {
    if (!livre()) return;
    const alvo = orbita.alvo;
    const passo = 6 * RAD;
    if (e.key === "ArrowLeft") alvo.az -= passo;
    else if (e.key === "ArrowRight") alvo.az += passo;
    else if (e.key === "ArrowUp") alvo.pol -= passo * 0.6;
    else if (e.key === "ArrowDown") alvo.pol += passo * 0.6;
    else if (e.key === "+" || e.key === "=") alvo.zoom *= 0.92;
    else if (e.key === "-" || e.key === "_") alvo.zoom /= 0.92;
    else return;
    e.preventDefault();
    limitar(orbita.limites, alvo);
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
    orbita.ponteiros.clear();
    orbita.pinca = 0;
  };
}
