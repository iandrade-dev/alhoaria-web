import Hero from "@/components/hero/Hero";
import QuemProva from "@/components/QuemProva";
import MonteOSeu from "@/components/MonteOSeu";
import Unidades from "@/components/Unidades";
import Fechamento from "@/components/Fechamento";
import Rodape from "@/components/Rodape";
import { CatalogoDaRota } from "@/components/CatalogoProvider";
import { restaurante } from "@/data/restaurante";
import { carregarPublicacao } from "@/lib/catalogo-publicado";
import { jsonLdSeguro } from "@/lib/seo";

export default async function Home() {
  const publicacao = await carregarPublicacao();
  const produtos = publicacao?.products.filter((produto) => produto.available) ?? [];
  const itens = produtos.map((produto) => ({
    "@type": "MenuItem",
    name: produto.name,
    description: produto.description,
    image: produto.photos[0]?.url ?? produto.model3d?.fallback.url,
    offers: { "@type": "Offer", price: (produto.priceCents / 100).toFixed(2), priceCurrency: restaurante.moeda },
  }));
  return (
    <>
      <CatalogoDaRota publicacao={publicacao} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro({
        "@context": "https://schema.org", "@type": "Restaurant", "@id": `${restaurante.siteUrl}/#restaurante`, name: restaurante.nome,
        description: restaurante.descricao, url: restaurante.siteUrl, image: new URL(restaurante.imagemSocial, restaurante.siteUrl).toString(),
        logo: new URL(restaurante.logo, restaurante.siteUrl).toString(), sameAs: [restaurante.instagram],
        hasMenu: { "@type": "Menu", url: `${restaurante.siteUrl}/cardapio`, hasMenuItem: itens },
        department: restaurante.unidades.filter((u) => !("is_coming_soon" in u && u.is_coming_soon)).map((u) => ({ "@type": "Restaurant", name: `${restaurante.nome} ${u.name}`, address: u.address, url: u.maps_url })),
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
