"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/store/useCart";

/** Evita pintar a sacola persistida antes da reidratação no cliente. */
export function useCartHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(useCart.persist.hasHydrated());
    return useCart.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
