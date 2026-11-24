import { useSyncExternalStore } from "react";

const consulta = "(prefers-reduced-motion: reduce)";
const preferenciaNoServidor = () => false;

export const prefereMovimentoReduzido = () => window.matchMedia(consulta).matches;

function observarPreferencia(atualizar: () => void) {
  const preferencia = window.matchMedia(consulta);
  preferencia.addEventListener("change", atualizar);
  return () => preferencia.removeEventListener("change", atualizar);
}

export function useMovimentoReduzido() {
  return useSyncExternalStore(observarPreferencia, prefereMovimentoReduzido, preferenciaNoServidor);
}
