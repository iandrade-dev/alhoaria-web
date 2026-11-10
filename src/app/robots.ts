import type { MetadataRoute } from "next";
import { restaurante } from "@/data/restaurante";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/bancada/prototipo" }, sitemap: new URL("/sitemap.xml", restaurante.siteUrl).toString() };
}
