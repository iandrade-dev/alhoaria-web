export type CheckoutPublicado = {
  type: "anota_ai" | "whatsapp" | "external";
  handoff: "recreate_order" | "message" | "redirect";
  url?: string;
  phone?: string;
};

export type MidiaPublicada = {
  id: string;
  url: string;
  kind: "image" | "model";
  mime: string;
  width: number | null;
  height: number | null;
};

type EscolhaPublicada = {
  id: string;
  reference?: string | null;
  priceCents: number;
  available: boolean;
};

export type VariantePublicada = EscolhaPublicada & { label: string };
export type OpcaoPublicada = EscolhaPublicada & { name: string };

export type GrupoPublicado = {
  id: string;
  reference?: string | null;
  name: string;
  min: number;
  max: number;
  options: OpcaoPublicada[];
};

export type ProdutoPublicado = EscolhaPublicada & {
  name: string;
  description: string;
  categoryId: string | null;
  sortOrder: number;
  ingredients: string[];
  variants: VariantePublicada[];
  optionGroups: GrupoPublicado[];
  photos: MidiaPublicada[];
  model3d: { model: MidiaPublicada; fallback: MidiaPublicada } | null;
};

export type PublicacaoAlhoaria = {
  schemaVersion: 1;
  publicationId: string;
  publicationVersion: number;
  publishedAt: string;
  company: {
    id: string;
    publicSlug: string;
    brandName: string;
    currency: "BRL";
    checkout: CheckoutPublicado;
  };
  categories: { id: string; name: string; sortOrder: number }[];
  products: ProdutoPublicado[];
};
