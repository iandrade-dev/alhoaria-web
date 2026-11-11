import Hero from "@/components/hero/Hero";
import QuemProva from "@/components/QuemProva";
import MonteOSeu from "@/components/MonteOSeu";
import Unidades from "@/components/Unidades";
import Fechamento from "@/components/Fechamento";
import Rodape from "@/components/Rodape";
import { restaurante } from "@/data/restaurante";
import { CATALOGO } from "@/data/catalogo";
import { jsonLdSeguro } from "@/lib/seo";

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro({
        "@context": "https://schema.org", "@type": "Restaurant", "@id": `${restaurante.siteUrl}/#restaurante`, name: restaurante.nome,
        description: restaurante.descricao, url: restaurante.siteUrl, image: new URL(restaurante.imagemSocial, restaurante.siteUrl).toString(),
        logo: new URL(restaurante.logo, restaurante.siteUrl).toString(), sameAs: [restaurante.instagram],
        hasMenu: { "@type": "Menu", url: `${restaurante.siteUrl}/cardapio`, hasMenuSection: { "@type": "MenuSection", name: "Lanches", hasMenuItem: CATALOGO.map((p) => ({ "@type": "MenuItem", name: p.nome, description: p.descricao, image: new URL(p.foto, restaurante.siteUrl).toString(), offers: { "@type": "Offer", price: (p.preco / 100).toFixed(2), priceCurrency: restaurante.moeda } })) } },
        department: restaurante.unidades.filter((u) => !u.is_coming_soon).map((u) => ({ "@type": "Restaurant", name: `${restaurante.nome} ${u.name}`, address: u.address, url: u.maps_url })),
      }) }} />
      <Hero />
      <QuemProva />
      <MonteOSeu />
      <Unidades />
      <Fechamento />
      <Rodape />
    </>
  );
}
