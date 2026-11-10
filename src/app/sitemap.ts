import type { MetadataRoute } from "next";
import { restaurante } from "@/data/restaurante";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/pedir", "/cardapio"].map((caminho) => ({ url: new URL(caminho, restaurante.siteUrl).toString() }));
}
