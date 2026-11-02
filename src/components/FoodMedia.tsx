import Image from "next/image";

type FoodMediaProps = {
  src?: string;
  name: string;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
};

export default function FoodMedia({
  src,
  name,
  alt = "",
  className,
  sizes,
  priority,
  fill,
}: FoodMediaProps) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-madeira-escura px-3 text-center text-sm font-semibold text-osso-muted ${
          fill ? "absolute inset-0" : "h-full w-full"
        } ${className ?? ""}`}
      >
        [foto: {name}]
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={640}
      height={480}
      priority={priority}
      className={className}
    />
  );
}
