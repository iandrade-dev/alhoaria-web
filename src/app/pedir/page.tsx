import Image from "next/image";
import Link from "next/link";
import { restaurante } from "@/data/restaurante";
import { metadataDaPagina } from "@/lib/seo";

export const metadata = metadataDaPagina(`Como quer pedir? — ${restaurante.nome}`, "Escolha o cardápio simples ou monte seu lanche na experiência 3D. A mesma sacola acompanha você.", "/pedir");

export default function EscolherModo() {
  return <section className="flex min-h-[100svh] items-center justify-center bg-carvao px-4 pb-12 pt-28 text-osso">
    <div className="w-full max-w-3xl text-center">
      <Image src={restaurante.logo} alt={restaurante.nome} width={112} height={112} className="mx-auto h-28 w-28 object-contain" priority />
      <h1 className="mt-5 font-hand text-4xl sm:text-5xl">Como quer escolher hoje?</h1>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-osso-muted">Do pedido rápido à brincadeira de montar. Seus lanches, bebidas e porções ficam juntos na mesma sacola.</p>
      <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
        <Link href="/cardapio" prefetch={false} className="rounded-3xl border border-ouro/40 bg-carvao-leve p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">
          <span className="text-xs font-bold uppercase tracking-widest text-queijo">Rápido e leve</span><h2 className="mt-3 text-2xl font-bold">Cardápio simples</h2><p className="mt-3 text-sm leading-6 text-osso-muted">Veja as fotos, personalize os ingredientes e adicione tudo à sacola. Sem esperar a animação.</p><span className="mt-6 inline-flex min-h-11 items-center font-bold text-macarico">Abrir cardápio →</span>
        </Link>
        {restaurante.experiencias.montagem3D && <Link href="/bancada" prefetch={false} className="rounded-3xl border border-osso/20 bg-carvao-leve p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro">
          <span className="text-xs font-bold uppercase tracking-widest text-queijo">Pra brincar de montar</span><h2 className="mt-3 text-2xl font-bold">Experiência 3D</h2><p className="mt-3 text-sm leading-6 text-osso-muted">Pegue os ingredientes e veja o lanche ganhar forma. Use na sua mesa com AR quando disponível.</p><span className="mt-6 inline-flex min-h-11 items-center font-bold text-macarico">Montar meu lanche →</span>
        </Link>}
      </div>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-sm text-osso-muted underline">Voltar ao início</Link>
    </div>
  </section>;
}
