import type { SVGProps } from "react";

const base = (tamanho: number): SVGProps<SVGSVGElement> => ({
  className: "flex-none", viewBox: "0 0 24 24", width: tamanho, height: tamanho, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
});

export const IcDesfazer = ({ t = 20 }: { t?: number }) => <svg {...base(t)}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>;
export const IcLimpar = ({ t = 20 }: { t?: number }) => <svg {...base(t)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>;
export const IcCheck = ({ t = 12 }: { t?: number }) => <svg {...base(t)} strokeWidth={3.2}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IcDireita = ({ t = 18 }: { t?: number }) => <svg {...base(t)} strokeWidth={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IcEsquerda = ({ t = 18 }: { t?: number }) => <svg {...base(t)} strokeWidth={2.4}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const IcGirar = ({ t = 20 }: { t?: number }) => <svg {...base(t)}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>;
export const IcCopiar = ({ t = 18 }: { t?: number }) => <svg {...base(t)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>;
export const IcExterno = ({ t = 18 }: { t?: number }) => <svg {...base(t)} strokeWidth={2.2}><path d="M7 17 17 7M8 7h9v9" /></svg>;
export const IcMao = ({ t = 16 }: { t?: number }) => <svg {...base(t)}><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6" /><path d="M11 10V4a1.5 1.5 0 0 1 3 0v7" /><path d="M14 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.4-1.7L8 14" /></svg>;
