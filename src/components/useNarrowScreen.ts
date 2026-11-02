"use client";

import { useEffect, useState } from "react";

export function useNarrowScreen() {
  const [narrow, setNarrow] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return narrow;
}
