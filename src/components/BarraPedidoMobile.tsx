import Link from "next/link";
import { PEDIDO_URL } from "@/lib/links";

export default function BarraPedidoMobile() {
  return (
    <aside
      aria-label="Ações de pedido"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-carvao-borda bg-carvao/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <Link
          href="/bancada"
          prefetch={false}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded border border-macarico/80 px-3 text-sm font-bold text-osso transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso"
        >
          Monte o seu
        </Link>
        <a
          href={PEDIDO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded bg-macarico px-4 text-sm font-bold text-carvao transition-colors duration-150 hover:bg-queijo active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso"
        >
          Peça agora
        </a>
      </div>
    </aside>
  );
}
