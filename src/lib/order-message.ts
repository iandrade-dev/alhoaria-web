import { formatBRL } from "@/lib/money";

export type OrderLine = {
  quantity: number;
  /** Nome do item, sempre o de menu.json. */
  name: string;
  /** Preço da linha (preço unitário × quantidade). */
  linePrice: number;
  notes?: string;
  configuration?: {
    pasta?: string;
    sauce?: string;
    proteins?: string[];
  };
};

export function unitShortName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Tira o parêntese comercial ("Monte o Seu") e coloca as escolhas do cardápio. */
export function formatItemName(
  line: Pick<OrderLine, "name" | "configuration">
): string {
  const parts = [
    line.configuration?.pasta,
    line.configuration?.sauce,
    ...(line.configuration?.proteins ?? []),
  ].filter((part): part is string => Boolean(part && part.trim()));
  if (parts.length === 0) return line.name;
  const base = line.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return `${base} (${parts.join(", ")})`;
}

export function buildOrderMessage(input: {
  unitName: string;
  items: OrderLine[];
  total: number;
  customerName: string;
  orderType: "entrega" | "retirada";
  address: string;
}): string {
  const lines = [
    "Oi, Alhoaria! Quero fazer um pedido 🧄",
    `Unidade: ${unitShortName(input.unitName)}`,
  ];

  for (const item of input.items) {
    lines.push(
      `${item.quantity}x ${formatItemName(item)} — R$ ${formatBRL(item.linePrice)}`
    );
    const notes = item.notes?.trim();
    if (notes) lines.push(`   Obs: ${notes}`);
  }

  const name = input.customerName.trim();
  lines.push(`Total: R$ ${formatBRL(input.total)}`);
  lines.push(name ? `Nome: ${name}` : "Nome:");

  if (input.orderType === "retirada") {
    lines.push("Entrega ou retirada: Retirada");
  } else {
    const address = input.address.trim();
    lines.push(
      address
        ? `Entrega ou retirada: Entrega — ${address}`
        : "Entrega ou retirada: Entrega —"
    );
  }

  return lines.join("\n");
}
