type Capacidades = { deviceMemory?: number; hardwareConcurrency?: number; connection?: { saveData?: boolean; effectiveType?: string } };

/** Apenas escolhe efeitos mais baratos; não bloqueia o pedido nem presume suporte a AR. */
export function dispositivoLeve(n: Capacidades): boolean {
  return !!n.connection?.saveData || /(^|-)2g$/.test(n.connection?.effectiveType ?? "")
    || !!n.deviceMemory && n.deviceMemory <= 4 || !!n.hardwareConcurrency && n.hardwareConcurrency <= 4;
}
