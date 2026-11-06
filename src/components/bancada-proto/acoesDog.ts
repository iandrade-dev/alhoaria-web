import { Vector3 } from "three";
import { OPEN, eIO3, eIOs, eOut3, eBack, entra, lerp, pulso, sai, seg, type Acao, type Medidas } from "./acoes";

// Coreografia do Dogalho (brioche numa cestinha). Mesmas regras de `acoes.ts`: tempo do trabalho, ponto útil da mão
// no mundo e inclinação extra. Alturas e pontos vêm de `M.h` / `M.p`, medidos nos GLBs e no layout das estações.
//   M.h: pasta, molhos, fondue, muss, palha       M.p: salsA, salsB (encaixe no pão), bandejaB, ketchup, mostarda

const tmp = new Vector3();
const tmp2 = new Vector3();
const tmp3 = new Vector3();
const cub = (out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, k: number) => {
  const u = 1 - k;
  return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * k).addScaledVector(c, 3 * u * k * k).addScaledVector(d, k * k * k);
};
/** Arco de `a` até `b` subindo `alto` no meio. */
const arco = (out: Vector3, a: Vector3, b: Vector3, alto: number, k: number) => {
  const c1 = tmp3.copy(a); c1.y += alto;
  const c2 = new Vector3().copy(b); c2.y += alto;
  return cub(out, a, c1, c2, b, k);
};

// ---- Pasta de alho: bisnaga em zigue-zague ao longo do brioche
export const DPASTA = { varre: [0.86, 1.68] as const, x0: -0.09, x1: 0.09, ondas: 3.5, amp: 0.015 };
export const dpastaBico = (u: number, M: Medidas, out: Vector3) => {
  const k = eIOs(u);
  return out.set(lerp(DPASTA.x0, DPASTA.x1, k), M.h.pasta + 0.03 + 0.004 * Math.sin(u * Math.PI), DPASTA.amp * Math.sin(2 * Math.PI * DPASTA.ondas * k));
};

// ---- Salsichas: pega uma na travessa (na pegada), deita no pão, volta, pega a outra e deita do lado
export const SALS = { soltaA: 0.98, pega: [1.5, 1.62, 1.66, 1.72] as const, chegaB: 2.1, soltaB: 2.22, D: 2.7, grip: 0.004, acima: 0.045, solta: 0.012, queda: 0.09 };

// ---- Molhos: ketchup em zigue-zague, devolve a bisnaga vermelha, pega a amarela, mostarda em zigue-zague
export const MOLHOS = {
  k: [0.86, 1.6] as const, volta: 2.12, solta: 2.2, troca: [2.26, 2.44] as const, pega: 2.5, vai: 2.58, m: [3.02, 3.76] as const, D: 4.22,
  x0: -0.1, x1: 0.1, ondas: 4, amp: 0.016,
};
export const molhoBico = (u: number, M: Medidas, fase: number, out: Vector3) => {
  const k = eIOs(u);
  return out.set(lerp(MOLHOS.x0, MOLHOS.x1, k), M.h.molhos + 0.026 + 0.004 * Math.sin(u * Math.PI), MOLHOS.amp * Math.sin(2 * Math.PI * MOLHOS.ondas * k + fase));
};

// ---- Tampa do brioche: mesma dobradiça do pão de alho (eixo X, aberta em -110°), mais baixa e mais estreita
export const DOG_DOBRA = new Vector3(0, 0.0348, -0.0407);
export const DOG_TAMPA = { fecha: [0.5, 1.02] as const, aperta: [1.02, 1.36] as const };
export function anguloTampaDog(t: number, amp: number) {
  const k = seg(t, DOG_TAMPA.fecha[0], DOG_TAMPA.fecha[1]);
  const e = amp > 0 ? eBack(k, 0.55 * amp) : eIO3(k);
  return Math.min(0.05, OPEN * (1 - e));
}
export function contatoTampaDog(ang: number, out: Vector3) {
  const y = 0.052, z = 0.05, c = Math.cos(ang), s = Math.sin(ang);
  return out.set(0, DOG_DOBRA.y + y * c - z * s, DOG_DOBRA.z + y * s + z * c);
}

// ---- Fundue: colher que espalha e escorre por cima da tampa fechada
export const FONDUE = { varre: [0.86, 1.72] as const, x0: -0.088, x1: 0.088, vai: 4 };
export const fondueConcha = (u: number, M: Medidas, out: Vector3) => {
  const k = eIOs(u);
  const x = lerp(FONDUE.x0, FONDUE.x1, k) + 0.024 * Math.sin(2 * Math.PI * FONDUE.vai * u) * Math.sin(Math.PI * u);
  return out.set(x, M.h.fondue + 0.014 + 0.008 * Math.abs(Math.cos(2 * Math.PI * FONDUE.vai * u)), 0.01 * Math.sin(2 * Math.PI * 2 * u));
};

