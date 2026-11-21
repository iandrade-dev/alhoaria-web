// "Recém-feito": brilho de comida quente nas camadas derretidas e o vapor que sobe do lanche pronto.
// Tudo barato: ajuste de material uma vez (sem textura nova nem recompilar) e poucos sprites transparentes,
// sem passada extra de render, então vale também na câmera (AR).
import { CanvasTexture, Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Sprite, SpriteMaterial, type Object3D } from "three";

export type Acabamento = { roughness: number; env: number; clearcoat?: number; clearcoatRoughness?: number };

/** Acabamentos das camadas do lanche: quanto brilham e quanto refletem o ambiente. O GLB não muda. */
export const ACABAMENTO = {
  /** creme de queijo e fondue: película molhada */
  creme: { roughness: 0.26, env: 2.2, clearcoat: 0.7, clearcoatRoughness: 0.16 },
  /** mussarela derretida */
  queijo: { roughness: 0.34, env: 1.9, clearcoat: 0.4, clearcoatRoughness: 0.26 },
  /** gratinado do maçarico: tostado, mas com gordura brilhando */
  gratinado: { roughness: 0.4, env: 1.8, clearcoat: 0.3, clearcoatRoughness: 0.3 },
  /** carne desfiada / recheio */
  recheio: { roughness: 0.46, env: 1.8, clearcoat: 0.45, clearcoatRoughness: 0.32 },
} satisfies Record<string, Acabamento>;

/** Deixa a camada com cara de recém-feita. Cada material é ajustado uma vez: chamar de novo não acumula. */
export function suculento(raiz: Object3D, a: Acabamento) {
  raiz.traverse((n) => {
    if (!(n instanceof Mesh)) return;
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      if (!(m instanceof MeshStandardMaterial) || m.userData.suculento) continue;
      m.userData.suculento = true;
      m.roughness = Math.min(m.roughness, a.roughness);
      m.envMapIntensity = Math.max(m.envMapIntensity, a.env);
      if (m instanceof MeshPhysicalMaterial && a.clearcoat !== undefined) {
        m.clearcoat = Math.max(m.clearcoat, a.clearcoat);
        m.clearcoatRoughness = a.clearcoatRoughness ?? m.clearcoatRoughness;
      }
    }
  });
  return raiz;
}

/**
 * Brasa: o gratinado fica com um calor alaranjado que some devagar depois do maçarico. Guarda o emissivo original
 * de cada material e devolve como pôr a força (0 = original).
 */
export function brasa(raiz: Object3D, cor = "#ff5a14") {
  const mats: { m: MeshStandardMaterial; e: Color; i: number }[] = [];
  raiz.traverse((n) => {
    if (!(n instanceof Mesh)) return;
    for (const m of Array.isArray(n.material) ? n.material : [n.material])
      if (m instanceof MeshStandardMaterial && !mats.some((x) => x.m === m)) mats.push({ m, e: m.emissive.clone(), i: m.emissiveIntensity });
  });
  const quente = new Color(cor);
  let ultimo = -1;
  return (forca: number) => {
    const f = Math.max(0, Math.min(1, forca));
    if (Math.abs(f - ultimo) < 0.002) return;
    ultimo = f;
    mats.forEach(({ m, e, i }) => {
      if (f <= 0) { m.emissive.copy(e); m.emissiveIntensity = i; return; }
      m.emissive.copy(e).lerp(quente, f); m.emissiveIntensity = Math.max(i, 0.55 * f);
    });
  };
}

let texturaVapor: CanvasTexture | null = null;
function textura() {
  if (texturaVapor) return texturaVapor;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.45, "rgba(255,252,246,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  texturaVapor = new CanvasTexture(canvas);
  return texturaVapor;
}

/**
 * Fumacinha de comida quente: borrões brancos que sobem girando devagar, crescem e somem. `animar` recebe o tempo
 * em segundos desde que o lanche ficou pronto (negativo esconde), o meio comprimento do lanche em x, a meia
 * largura em z e a altura do topo, em metros. Some de vez depois de `dura` segundos.
 */
export function vaporQuente(quantos = 7) {
  const tex = textura();
  const materiais = Array.from({ length: quantos }, () => new SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: "#fffaf2", toneMapped: false }));
  const fumacas = materiais.map((m) => { const s = new Sprite(m); s.visible = false; s.renderOrder = 4; s.name = "vapor"; return s; });
  const VIDA = 1.9;
  return {
    fumacas,
    animar(tempo: number, meioX: number, meioZ: number, topo: number, dura = 10) {
      fumacas.forEach((s, i) => {
        const vida = tempo < 0 ? -1 : (tempo - i * (VIDA / quantos)) % VIDA;
        const ligado = vida >= 0 && tempo - i * (VIDA / quantos) >= 0 && tempo < dura;
        s.visible = ligado; if (!ligado) return;
        const u = vida / VIDA;
        // cada fio nasce num ponto ao longo do lanche e sobe com uma ondulação lateral
        const x = (((i * 0.618) % 1) * 2 - 1) * meioX * 0.75;
        const z = (((i * 0.382) % 1) * 2 - 1) * meioZ * 0.5;
        s.position.set(x + 0.016 * Math.sin(u * 5 + i * 1.7), topo + 0.006 + 0.15 * u, z + 0.008 * Math.cos(u * 4 + i));
        s.scale.setScalar(0.04 + 0.085 * u);
        s.material.rotation = i + u * 0.8;
        const some = 1 - Math.max(0, Math.min(1, (tempo - dura + 1.2) / 1.2));
        s.material.opacity = 0.7 * Math.sin(Math.PI * u) * some;
      });
    },
    descartar() { materiais.forEach((m) => m.dispose()); },
  };
}
