import { restaurante } from "@/data/restaurante";

/** Destino configurável; somente um link. Nenhum pedido é enviado automaticamente. */
export function destinoDoCheckout(texto: string): string {
  const c = restaurante.checkout;
  if (c.tipo === "whatsapp") {
    const numero = c.numeroWhatsApp.replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(numero)) throw new Error("Configure o WhatsApp da loja com DDI e DDD.");
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }
  return c.url;
}
