import menuData from "@/data/menu.json";

/**
 * VERIFY: o WhatsApp por unidade ainda não foi confirmado pelo cliente.
 * `units[].whatsapp` repete o default atual de `brand.whatsapp_default`
 * (5548999702016). Não trocar por um número inventado.
 * Praia de Fora não tem número próprio.
 */
export function whatsAppForUnit(unitId: string): string {
  const unit = menuData.units.find((entry) => entry.id === unitId) as
    | { whatsapp?: string }
    | undefined;
  if (unit?.whatsapp) return unit.whatsapp;
  return menuData.brand.whatsapp_default;
}

export function findUnit(unitId: string) {
  return menuData.units.find((entry) => entry.id === unitId);
}
