import Image from "next/image";
import { restaurante } from "@/data/restaurante";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
  selo?: boolean;
};

/** Logo da marca integrado a fundos escuros ou como selo circular sobre fotos e 3D. */
export default function MarcaLogo({ size = 48, className = "", priority = false, alt = `Logo ${restaurante.nome}`, selo = false }: Props) {
  return (
    <Image
      src={restaurante.logo}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={
        selo
          ? `rounded-full bg-[#090807] object-cover ring-1 ring-[#fff8e7]/20 shadow-[0_10px_28px_rgba(0,0,0,.55)] ${className}`
          : `object-contain mix-blend-lighten contrast-[1.2] brightness-[0.94] ${className}`
      }
    />
  );
}