// ---- Mussarela e batata palha: punhado espalhado sobre o lanche
export const DMUSS = { varre: [0.74, 1.42] as const, x0: -0.09, x1: 0.09 };
export const PALHA = { varre: [0.74, 1.42] as const, x0: -0.095, x1: 0.095 };

function espalha(cfg: { varre: readonly [number, number]; x0: number; x1: number }, chave: string, D: number): Acao {
  return {
    pose: "mao_punhado", D, ini: cfg.varre[0], punhado: true,
    mao(t, M, amp, out) {
      const alto = M.h[chave] + 0.075;
      const G = tmp.set(0.1, alto + 0.03, 0.02);
      const [a, b] = cfg.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.15 * (1 - seg(t, 0, 0.5))]; }
      const S = tmp2.set(cfg.x0, alto, 0);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.5, a))); return [0, 0, 0.1 * pulso(t, 0.5, a)]; }
      if (t < b) {
        const u = seg(t, a, b);
        out.set(lerp(cfg.x0, cfg.x1, eIOs(u)), alto + 0.006 * Math.sin(u * 14), 0.012 * Math.sin(u * 9));
        return [0, 0, -0.14 * Math.abs(Math.sin(u * 14))];
      }
      const E = tmp2.set(cfg.x1, alto + 0.025 * eOut3(seg(t, b, b + 0.14)), 0);
      sai(t, b + 0.08, D, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, b, D)];
    },
  };
}

