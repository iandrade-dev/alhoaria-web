import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A bancada nova agora é o /bancada: esta rota só repassa, com a query string.
export default async function PaginaPrototipo({ searchParams }: Props) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, x);
  const s = q.toString();
  redirect(s ? `/bancada?${s}` : "/bancada");
}
