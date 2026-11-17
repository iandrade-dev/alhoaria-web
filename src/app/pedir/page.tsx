import Image from "next/image";
import Link from "next/link";
import MarcaLogo from "@/components/MarcaLogo";
import { restaurante } from "@/data/restaurante";
import { metadataDaPagina } from "@/lib/seo";

export const metadata = metadataDaPagina(`Como quer pedir? — ${restaurante.nome}`, "Escolha o cardápio simples ou monte seu lanche na experiência 3D. A mesma sacola acompanha você.", "/pedir");

export default function EscolherModo() {
  return (
    <section className="flex min-h-[100svh] items-center justify-center bg-carvao px-4 pb-12 pt-28 text-osso sm:px-6">
      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-4">
          <MarcaLogo size={72} className="h-16 w-16 shrink-0" priority />
          <div>
            <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Como quer pedir?</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-osso-muted">
              A mesma sacola guarda os dois caminhos até o final do pedido.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-[1fr_1.15fr]">
          <Link
            href="/cardapio"
            prefetch={false}
            className="group flex flex-col justify-between rounded-2xl border border-macarico/50 bg-carvao-leve p-6 transition-colors hover:border-macarico focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro"
          >
            <div>
              <h2 className="font-display text-3xl uppercase leading-none text-osso">Cardápio simples</h2>
              <p className="mt-3 text-sm leading-6 text-osso-muted">
                Veja preços, escolha os ingredientes de cada lanche e adicione bebidas e porções direto na sacola.
              </p>
            </div>
            <span className="mt-8 inline-flex min-h-11 w-fit items-center rounded-xl bg-macarico px-5 text-sm font-bold text-carvao transition-colors group-hover:bg-queijo">
              Abrir cardápio →
            </span>
          </Link>

          {restaurante.experiencias.montagem3D && (
            <Link
              href="/bancada"
              prefetch={false}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-carvao-borda bg-carvao-leve transition-colors hover:border-osso/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ouro"
            >
              <div>
                <div className="relative h-40 w-full overflow-hidden bg-carvao">
                  <Image
                    src="/assets/home/monte-o-seu.webp"
                    alt="Bancada 3D da cozinha"
                    fill
                    sizes="(max-width: 768px) 100vw, 480px"
                    className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-6 pb-0">
                  <h2 className="font-display text-3xl uppercase leading-none text-osso">Montar na bancada 3D</h2>
                  <p className="mt-3 text-sm leading-6 text-osso-muted">
                    Monte camada por camada na cozinha interativa, ou na sua mesa com realidade aumentada.
                  </p>
                </div>
              </div>
              <div className="p-6 pt-5">
                <span className="inline-flex min-h-11 items-center rounded-xl border border-macarico px-5 text-sm font-bold text-macarico transition-colors group-hover:bg-macarico group-hover:text-carvao">
                  Ir para a bancada →
                </span>
              </div>
            </Link>
          )}
        </div>

        <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-sm text-osso-muted underline underline-offset-4 hover:text-osso">
          ← Voltar ao início
        </Link>
      </div>
    </section>
  );
}