export const ACOES_DOG: Record<"dog-pasta" | "dog-salsichas" | "dog-molhos" | "dog-tampa" | "dog-fondue" | "dog-mussarela" | "dog-palha", Acao> = {
  "dog-pasta": {
    pose: "mao_bisnaga", D: 2.12, ini: DPASTA.varre[0],
    mao(t, M, amp, out) {
      const G = tmp.set(0.075, M.h.pasta + 0.1, 0.035);
      const [a, b] = DPASTA.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.12 * (1 - seg(t, 0, 0.5))]; }
      if (t < 0.6) { out.copy(G).y -= 0.005 * pulso(t, 0.5, 0.6); return [0, 0, 0]; }
      const S = dpastaBico(0, M, tmp2);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.6, a))); return [0, 0, 0.1 * pulso(t, 0.6, a)]; }
      if (t < b) { const u = seg(t, a, b); dpastaBico(u, M, out); return [0.06 * Math.cos(2 * Math.PI * DPASTA.ondas * eIOs(u)), 0, 0]; }
      const E = dpastaBico(1, M, tmp2).add(tmp.set(0, 0.018 * eOut3(seg(t, b, b + 0.14)), 0));
      sai(t, b + 0.08, 2.12, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, b, 2.12)];
    },
  },
  "dog-salsichas": {
    pose: "mao_punhado", D: SALS.D, ini: 0.86, punhado: true,
    mao(t, M, amp, out) {
      const { grip, acima, solta, soltaA, pega, chegaB, soltaB, D } = SALS;
      const sobreA = tmp.copy(M.p.salsA); sobreA.y += grip + acima;
      if (t < 0.86) { out.copy(sobreA); return [0, 0, 0]; }
      const baixoA = tmp2.copy(M.p.salsA); baixoA.y += grip + solta;
      if (t < soltaA) { out.lerpVectors(sobreA, baixoA, eIOs(seg(t, 0.86, soltaA))); return [0, 0, 0]; }
      const subiu = baixoA.clone(); subiu.y += 0.022;
      if (t < soltaA + 0.08) { out.lerpVectors(baixoA, subiu, eOut3(seg(t, soltaA, soltaA + 0.08))); return [0, 0, -0.1 * pulso(t, soltaA - 0.02, soltaA + 0.1)]; }
      const pegaT = new Vector3().copy(M.p.bandejaB); pegaT.y += grip;
      const sobreT = pegaT.clone(); sobreT.y += 0.05;
      if (t < pega[0]) { arco(out, subiu, sobreT, 0.05, eIO3(seg(t, soltaA + 0.08, pega[0]))); return [0, 0, 0.1 * pulso(t, soltaA + 0.08, pega[0])]; }
      if (t < pega[1]) { out.lerpVectors(sobreT, pegaT, eIOs(seg(t, pega[0], pega[1]))); return [0, 0, 0]; }
      if (t < pega[3]) { out.copy(pegaT); return [0, 0, 0]; }
      const sobreB = new Vector3().copy(M.p.salsB); sobreB.y += grip + acima;
      if (t < chegaB) {
        const k = eIO3(seg(t, pega[3], chegaB));
        const c1 = pegaT.clone(); c1.y += 0.08;
        const c2 = sobreB.clone(); c2.y += 0.03;
        cub(out, pegaT, c1, c2, sobreB, k);
        return [0, 0, 0.1 * pulso(t, pega[3], chegaB)];
      }
      const baixoB = new Vector3().copy(M.p.salsB); baixoB.y += grip + solta;
      if (t < soltaB) { out.lerpVectors(sobreB, baixoB, eIOs(seg(t, chegaB, soltaB))); return [0, 0, 0]; }
      const E = baixoB.add(tmp.set(0, 0.022 * eOut3(seg(t, soltaB, soltaB + 0.12)), 0));
      sai(t, soltaB + 0.08, D, M, E, amp, out);
      return [0, 0, -0.1 * pulso(t, soltaB - 0.02, soltaB + 0.1) - 0.1 * seg(t, soltaB + 0.1, D)];
    },
  },
  "dog-molhos": {
    pose: "mao_bisnaga", D: MOLHOS.D, ini: MOLHOS.k[0],
    mao(t, M, amp, out) {
      const { k, volta, troca, vai, m, D } = MOLHOS;
      if (t < k[0]) { molhoBico(0, M, 0, out); return [0, 0, 0]; }
      if (t < k[1]) { const u = seg(t, k[0], k[1]); molhoBico(u, M, 0, out); return [0.06 * Math.cos(2 * Math.PI * MOLHOS.ondas * eIOs(u)), 0, 0]; }
      const R = M.p.ketchup, Y = M.p.mostarda;
      if (t < volta) {
        const E = molhoBico(1, M, 0, new Vector3());
        const c1 = E.clone(); c1.y += 0.06;
        const c2 = R.clone(); c2.y += 0.1;
        cub(out, E, c1, c2, R, eIO3(seg(t, k[1], volta)));
        return [0, 0, 0.08 * pulso(t, k[1], volta)];
      }
      if (t < troca[0]) { out.copy(R); return [0, 0, 0]; }
      if (t < troca[1]) { arco(out, R, Y, 0.05, eIOs(seg(t, troca[0], troca[1]))); return [0, 0, 0]; }
      if (t < vai) { out.copy(Y); return [0, 0, 0]; }
      const S = molhoBico(0, M, Math.PI, new Vector3());
      if (t < m[0]) {
        const c1 = Y.clone(); c1.y += 0.1;
        const c2 = S.clone(); c2.y += 0.05;
        cub(out, Y, c1, c2, S, eIO3(seg(t, vai, m[0])));
        return [0, 0, 0.1 * pulso(t, vai, m[0])];
      }
      if (t < m[1]) { const u = seg(t, m[0], m[1]); molhoBico(u, M, Math.PI, out); return [0.06 * Math.cos(2 * Math.PI * MOLHOS.ondas * eIOs(u) + Math.PI), 0, 0]; }
      const E = molhoBico(1, M, Math.PI, tmp2).add(tmp.set(0, 0.018 * eOut3(seg(t, m[1], m[1] + 0.14)), 0));
      sai(t, m[1] + 0.08, D, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, m[1], D)];
    },
  },
  "dog-tampa": {
    pose: "mao_aberta", D: 1.78, ini: null,
    mao(t, M, amp, out) {
      const ang = anguloTampaDog(t, amp);
      const c = contatoTampaDog(ang, tmp2);
      c.add(tmp.set(0, Math.cos(ang), Math.sin(ang)).multiplyScalar(0.012));
      const tilt = ang * 0.5;
      if (t < 0.5) { entra(t, 0.5, M, c, amp, out); return [tilt - 0.15 * (1 - seg(t, 0, 0.5)), 0, 0]; }
      if (t < DOG_TAMPA.aperta[0]) { out.copy(c); return [tilt, 0, 0]; }
      const [a, b] = DOG_TAMPA.aperta;
      if (t < b) { out.copy(c); out.y -= 0.008 * pulso(t, a, b); return [0, 0, 0]; }
      const E = c.add(tmp.set(0, 0.02 * eOut3(seg(t, b, b + 0.12)), 0));
      sai(t, b + 0.06, 1.78, M, E, amp, out);
      return [-0.12 * seg(t, b, 1.78), 0, 0];
    },
  },
  "dog-fondue": {
    pose: "mao_colher", D: 2.2, ini: FONDUE.varre[0],
    mao(t, M, amp, out) {
      const G = tmp.set(0.07, M.h.fondue + 0.1, 0.03);
      const [a, b] = FONDUE.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.1 * (1 - seg(t, 0, 0.5))]; }
      if (t < 0.6) { out.copy(G).y -= 0.004 * pulso(t, 0.5, 0.6); return [0, 0, 0]; }
      const S = fondueConcha(0, M, tmp2);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.6, a))); return [0, 0, 0.12 * pulso(t, 0.6, a)]; }
      if (t < b) { const u = seg(t, a, b); fondueConcha(u, M, out); return [0, 0, 0.16 * Math.cos(2 * Math.PI * FONDUE.vai * u)]; }
      const E = fondueConcha(1, M, tmp2).add(tmp.set(0, 0.03 * eOut3(seg(t, b, b + 0.16)), 0));
      sai(t, b + 0.1, 2.2, M, E, amp, out);
      return [0, 0, -0.12 * seg(t, b, 2.2)];
    },
  },
  "dog-mussarela": espalha(DMUSS, "muss", 1.95),
  "dog-palha": espalha(PALHA, "palha", 1.95),
};
