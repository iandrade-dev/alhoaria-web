"use client";

import { formatBRL } from "@/lib/money";
import { useCartHydrated } from "@/store/useCartHydrated";
import { useCart } from "@/store/useCart";

export default function StickyCartBar() {
  const hydrated = useCartHydrated();
  const count = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const total = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  );
  const isCartOpen = useCart((state) => state.isCartOpen);
  const setIsCartOpen = useCart((state) => state.setIsCartOpen);

  if (!hydrated || count === 0 || isCartOpen) return null;

  const noun = count === 1 ? "item" : "itens";

  return (
    <>
      <div className="h-16 md:hidden" aria-hidden />
      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className="fixed inset-x-0 bottom-0 z-40 min-h-11 bg-macarico px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-semibold text-carvao md:hidden"
      >
        {count} {noun} · R$ {formatBRL(total)} · Ver pedido
      </button>
    </>
  );
}
