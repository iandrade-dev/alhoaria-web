import { redirect } from "next/navigation";

export default async function PaginaBancadaClassica({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [nome, valor] of Object.entries(await searchParams)) for (const item of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) q.append(nome, item);
  redirect(q.size ? `/cardapio?${q}` : "/cardapio");
}
