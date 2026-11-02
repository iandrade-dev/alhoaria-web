"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { X, Check, Plus, Minus, Flame, Box, ShoppingBag } from "lucide-react";
import { MenuItem } from "./ProductCard";
import { useCart } from "@/store/useCart";

interface ProductDrawerProps {
  item: MenuItem | null;
  onClose: () => void;
}

export default function ProductDrawer({ item, onClose }: ProductDrawerProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  // Mac Cheese configurator states
  const [selectedPasta, setSelectedPasta] = useState<string>("");
  const [selectedSauce, setSelectedSauce] = useState<string>("");
  const [selectedProteins, setSelectedProteins] = useState<string[]>([]);

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setNotes("");
      if (item.options?.pasta?.[0]) setSelectedPasta(item.options.pasta[0]);
      if (item.options?.sauce?.[0]) setSelectedSauce(item.options.sauce[0]);
      setSelectedProteins([]);
    }
  }, [item]);

  if (!item) return null;

  // Calculate dynamic unit price
  let currentUnitPrice = item.price;
  if (item.isConfigurable && item.options?.proteins) {
    const proteinSum = selectedProteins.reduce((sum, pName) => {
      const match = item.options?.proteins?.find((p) => p.name === pName);
      return sum + (match?.price || 0);
    }, 0);
    currentUnitPrice += proteinSum;
  }
  const totalPrice = currentUnitPrice * quantity;

  const toggleProtein = (proteinName: string) => {
    if (selectedProteins.includes(proteinName)) {
      setSelectedProteins(selectedProteins.filter((p) => p !== proteinName));
    } else {
      setSelectedProteins([...selectedProteins, proteinName]);
    }
  };

  const handleAddToCart = () => {
    addItem({
      itemId: item.id,
      name: item.name,
      unitPrice: currentUnitPrice,
      quantity,
      image: item.image,
      notes: notes.trim(),
      configuration: item.isConfigurable
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Drawer Card */}
      <div className="relative w-full sm:max-w-xl max-h-[90vh] bg-carvao border border-carvao-borda rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in slide-in-from-bottom-8 duration-300">
        {/* Header bar / Close */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-carvao/95 border-b border-carvao-borda backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-display uppercase text-base text-osso tracking-wide">
              Detalhes do Item
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-osso-muted hover:text-osso transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Item Image with Torch Badge */}
          <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden bg-black/60 border border-carvao-borda">
            <Image
              src={item.image}
              alt={item.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-carvao via-transparent to-transparent opacity-90" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-carvao/90 border border-ouro/40 text-xs font-semibold text-ouro backdrop-blur-md flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-macarico" />
                Receita Artesanal da Casa
              </span>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-osso mb-2">
              {item.name}
            </h2>
            <p className="text-sm text-osso-muted leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* "Vai no lanche" Ingredient Checklist */}
          {item.ingredients && item.ingredients.length > 0 && (
            <div className="bg-carvao-leve border border-carvao-borda p-4 rounded-2xl space-y-2.5">
              <h4 className="text-xs uppercase font-bold tracking-wider text-ouro flex items-center gap-1.5">
                <Check className="w-4 h-4 text-queijo" />
                Vai no Lanche
              </h4>
              <ul className="space-y-1.5">
                {item.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="text-xs sm:text-sm text-osso flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-macarico" />
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mac Cheese Customizer */}
          {item.isConfigurable && item.options && (
            <div className="space-y-5 border-t border-carvao-borda pt-5">
              <h3 className="font-display text-lg uppercase tracking-wide text-osso">
                Monte o seu Mac Cheese
              </h3>

              {/* Step 1: Pasta */}
              {item.options.pasta && (
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-osso-muted">
                    1. Escolha a Massa
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {item.options.pasta.map((pasta) => (
                      <button
                        key={pasta}
                        onClick={() => setSelectedPasta(pasta)}
                        className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all ${
                          selectedPasta === pasta
                            ? "bg-macarico/10 border-macarico text-macarico"
                            : "bg-carvao-leve border-carvao-borda text-osso hover:border-white/20"
                        }`}
                      >
                        {pasta}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Sauce */}
              {item.options.sauce && (
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-osso-muted">
                    2. Escolha o Molho Cremoso
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {item.options.sauce.map((sauce) => (
                      <button
                        key={sauce}
                        onClick={() => setSelectedSauce(sauce)}
                        className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all ${
                          selectedSauce === sauce
                            ? "bg-ouro/10 border-ouro text-ouro"
                            : "bg-carvao-leve border-carvao-borda text-osso hover:border-white/20"
                        }`}
                      >
                        {sauce}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Additional Proteins */}
              {item.options.proteins && (
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-osso-muted">
                    3. Proteínas Adicionais (Opcional)
                  </label>
                  <div className="space-y-2">
                    {item.options.proteins.map((protein) => {
                      const isSelected = selectedProteins.includes(protein.name);
                      return (
                        <div
                          key={protein.name}
                          onClick={() => toggleProtein(protein.name)}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm cursor-pointer transition-all ${
                            isSelected
                              ? "bg-macarico/15 border-macarico text-osso"
                              : "bg-carvao-leve border-carvao-borda text-osso-muted hover:border-white/20"
                          }`}
                        >
                          <span className="font-medium text-osso">
                            {protein.name}
                          </span>
                          <span className="text-ouro font-bold tabular-nums">
                            + R$ {protein.price.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observations Input */}
          <div className="space-y-2 border-t border-carvao-borda pt-5">
            <label className="text-xs uppercase font-bold tracking-wider text-osso-muted">
              Observações do Pedido
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, molho à parte, bem passado..."
              rows={2}
              className="w-full bg-carvao-leve border border-carvao-borda rounded-xl p-3 text-sm text-osso placeholder:text-osso-muted/50 focus:outline-none focus:border-macarico transition-colors"
            />
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="sticky bottom-0 z-20 px-5 py-4 bg-carvao border-t border-carvao-borda flex items-center justify-between gap-4">
          {/* Quantity Stepper */}
          <div className="flex items-center gap-3 bg-carvao-leve border border-carvao-borda rounded-xl p-1.5">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-osso hover:bg-white/10 active:scale-90 transition-colors"
              aria-label="Diminuir quantidade"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-bold text-sm text-osso tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-osso hover:bg-white/10 active:scale-90 transition-colors"
              aria-label="Aumentar quantidade"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-between px-5 py-3.5 rounded-xl bg-macarico hover:bg-macarico-glow text-white font-bold text-sm transition-all shadow-macarico-glow active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Adicionar
            </span>
            <span className="tabular-nums font-sans">
              R$ {totalPrice.toFixed(2).replace(".", ",")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
