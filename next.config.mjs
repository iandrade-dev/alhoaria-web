/**
 * Origem da plataforma, usada só pelo modo garçom. O proxy repassa apenas as rotas de
 * que o garçom precisa (sessão, locais de trabalho e pedidos): o painel e as demais
 * rotas da API nunca passam por este site.
 * `PLATFORM_ORIGIN=` (vazio) desliga o proxy. A origem deste site precisa estar
 * em WAITER_SITE_ORIGINS da plataforma para o login web funcionar.
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
  transpilePackages: ["@cardapios/bancada-3d"],
  images: {
    unoptimized: true,
  },
  ...(plataforma && {
    async rewrites() {
      return [
        { source: "/v1/identity/sessions", destination: `${plataforma}/v1/identity/sessions` },
        { source: "/v1/identity/session", destination: `${plataforma}/v1/identity/session` },
        { source: "/v1/me/workplaces", destination: `${plataforma}/v1/me/workplaces` },
        { source: "/v1/companies/:companyId/orders", destination: `${plataforma}/v1/companies/:companyId/orders` },
        { source: "/v1/companies/:companyId/orders/:orderId/cancel", destination: `${plataforma}/v1/companies/:companyId/orders/:orderId/cancel` },
      ];
    },
  }),
};

export default nextConfig;
