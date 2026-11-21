import type { ItemDoPedido, NovoPedidoMesa, StatusPedido } from "./garcom-pedido";

/**
 * Cliente da plataforma para o modo garçom. Todo o contrato fica aqui.
 * Mesma origem: `/v1` chega à plataforma pelo proxy do Next (next.config.mjs).
 * Login, sessão e CSRF seguem o cliente do painel (apps/panel/src/api.ts):
 * cookie HttpOnly da sessão web e cabeçalho `x-csrf-token` nas mutações.
 */

export type Papel = "admin" | "waiter" | "kitchen";
export type Usuario = { id: string; email: string; displayName: string | null; role: string };
export type LocalDeTrabalho = { companyId: string; companyName: string; role: Papel };
export type Pedido = {
  id: string; companyId: string; number: number; table: string; note: string | null;
  items: (ItemDoPedido & { details?: string[] | null })[]; totalCents: number; status: StatusPedido;
  createdBy: { name: string | null } | null; createdAt: string; updatedAt: string;
};

export const ROTAS = {
  login: "/v1/identity/sessions",
  sessao: "/v1/identity/session",
  locais: "/v1/me/workplaces",
  pedidos: (companyId: string) => `/v1/companies/${encodeURIComponent(companyId)}/orders`,
  cancelar: (companyId: string, orderId: string) => `/v1/companies/${encodeURIComponent(companyId)}/orders/${encodeURIComponent(orderId)}/cancel`,
} as const;

export type TipoErro = "sessao" | "permissao" | "conflito" | "invalido" | "indisponivel";

export class ErroGarcom extends Error {
  constructor(public readonly tipo: TipoErro, message: string, public readonly status = 0, public readonly codigo?: string) { super(message); }
  /** Falha em que o pedido pode ou não ter chegado: reenviar com a mesma chave. */
  get repetivel() { return this.tipo === "indisponivel"; }
}

/** Nome do campo recusado pela plataforma, em português, para a mensagem ao garçom. */
function campoLegivel(caminho?: string) {
  if (!caminho) return "";
  if (caminho.startsWith("note")) return `Observação longa demais (máximo ${280} caracteres)`;
  if (caminho.startsWith("table")) return "Mesa inválida";
  if (/quantity/.test(caminho)) return "Quantidade acima do limite (máximo 50 por item)";
  if (caminho.startsWith("items")) return "Algum item da comanda foi recusado";
  return "Revise a comanda";
}

type CorpoDeErro = { error?: { message?: string; code?: string; details?: { path?: string; message?: string }[] } };

export function erroDaResposta(status: number, corpo: CorpoDeErro | null): ErroGarcom {
  const codigo = corpo?.error?.code;
  const msg = corpo?.error?.message;
  if (status === 401) return new ErroGarcom("sessao", "Sua sessão terminou. Entre novamente.", status, codigo);
  if (status === 403) return new ErroGarcom("permissao", "Sua conta não tem permissão para isso nesta loja.", status, codigo);
  if (status === 409) return new ErroGarcom("conflito", msg ?? "O pedido mudou de status. A lista foi atualizada.", status, codigo);
  if (status === 408 || status === 429 || status >= 500) return new ErroGarcom("indisponivel", "A plataforma não respondeu. O pedido continua aqui; tente de novo.", status, codigo);
  const detalhes = corpo?.error?.details?.map((d) => campoLegivel(d.path)).filter(Boolean).join(" · ");
  return new ErroGarcom("invalido", detalhes || msg || "Não foi possível concluir. Confira os dados e tente novamente.", status, codigo);
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function criarClienteGarcom(fetcher: Fetch = (input, init) => fetch(input, init)) {
  let csrf: string | undefined;

  async function chamar<T>(caminho: string, opcoes: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
    const method = opcoes.method ?? "GET";
    const headers: Record<string, string> = { accept: "application/json", ...opcoes.headers };
    if (opcoes.body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && csrf) headers["x-csrf-token"] = csrf;
    let resposta: Response;
    try {
      resposta = await fetcher(caminho, { method, headers, body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body), credentials: "include", cache: "no-store", signal: opcoes.signal });
    } catch (causa) {
      if ((causa as { name?: string })?.name === "AbortError") throw causa;
      throw new ErroGarcom("indisponivel", "Sem conexão com a plataforma. O pedido continua aqui; tente de novo.");
    }
    if (!resposta.ok) throw erroDaResposta(resposta.status, await resposta.json().catch(() => null) as CorpoDeErro | null);
    if (resposta.status === 204) return undefined as T;
    try { return await resposta.json() as T; }
    catch { throw new ErroGarcom("indisponivel", "A plataforma respondeu algo inesperado. Tente de novo.", resposta.status); }
  }

  return {
    /** Restaura a sessão do cookie após recarregar (e o CSRF das mutações). */
    async sessao(signal?: AbortSignal) {
      const r = await chamar<{ user: Usuario; csrfToken?: string }>(ROTAS.sessao, { signal });
      csrf = r.csrfToken; return r.user;
    },
    async entrar(email: string, password: string) {
      const r = await chamar<{ user: Usuario; csrfToken?: string }>(ROTAS.login, { method: "POST", body: { email, password, client: "web" } }).catch((e: unknown) => {
        if (e instanceof ErroGarcom && e.status === 401) throw new ErroGarcom("invalido", "E-mail ou senha incorretos.", 401, e.codigo);
        if (e instanceof ErroGarcom && e.status === 403) throw new ErroGarcom("permissao", "Esta conta não tem acesso ao modo garçom. Use uma conta da equipe cadastrada no painel.", 403, e.codigo);
        throw e;
      });
      csrf = r.csrfToken; return r.user;
    },
    async sair() {
      try { await chamar<void>(ROTAS.sessao, { method: "DELETE" }); }
      catch (e) { if (!(e instanceof ErroGarcom && e.tipo === "sessao")) throw e; }
      finally { csrf = undefined; }
    },
    locais: async (signal?: AbortSignal) => (await chamar<{ workplaces: LocalDeTrabalho[] }>(ROTAS.locais, { signal })).workplaces,
    pedidos: async (companyId: string, estado: "open" | "all" = "all", signal?: AbortSignal) =>
      (await chamar<{ orders: Pedido[] }>(`${ROTAS.pedidos(companyId)}?state=${estado}`, { signal })).orders,
    /** `chave` é gerada uma vez por tentativa e repetida nos reenvios. */
    enviar: (companyId: string, pedido: NovoPedidoMesa, chave: string) =>
      chamar<Pedido>(ROTAS.pedidos(companyId), { method: "POST", body: pedido, headers: { "idempotency-key": chave } }),
    cancelar: (companyId: string, pedido: Pick<Pedido, "id" | "status">) =>
      chamar<Pedido>(ROTAS.cancelar(companyId, pedido.id), { method: "POST", body: { from: pedido.status } }),
    get temCsrf() { return !!csrf; },
  };
}

export type ClienteGarcom = ReturnType<typeof criarClienteGarcom>;
export const podeEnviar = (papel: Papel) => papel === "admin" || papel === "waiter";
