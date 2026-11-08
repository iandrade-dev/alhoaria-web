import Hero from "@/components/hero/Hero";
import QuemProva from "@/components/QuemProva";
import MonteOSeu from "@/components/MonteOSeu";
import Unidades from "@/components/Unidades";
import Fechamento from "@/components/Fechamento";
import Rodape from "@/components/Rodape";
import BarraPedidoMobile from "@/components/BarraPedidoMobile";

export default function Home() {
  return (
    <>
      <Hero />
      <QuemProva />
      <MonteOSeu />
      <Unidades />
      <Fechamento />
      <Rodape />
      <BarraPedidoMobile />
    </>
  );
}
