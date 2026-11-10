import menu from "./menu.json";

export type ConfigCheckout = { tipo: "externo" | "whatsapp"; numeroWhatsApp: string; url: string; nome: string; aviso: string };

/** Configuração por implantação. Modelos e receitas 3D têm capacidades próprias no catálogo. */
export const restaurante = {
  id: "alhoaria",
  nome: "Alhoaria",
  subtitulo: "Pão de alho recheado",
  descricao: "Lanches no pão de alho, com recheios, pastas e queijo gratinado. Escolha seu lanche, bebidas e acompanhamentos.",
  siteUrl: "https://alhoaria-web.vercel.app",
  logo: "/assets/photos/logo-anota.webp",
  imagemSocial: "/assets/hero/poster-final.webp",
  versaoCatalogo: "2026-11-06",
  dataCatalogo: "06/11/2026",
  avisoPrecos: "Preços do cardápio de 06/11/2026. Valores estimados; o preço final e a entrega são confirmados pela loja.",
  idioma: "pt-BR",
  moeda: "BRL",
  instagram: menu.brand.instagram,
  instagramNome: "@alhoaria",
  assinatura: "Alhoaria · desde 2023",
  checkout: {
    tipo: "externo",
    numeroWhatsApp: "",
    url: menu.brand.anota_ai_url,
    nome: "Anota AI",
    aviso: "Copie o resumo e monte o mesmo pedido no Anota AI para finalizar. A sacola não é transferida automaticamente.",
  } as ConfigCheckout,
  experiencias: { heroCinema: true, montagem3D: true },
  cores: {
    fundo: "#0A0A0A",
    superficie: "#141414",
    borda: "#262626",
    texto: "#F5F5F0",
    textoSecundario: "#A8A8A0",
    creme: "#FFF8E7",
    destaque: "#FF6A1A",
    ouro: "#E8B84A",
    queijo: "#F0C75E",
    madeira: "#5C3D2E",
    madeiraEscura: "#241812",
  },
  unidades: menu.units,
} as const;
