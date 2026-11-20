/**
 * Origem da plataforma (API `/v1` e painel `/painel`), usada pelo modo garçom.
 * `PLATFORM_ORIGIN=` (vazio) desliga o proxy. A origem deste site precisa estar
 * em ALLOWED_ORIGINS da plataforma para o login web funcionar.
 */
const PADRAO = "https://vps-16302377.tail7dc411.ts.net:10000";

function origemDaPlataforma() {
  const valor = (process.env.PLATFORM_ORIGIN ?? PADRAO).trim().replace(/\/+$/, "");
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.origin;
  } catch {
    console.warn(`PLATFORM_ORIGIN inválida (${valor}); proxy do modo garçom desligado.`);
    return null;
  }
}

const plataforma = origemDaPlataforma();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  ...(plataforma && {
    async rewrites() {
      return [
        { source: "/v1/:path*", destination: `${plataforma}/v1/:path*` },
        { source: "/painel", destination: `${plataforma}/painel` },
        { source: "/painel/:path*", destination: `${plataforma}/painel/:path*` },
      ];
    },
  }),
};

export default nextConfig;
