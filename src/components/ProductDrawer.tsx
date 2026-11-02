"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { MenuItem } from "./ProductCard";
import { useCart } from "@/store/useCart";
import { formatBRL } from "@/lib/money";
import FoodMedia from "./FoodMedia";
import DrawerDialog from "./DrawerDialog";
import { useNarrowScreen } from "./useNarrowScreen";

interface ProductDrawerProps {
  item: MenuItem | null;
  onClose: () => void;
}

const choiceClass = (active: boolean, tone: "macarico" | "ouro") =>
  `flex min-h-11 cursor-pointer items-center rounded border px-3 py-2 text-left text-sm font-semibold focus-within:border-osso ${
    active
      ? tone === "ouro"
        ? "border-ouro bg-ouro/10 text-osso"
        : "border-macarico bg-macarico/15 text-osso"
      : "border-carvao-borda bg-carvao-leve text-osso"
  }`;

export default function ProductDrawer({ item, onClose }: ProductDrawerProps) {
  const { addItem } = useCart();
  const narrow = useNarrowScreen();
  const [shown, setShown] = useState<MenuItem | null>(item);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedPasta, setSelectedPasta] = useState("");
  const [selectedSauce, setSelectedSauce] = useState("");
  const [selectedProteins, setSelectedProteins] = useState<string[]>([]);

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setQuantity(1);
    setNotes("");
    setSelectedPasta(item.options?.pasta?.[0] ?? "");
    setSelectedSauce(item.options?.sauce?.[0] ?? "");
    setSelectedProteins([]);
  }, [item]);

  const current = item ?? shown;
  if (!current) return null;

  let currentUnitPrice = current.price;
  if (current.isConfigurable && current.options?.proteins) {
    currentUnitPrice += selectedProteins.reduce((sum, proteinName) => {
      const match = current.options?.proteins?.find((protein) => protein.name === proteinName);
      return sum + (match?.price || 0);
    }, 0);
  }
  const totalPrice = currentUnitPrice * quantity;

  const toggleProtein = (proteinName: string) => {
    setSelectedProteins((currentNames) =>
      currentNames.includes(proteinName)
        ? currentNames.filter((name) => name !== proteinName)
        : [...currentNames, proteinName]
    );
  };

  const handleAddToCart = () => {
    addItem({
      itemId: current.id,
      name: current.name,
      unitPrice: currentUnitPrice,
      quantity,
      image: current.image,
      notes: notes.trim(),
      configuration: current.isConfigurable
        ? {
            pasta: selectedPasta,
            sauce: selectedSauce,
            proteins: selectedProteins,
          }
        : undefined,
    });
    onClose();
  };

  return (
    <DrawerDialog
      open={item !== null}
      onClose={onClose}
      labelledBy="product-drawer-title"
      placement={narrow ? "sheet" : "center"}
    >
      <div className="flex items-center justify-between border-b border-carvao-borda px-4 py-2">
        <h2
          id="product-drawer-title"
          className="font-display text-lg uppercase tracking-wide text-osso"
        >
          {current.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-osso-muted"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-5">
        <div className="relative h-56 overflow-hidden rounded-xl border border-carvao-borda bg-madeira-escura sm:h-64">
          <FoodMedia
            src={current.image}
            name={current.name}
            alt={current.image ? current.name : ""}
            fill
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover"
          />
        </div>

        <p className="text-sm leading-relaxed text-osso-muted">{current.description}</p>

        {current.ingredients && current.ingredients.length > 0 && (
          <div className="rounded-lg border border-carvao-borda bg-carvao-leve p-4">
            <h3 className="text-sm font-semibold text-osso">Vai no lanche</h3>
            <ul className="mt-2 space-y-1 text-sm text-osso">
              {current.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </div>
        )}

        {current.isConfigurable && current.options && (
          <div className="space-y-5 border-t border-carvao-borda pt-5">
            <h3 className="font-display text-lg uppercase tracking-wide text-osso">
              Monte o seu mac cheese
            </h3>

            {current.options.pasta && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-osso-muted">Massa</legend>
                <div className="grid grid-cols-2 gap-2">
                  {current.options.pasta.map((pasta) => (
                    <label key={pasta} className={choiceClass(selectedPasta === pasta, "macarico")}>
                      <input
                        type="radio"
                        name="massa"
                        value={pasta}
                        checked={selectedPasta === pasta}
                        onChange={() => setSelectedPasta(pasta)}
                        className="sr-only"
                      />
                      {pasta}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {current.options.sauce && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-osso-muted">Molho</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {current.options.sauce.map((sauce) => (
                    <label key={sauce} className={choiceClass(selectedSauce === sauce, "ouro")}>
                      <input
                        type="radio"
                        name="molho"
                        value={sauce}
                        checked={selectedSauce === sauce}
                        onChange={() => setSelectedSauce(sauce)}
                        className="sr-only"
                      />
                      {sauce}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {current.options.proteins && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-osso-muted">
                  Proteína extra (opcional)
                </legend>
                <div className="space-y-2">
                  {current.options.proteins.map((protein) => {
                    const checked = selectedProteins.includes(protein.name);
                    return (
                      <label
                        key={protein.name}
                        className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded border px-3 py-2 text-sm focus-within:border-osso ${
                          checked
                            ? "border-macarico bg-macarico/15 text-osso"
                            : "border-carvao-borda bg-carvao-leve text-osso"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProtein(protein.name)}
                          className="sr-only"
                        />
                        <span className="font-semibold">{protein.name}</span>
                        <span className="font-semibold tabular-nums text-ouro">
                          + R$ {formatBRL(protein.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        )}

        <div className="border-t border-carvao-borda pt-5">
          <label htmlFor="item-notes" className="mb-2 block text-sm font-semibold text-osso-muted">
            Observação
          </label>
          <textarea
            id="item-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: sem cebola, molho à parte"
            rows={2}
            className="w-full rounded border border-carvao-borda bg-carvao-leve p-3 text-base text-osso placeholder:text-osso-muted focus:outline-none focus-visible:border-macarico"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-carvao-borda px-4 py-3">
        <div className="flex items-center rounded border border-carvao-borda bg-carvao-leve">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            aria-label={`Diminuir quantidade de ${current.name}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg text-osso-muted"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums text-osso">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => value + 1)}
            aria-label={`Aumentar quantidade de ${current.name}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg text-osso-muted"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={handleAddToCart}
          className="flex min-h-11 flex-1 items-center justify-between rounded bg-macarico px-4 text-sm font-semibold text-carvao"
        >
          <span>Colocar na sacola</span>
          <span className="tabular-nums">R$ {formatBRL(totalPrice)}</span>
        </button>
      </div>
    </DrawerDialog>
  );
}
