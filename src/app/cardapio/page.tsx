import Image from "next/image";
import Link from "next/link";
import CardapioRapido, { AcoesLanche } from "@/components/pedido/CardapioRapido";
import styles from "@/components/pedido/pedido.module.css";
import { CATALOGO } from "@/data/catalogo";
import { restaurante } from "@/data/restaurante";
import { brl } from "@/components/bancada-proto/cardapio";
import { metadataDaPagina } from "@/lib/seo";

export const metadata = metadataDaPagina(`Cardápio — ${restaurante.nome}`, "Escolha lanches, personalize ingredientes e adicione bebidas e porções à sua sacola.", "/cardapio");

export default async function PaginaCardapio({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [nome, valor] of Object.entries(await searchParams)) for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) q.append(nome, item);
  return <div className={styles.page}><div className={styles.inner}>
    <p className={styles.eyebrow}>O seu pedido, do seu jeito</p>
    <h1 className={styles.heading}>Cardápio {restaurante.nome}</h1>
    <p className={styles.intro}>Escolha lanches, bebidas e porções para sua sacola.</p>
    <CardapioRapido consulta={q.toString()}>{CATALOGO.map((produto) => <article className={styles.card} key={produto.id} data-busca={`${produto.nome} ${produto.descricao}`}>
      <Image src={produto.foto} alt={produto.nome} width={600} height={400} sizes="(max-width: 600px) 105px, (max-width: 1000px) 45vw, 340px" className={styles.photo} />
      <div className={styles.cardBody}><h3>{produto.nome}</h3><p className={styles.description}>{produto.descricao}</p><p className={styles.price}>{brl(produto.preco)}</p><AcoesLanche id={produto.id} />{produto.experiencia3D && restaurante.experiencias.montagem3D && <Link href={`/bancada?lanche=${produto.id}`} prefetch={false} className={styles.textButton}>Montar na experiência 3D</Link>}</div>
    </article>)}</CardapioRapido>
    <noscript><p className={styles.notice}>Ative o JavaScript para personalizar e usar a sacola, ou abra o cardápio da loja para pedir.</p><a href={restaurante.checkout.url} className={styles.primary}>Pedir no {restaurante.checkout.nome}</a></noscript>
  </div></div>;
}
