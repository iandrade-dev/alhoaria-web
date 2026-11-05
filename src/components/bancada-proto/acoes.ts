import { Vector3 } from "three";
import type { Passo } from "./layout";

// Curvas de tempo. `amp` controla antecipação/overshoot (0 com movimento reduzido).
export const c01 = (x: number) => Math.max(0, Math.min(1, x));
export const seg = (t: number, a: number, b: number) => c01((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const eOut3 = (k: number) => 1 - Math.pow(1 - c01(k), 3);
export const eIn3 = (k: number) => Math.pow(c01(k), 3);
export const eIn2 = (k: number) => c01(k) * c01(k);
export const eIO3 = (k: number) => { const x = c01(k); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const eIOs = (k: number) => -(Math.cos(Math.PI * c01(k)) - 1) / 2;
/** Sai do lugar, passa um pouco do alvo e volta (overshoot). */
export const eBack = (k: number, amp = 1) => { const s = 1.70158 * amp, x = c01(k) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
/** Recua antes de ir (antecipação). */
export const eAnt = (k: number, amp = 1) => { const s = 1.70158 * amp, x = c01(k); return (s + 1) * x * x * x - s * x * x; };
/** Mola amortecida: 0 -> 1 com oscilações que morrem. */
export const mola = (k: number, amp = 1) => {
  const x = c01(k);
  if (amp <= 0) return eOut3(x);
  if (x >= 1) return 1;
  const s = 1 - Math.exp(-5.5 * x) * Math.cos(2.4 * Math.PI * x);
  return eOut3(x) + (s - eOut3(x)) * Math.min(1, amp);
};
/** Pulso 0 -> 1 -> 0 (seno) dentro de [a, b]. */
export const pulso = (t: number, a: number, b: number) => Math.sin(Math.PI * seg(t, a, b));

export type Pose = "mao_bisnaga" | "mao_colher" | "mao_macarico" | "mao_punhado" | "mao_aberta";

/** Alturas medidas nos GLBs depois de carregar. */
export type Medidas = { pasta: number; costela: number; creme: number; muss: number; fora: Vector3 };

export type Acao = {
  pose: Pose;
  /** Duração do trabalho no "tempo do trabalho" (o mesmo de `mao` e dos efeitos). */
  D: number;
  /** Instante (tempo do trabalho) em que a mão já trouxe a ferramenta e começa a usar. null = sem ferramenta (tampa). */
  ini: number | null;
  /** Punhado: a mão desce no pote, fecha e sobe (em vez de assentar na ferramenta). */
  punhado?: boolean;
  /** Ponto útil da mão (bico, concha, soltura, palma) em coordenadas do mundo e inclinação extra (rad). Vale de `ini` em diante. */
  mao: (t: number, M: Medidas, amp: number, out: Vector3) => [number, number, number];
};

/**
 * Pegada, no tempo real da ação: a mão entra (ease-out) até sobre a ferramenta, assenta nela, fica parada
 * um instante e fecha (`fecha` = troca da ferramenta parada pela cópia na mão), levanta e leva (ease in-out)
 * até a posição de trabalho, chegando em `leva`. Sem overshoot em nenhuma dessas fases.
 */
export type Pegada = { chega: number; assenta: number; fecha: number; leva: number; sobre: number; ergue: number };
export const PEGADA: Record<"ferramenta" | "punhado", Pegada> = {
  ferramenta: { chega: 0.44, assenta: 0.53, fecha: 0.6, leva: 1.04, sobre: 0.014, ergue: 0.075 },
  punhado: { chega: 0.38, assenta: 0.54, fecha: 0.61, leva: 1.06, sobre: 0.06, ergue: 0.08 },
};
export const pegadaDe = (ac: Acao): Pegada | null => (ac.ini === null ? null : ac.punhado ? PEGADA.punhado : PEGADA.ferramenta);
/** Duração real da ação (pegada + trabalho). */
export const duracao = (ac: Acao) => { const g = pegadaDe(ac); return g ? g.leva + ac.D - ac.ini! : ac.D; };
/** Tempo real -> tempo do trabalho. Durante a pegada avança devagar até `ini`. */
export const tempoTrabalho = (ac: Acao, t: number) => {
  const g = pegadaDe(ac);
  if (!g) return t;
  return t < g.leva ? ac.ini! * (t / g.leva) : ac.ini! + (t - g.leva);
};

const v = (out: Vector3, x: number, y: number, z: number) => out.set(x, y, z);
/** Entra de fora (direita) até `alvo`, chegando em `t1` com overshoot. */
function entra(t: number, t1: number, M: Medidas, alvo: Vector3, amp: number, out: Vector3) {
  const k = eBack(t / t1, amp * 0.85);
  return out.copy(alvo).addScaledVector(M.fora, 1 - k);
}
/** Recua um tiquinho (antecipação) e sai para a direita com aceleração. */
function sai(t: number, t0: number, D: number, M: Medidas, de: Vector3, amp: number, out: Vector3) {
  const k = seg(t, t0, D);
  const a = eAnt(k, amp * 0.9);
  return out.copy(de).addScaledVector(M.fora, a);
}

const tmp = new Vector3();
const tmp2 = new Vector3();

// ---- Pasta: bisnaga em zigue-zague ao longo do pão
export const PASTA = { varre: [0.86, 1.68] as const, x0: -0.132, x1: 0.132, ondas: 3.5, amp: 0.024 };
export const pastaBico = (u: number, M: Medidas, out: Vector3) => {
  const k = eIOs(u);
  return v(out, lerp(PASTA.x0, PASTA.x1, k), M.pasta + 0.03 + 0.004 * Math.sin(u * Math.PI), PASTA.amp * Math.sin(2 * Math.PI * PASTA.ondas * k));
};

// ---- Creme: colher espalhando com vai e vem
export const CREME = { varre: [0.86, 1.72] as const, x0: -0.125, x1: 0.125, vai: 4 };
export const cremeConcha = (u: number, M: Medidas, out: Vector3) => {
  const k = eIOs(u);
  const x = lerp(CREME.x0, CREME.x1, k) + 0.028 * Math.sin(2 * Math.PI * CREME.vai * u) * Math.sin(Math.PI * u);
  return v(out, x, M.creme + 0.012 + 0.008 * Math.abs(Math.cos(2 * Math.PI * CREME.vai * u)), 0.012 * Math.sin(2 * Math.PI * 2 * u));
};

// ---- Costela: 3 punhados
export const COSTELA = { xs: [-0.088, 0.0, 0.088], solta: [0.86, 1.3, 1.74], queda: 0.17 };

// ---- Tampa: mão aberta fecha a tampa com mola e aperta o pão
export const OPEN = -1.9199;
export const DOBRA = new Vector3(0, 0.042, -0.052);
export const TAMPA = { fecha: [0.5, 1.02] as const, aperta: [1.02, 1.36] as const };
export function anguloTampa(t: number, amp: number) {
  const k = seg(t, TAMPA.fecha[0], TAMPA.fecha[1]);
  const e = amp > 0 ? eBack(k, 0.55 * amp) : eIO3(k);
  return Math.min(0.05, OPEN * (1 - e));
}
/** Ponto de contato da palma na casca da tampa (já girada pelo ângulo). */
export function contatoTampa(ang: number, out: Vector3) {
  const y = 0.05, z = 0.072, c = Math.cos(ang), s = Math.sin(ang);
  return out.set(0, DOBRA.y + y * c - z * s, DOBRA.z + y * s + z * c);
}

// ---- Mussarela: punhado espalhado sobre a tampa fechada
export const MUSS = { varre: [0.74, 1.42] as const, x0: -0.115, x1: 0.115 };

// ---- Maçarico: varre de ponta a ponta com a chama acesa
export const MACA = { varre: [0.84, 1.92] as const, x0: -0.135, x1: 0.14, alcance: 0.072 };

export const ACOES: Record<Passo, Acao> = {
  pasta: {
    pose: "mao_bisnaga", D: 2.12, ini: PASTA.varre[0],
    mao(t, M, amp, out) {
      const G = tmp.set(0.075, M.pasta + 0.1, 0.035);
      const [a, b] = PASTA.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.12 * (1 - seg(t, 0, 0.5))]; }
      if (t < 0.6) { out.copy(G).y -= 0.005 * pulso(t, 0.5, 0.6); return [0, 0, 0]; }
      const S = pastaBico(0, M, tmp2);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.6, a))); return [0, 0, 0.1 * pulso(t, 0.6, a)]; }
      if (t < b) { const u = seg(t, a, b); pastaBico(u, M, out); return [0.06 * Math.cos(2 * Math.PI * PASTA.ondas * eIOs(u)), 0, 0]; }
      const E = pastaBico(1, M, tmp2).add(tmp.set(0, 0.018 * eOut3(seg(t, b, b + 0.14)), 0));
      sai(t, b + 0.08, 2.12, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, b, 2.12)];
    },
  },
  creme: {
    pose: "mao_colher", D: 2.2, ini: CREME.varre[0],
    mao(t, M, amp, out) {
      const G = tmp.set(0.07, M.creme + 0.1, 0.03);
      const [a, b] = CREME.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.1 * (1 - seg(t, 0, 0.5))]; }
      if (t < 0.6) { out.copy(G).y -= 0.004 * pulso(t, 0.5, 0.6); return [0, 0, 0]; }
      const S = cremeConcha(0, M, tmp2);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.6, a))); return [0, 0, 0.12 * pulso(t, 0.6, a)]; }
      if (t < b) { const u = seg(t, a, b); cremeConcha(u, M, out); return [0, 0, 0.16 * Math.cos(2 * Math.PI * CREME.vai * u)]; }
      const E = cremeConcha(1, M, tmp2).add(tmp.set(0, 0.03 * eOut3(seg(t, b, b + 0.16)), 0));
      sai(t, b + 0.1, 2.2, M, E, amp, out);
      return [0, 0, -0.12 * seg(t, b, 2.2)];
    },
  },
  costela: {
    pose: "mao_punhado", D: 2.25, ini: COSTELA.solta[0], punhado: true,
    mao(t, M, amp, out) {
      const alto = M.costela + 0.085;
      const G = tmp.set(0.12, alto + 0.03, 0.02);
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.15 * (1 - seg(t, 0, 0.5))]; }
      const { xs, solta } = COSTELA;
      let de = G.clone(), rz = 0;
      for (let i = 0; i < 3; i++) {
        const chega = solta[i];
        const parte = i === 0 ? 0.56 : solta[i - 1] + 0.1;
        const alvo = tmp2.set(xs[i], alto, 0.004 * (i - 1));
        if (t < chega) { out.lerpVectors(de, alvo, eIO3(seg(t, parte, chega))); return [0, 0, 0.12 * pulso(t, parte, chega)]; }
        // solta: pulso pra cima com um peteleco do punho
        if (t < chega + 0.1) { out.copy(alvo); out.y += 0.012 * pulso(t, chega, chega + 0.1); rz = -0.22 * pulso(t, chega - 0.02, chega + 0.1); return [0, 0, rz]; }
        de = alvo.clone();
      }
      const E = de.add(tmp.set(0, 0.02 * eOut3(seg(t, 1.84, 1.94)), 0));
      sai(t, 1.88, 2.25, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, 1.84, 2.25)];
    },
  },
  tampa: {
    pose: "mao_aberta", D: 1.78, ini: null,
    mao(t, M, amp, out) {
      const ang = anguloTampa(t, amp);
      const c = contatoTampa(ang, tmp2);
      // a palma fica do lado de fora da casca (normal da casca = eixo y local girado)
      c.add(tmp.set(0, Math.cos(ang), Math.sin(ang)).multiplyScalar(0.012));
      const tilt = ang * 0.5;
      if (t < 0.5) { entra(t, 0.5, M, c, amp, out); return [tilt - 0.15 * (1 - seg(t, 0, 0.5)), 0, 0]; }
      if (t < TAMPA.aperta[0]) { out.copy(c); return [tilt, 0, 0]; }
      const [a, b] = TAMPA.aperta;
      if (t < b) { out.copy(c); out.y -= 0.009 * pulso(t, a, b); return [0, 0, 0]; }
      const E = c.add(tmp.set(0, 0.02 * eOut3(seg(t, b, b + 0.12)), 0));
      sai(t, b + 0.06, 1.78, M, E, amp, out);
      return [-0.12 * seg(t, b, 1.78), 0, 0];
    },
  },
  mussarela: {
    pose: "mao_punhado", D: 1.95, ini: MUSS.varre[0], punhado: true,
    mao(t, M, amp, out) {
      const alto = M.muss + 0.075;
      const G = tmp.set(0.1, alto + 0.03, 0.02);
      const [a, b] = MUSS.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.15 * (1 - seg(t, 0, 0.5))]; }
      const S = tmp2.set(MUSS.x0, alto, 0);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.5, a))); return [0, 0, 0.1 * pulso(t, 0.5, a)]; }
      if (t < b) {
        const u = seg(t, a, b);
        out.set(lerp(MUSS.x0, MUSS.x1, eIOs(u)), alto + 0.006 * Math.sin(u * 14), 0.012 * Math.sin(u * 9));
        return [0, 0, -0.14 * Math.abs(Math.sin(u * 14))];
      }
      const E = tmp2.set(MUSS.x1, alto + 0.025 * eOut3(seg(t, b, b + 0.14)), 0);
      sai(t, b + 0.08, 1.95, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, b, 1.95)];
    },
  },
  macarico: {
    pose: "mao_macarico", D: 2.3, ini: MACA.varre[0],
    // aqui o ponto útil é o ALVO da chama (sobre a mussarela); Cena converte para a ponta do bico.
    mao(t, M, amp, out) {
      const G = tmp.set(0.07, M.muss + 0.05, 0.0);
      const [a, b] = MACA.varre;
      if (t < 0.5) { entra(t, 0.5, M, G, amp, out); return [0, 0, -0.1 * (1 - seg(t, 0, 0.5))]; }
      const S = tmp2.set(MACA.x0, M.muss, 0);
      if (t < a) { out.lerpVectors(G, S, eIO3(seg(t, 0.56, a))); return [0, 0, 0.08 * pulso(t, 0.56, a)]; }
      if (t < b) { const u = seg(t, a, b); out.set(lerp(MACA.x0, MACA.x1, eIOs(u)), M.muss + 0.003 * Math.sin(u * 30), 0.006 * Math.sin(u * 7)); return [0, 0, 0.03 * Math.sin(u * 11)]; }
      const E = tmp2.set(MACA.x1, M.muss + 0.03 * eOut3(seg(t, b, b + 0.14)), 0);
      sai(t, b + 0.06, 2.3, M, E, amp, out);
      return [0, 0, -0.1 * seg(t, b, 2.3)];
    },
  },
};
