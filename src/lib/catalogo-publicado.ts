import { cache } from "react";
import { origemDaPlataforma } from "./origem-plataforma.mjs";
import type {
  CheckoutPublicado, GrupoPublicado, MidiaPublicada, OpcaoPublicada, ProdutoPublicado, PublicacaoAlhoaria, VariantePublicada,
} from "./publicacao-alhoaria";

type Registro = Record<string, unknown>;

function registro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function inteiro(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function lista<T>(valor: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(valor)) return null;
  const dados: T[] = [];
  for (const item of valor) {
    const lido = ler(item);
    if (lido === null) return null;
    dados.push(lido);
  }
  return dados;
}

function escolha(valor: Registro) {
  if (!texto(valor.id) || !inteiro(valor.priceCents) || typeof valor.available !== "boolean") return null;
  return { id: valor.id, reference: texto(valor.reference) ? valor.reference : null, priceCents: valor.priceCents, available: valor.available };
}

function variante(valor: unknown): VariantePublicada | null {
  if (!registro(valor) || !texto(valor.label)) return null;
  const dados = escolha(valor);
  return dados ? { ...dados, label: valor.label } : null;
}

function opcao(valor: unknown): OpcaoPublicada | null {
  if (!registro(valor) || !texto(valor.name)) return null;
  const dados = escolha(valor);
  return dados ? { ...dados, name: valor.name } : null;
}

function grupo(valor: unknown): GrupoPublicado | null {
  if (!registro(valor) || !texto(valor.id) || !texto(valor.name)
    || !inteiro(valor.min) || !inteiro(valor.max) || valor.min > valor.max) return null;
  const options = lista(valor.options, opcao);
  if (!options || valor.max > options.length) return null;
  return {
    id: valor.id, reference: texto(valor.reference) ? valor.reference : null, name: valor.name,
    min: valor.min, max: valor.max, options,
  };
}

function midia(valor: unknown, origem: string, empresa: string, kind: MidiaPublicada["kind"]): MidiaPublicada | null {
  if (!registro(valor) || valor.kind !== kind || !texto(valor.id) || !texto(valor.mime)) return null;
  const path = `/v1/media/public/${encodeURIComponent(empresa)}/${encodeURIComponent(valor.id)}`;
  const mimeValido = kind === "image" ? valor.mime.startsWith("image/") : valor.mime === "model/gltf-binary";
  if (valor.url !== path || !mimeValido) return null;
  return {
    id: valor.id, url: origem + path, kind, mime: valor.mime,
    width: inteiro(valor.width) && valor.width > 0 ? valor.width : null,
    height: inteiro(valor.height) && valor.height > 0 ? valor.height : null,
  };
}

function produto(valor: unknown, origem: string, empresa: string): ProdutoPublicado | null {
  if (!registro(valor) || !texto(valor.name) || typeof valor.description !== "string"
    || (valor.categoryId !== null && !texto(valor.categoryId)) || !inteiro(valor.sortOrder) || !Array.isArray(valor.photos)) return null;
  const dados = escolha(valor);
  const ingredients = lista(valor.ingredients, (item) => texto(item) ? item : null);
  const variants = lista(valor.variants, variante);
  const optionGroups = lista(valor.optionGroups, grupo);
  if (!dados || !ingredients || !variants || !optionGroups) return null;
  const photos = valor.photos.flatMap((item) => midia(item, origem, empresa, "image") ?? []);
  let model3d: ProdutoPublicado["model3d"] = null;
  if (registro(valor.model3d)) {
    const model = midia(valor.model3d.model, origem, empresa, "model");
    const fallback = midia(valor.model3d.fallback, origem, empresa, "image");
    if (model && fallback) model3d = { model, fallback };
  }
  return {
    ...dados, name: valor.name, description: valor.description, categoryId: valor.categoryId, sortOrder: valor.sortOrder,
    ingredients, variants, optionGroups, photos, model3d,
  };
}

function categoria(valor: unknown) {
  if (!registro(valor) || !texto(valor.id) || !texto(valor.name) || !inteiro(valor.sortOrder)) return null;
  return { id: valor.id, name: valor.name, sortOrder: valor.sortOrder };
}

function urlHttps(valor: unknown): string | undefined {
  if (typeof valor !== "string") return;
  try {
    const url = new URL(valor);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    // O destino é opcional no painel.
  }
}

function checkout(valor: unknown): CheckoutPublicado | null {
  if (!registro(valor)) return null;
  const { type, handoff } = valor;
  const url = urlHttps(valor.url);
  if (type === "anota_ai" && handoff === "recreate_order") return { type, handoff, url };
  if (type === "external" && handoff === "redirect") return { type, handoff, url };
  if (type === "whatsapp" && handoff === "message" && typeof valor.phone === "string" && /^\d{10,15}$/.test(valor.phone)) {
    return { type, handoff, phone: valor.phone };
  }
  return null;
}

/** Projeta somente os dados consumidos pelo site e valida a empresa antes de expor mídia. */
export function projetarPublicacao(valor: unknown, origem: string, slug: string): PublicacaoAlhoaria | null {
  if (!registro(valor) || valor.schemaVersion !== 1 || !texto(valor.publicationId)
    || !inteiro(valor.publicationVersion) || valor.publicationVersion < 1
    || !texto(valor.publishedAt) || !Number.isFinite(Date.parse(valor.publishedAt))
    || !registro(valor.company)) return null;

  const { company } = valor;
  const { id, publicSlug, brandName, currency } = company;
  if (!texto(id) || publicSlug !== slug || !texto(brandName) || currency !== "BRL") return null;
  const destino = checkout(company.checkout);
  const categories = lista(valor.categories, categoria);
  const products = lista(valor.products, (item) => produto(item, origem, id));
  if (!destino || !categories || !products || new Set(products.map(({ id: chave }) => chave)).size !== products.length) return null;

  return {
    schemaVersion: 1, publicationId: valor.publicationId, publicationVersion: valor.publicationVersion, publishedAt: valor.publishedAt,
    company: { id, publicSlug: slug, brandName, currency, checkout: destino },
    categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
    products: products.sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/** A mesma publicação atende o layout e a página em uma renderização do servidor. */
export const carregarPublicacao = cache(async (): Promise<PublicacaoAlhoaria | null> => {
  const origem = origemDaPlataforma();
  const slug = (process.env.ALHOARIA_PUBLIC_SLUG ?? "alhoaria").trim();
  if (!origem || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const resposta = await fetch(`${origem}/v1/publishing/public/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (!resposta.ok) return null;
    return projetarPublicacao(await resposta.json(), origem, slug);
  } catch {
    return null;
  }
});
