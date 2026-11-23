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
