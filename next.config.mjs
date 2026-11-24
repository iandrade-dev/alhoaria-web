/**
 * O servidor consulta a publicação do cardápio na origem da plataforma. O proxy repassa apenas as rotas de
 * que o garçom precisa (sessão, locais de trabalho e pedidos): o painel e as demais
 * rotas da API nunca passam por este site.
 * `PLATFORM_ORIGIN=` (vazio) desliga o proxy. A origem deste site precisa estar
 * em WAITER_SITE_ORIGINS da plataforma para o login web funcionar.
 */
import { origemDaPlataforma } from "./src/lib/origem-plataforma.mjs";

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
