import type { Vector3 } from "three";
import { c01, eOut3 } from "./curvas.js";

/** Trajetória cúbica sem alocações. O vetor de saída pode ser um dos pontos de controle. */
export function curvaCubica(out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number): Vector3 {
  const u = 1 - t;
  const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return out.set(
    a.x * w0 + b.x * w1 + c.x * w2 + d.x * w3,
    a.y * w0 + b.y * w1 + c.y * w2 + d.y * w3,
    a.z * w0 + b.z * w1 + c.z * w2 + d.z * w3,
  );
}

/** Retorna deslocamento em Y, escala lateral e escala vertical. A peça mantém contato ao achatar. */
export function assentarPeca(progresso: number, reduzido: boolean, alturaDaBase: number): [number, number, number] {
  const x = c01(progresso);
  if (reduzido) {
    const escala = Math.max(0.001, x);
    return [0, escala, escala];
  }
  const fimDaQueda = 0.42;
  if (x < fimDaQueda) {
    const queda = x / fimDaQueda;
    const escala = 0.55 + 0.45 * eOut3(queda);
    return [0.05 * (1 - queda * queda), escala, escala];
  }
  const assentamento = (x - fimDaQueda) / (1 - fimDaQueda);
  const amassa = x >= 1 ? 0 : 0.13 * Math.exp(-4.2 * assentamento) * Math.cos(2.4 * Math.PI * assentamento);
  return [-alturaDaBase * amassa, 1 + amassa * 0.5, 1 - amassa];
}
