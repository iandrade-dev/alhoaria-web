import Link from "next/link";
import BotaoSacola from "./pedido/BotaoSacola";

export default function BarraPedidoMobile() {
  return (
    <aside
      aria-label="Ações de pedido"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-carvao-borda bg-carvao/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <Link
          href="/pedir"
          prefetch={false}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded border border-macarico/80 px-3 text-sm font-bold text-osso transition-colors duration-150 hover:bg-macarico hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-osso"
        >
          Escolher meu lanche
        </Link>
        <BotaoSacola />
      </div>
    </aside>
  );
}
