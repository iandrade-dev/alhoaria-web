"use client";

import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useCart } from "@/store/useCart";
import menuData from "@/data/menu.json";
import { formatBRL } from "@/lib/money";
import { buildOrderMessage, unitShortName } from "@/lib/order-message";
import { findUnit, whatsAppForUnit } from "@/lib/whatsapp";
import FoodMedia from "./FoodMedia";
import DrawerDialog from "./DrawerDialog";
import { useNarrowScreen } from "./useNarrowScreen";

const orderUnitIds = ["pedra-branca", "kobrasol"] as const;

export default function CartDrawer() {
  const items = useCart((state) => state.items);
  const isCartOpen = useCart((state) => state.isCartOpen);
  const setIsCartOpen = useCart((state) => state.setIsCartOpen);
  const updateQuantity = useCart((state) => state.updateQuantity);
  const removeItem = useCart((state) => state.removeItem);
  const selectedUnit = useCart((state) => state.selectedUnit);
  const setSelectedUnit = useCart((state) => state.setSelectedUnit);
  const narrow = useNarrowScreen();

  const [orderType, setOrderType] = useState<"entrega" | "retirada">("entrega");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const handleWhatsAppCheckout = () => {
    if (items.length === 0) return;
    const unit = findUnit(selectedUnit);
    const message = buildOrderMessage({
      unitName: unit?.name ?? "Pedra Branca",
      items: items.map((item) => ({
        quantity: item.quantity,
        name: item.name,
        linePrice: item.unitPrice * item.quantity,
        notes: item.notes,
        configuration: item.configuration,
      })),
      total,
      customerName,
      orderType,
      address: customerAddress,
    });
    const number = whatsAppForUnit(selectedUnit);
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const choiceClass = (active: boolean) =>
    `flex min-h-11 cursor-pointer items-center rounded border px-3 text-sm font-semibold focus-within:border-osso ${
      active
        ? "border-macarico bg-macarico/15 text-osso"
        : "border-carvao-borda bg-carvao-leve text-osso"
    }`;

  return (
    <DrawerDialog
      open={isCartOpen}
      onClose={() => setIsCartOpen(false)}
      labelledBy="cart-drawer-title"
      placement={narrow ? "sheet" : "end"}
    >
      <div className="flex items-center justify-between border-b border-carvao-borda bg-carvao-leve px-4 py-2">
        <div>
          <h2
            id="cart-drawer-title"
            className="font-display text-xl uppercase tracking-wide text-osso"
          >
            Seu pedido
          </h2>
          <p className="text-sm text-osso-muted">
            {items.length === 1 ? "1 item" : `${items.length} itens`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCartOpen(false)}
          aria-label="Fechar"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-osso-muted"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-osso-muted">
            <p className="text-sm font-semibold text-osso">Sua sacola está vazia.</p>
            <p className="mt-2 max-w-xs text-sm">
              Escolha um lanche no cardápio para começar.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.cartId}
              className="flex gap-3 rounded-lg border border-carvao-borda bg-carvao-leve p-3"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-madeira-escura">
                <FoodMedia
                  src={item.image}
                  name={item.name}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base uppercase tracking-wide text-osso">
                  {item.name}
                </h3>
                {item.configuration && (
                  <p className="text-sm text-osso-muted">
                    {[
                      item.configuration.pasta,
                      item.configuration.sauce,
                      ...(item.configuration.proteins || []),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {item.notes && (
                  <p className="text-sm text-osso-muted">Obs: {item.notes}</p>
                )}
                <p className="mt-1 text-sm font-semibold tabular-nums text-ouro">
                  R$ {formatBRL(item.unitPrice * item.quantity)}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded border border-carvao-borda bg-carvao">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                      aria-label={`Diminuir quantidade de ${item.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg text-osso-muted"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-osso">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                      aria-label={`Aumentar quantidade de ${item.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg text-osso-muted"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.cartId)}
                    aria-label={`Remover ${item.name}`}
                    className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-macarico"
                  >
                    Tirar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {items.length > 0 && (
          <div className="space-y-4 border-t border-carvao-borda pt-4">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-osso">Unidade</legend>
              <div className="grid grid-cols-2 gap-2">
                {orderUnitIds.map((unitId) => {
                  const unit = menuData.units.find((entry) => entry.id === unitId);
                  if (!unit) return null;
                  const active = selectedUnit === unitId;
                  return (
                    <label key={unitId} className={choiceClass(active)}>
                      <input
                        type="radio"
                        name="unidade"
                        value={unitId}
                        checked={active}
                        onChange={() => setSelectedUnit(unitId)}
                        className="sr-only"
                      />
                      {unitShortName(unit.name)}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-osso">
                Entrega ou retirada
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={choiceClass(orderType === "entrega")}>
                  <input
                    type="radio"
                    name="recebimento"
                    value="entrega"
                    checked={orderType === "entrega"}
                    onChange={() => setOrderType("entrega")}
                    className="sr-only"
                  />
                  Entrega
                </label>
                <label className={choiceClass(orderType === "retirada")}>
                  <input
                    type="radio"
                    name="recebimento"
                    value="retirada"
                    checked={orderType === "retirada"}
                    onChange={() => setOrderType("retirada")}
                    className="sr-only"
                  />
                  Retirada
                </label>
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="customer-name" className="block text-sm font-semibold text-osso-muted">
                Nome
              </label>
              <input
                id="customer-name"
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                className="w-full min-h-11 rounded border border-carvao-borda bg-carvao-leve px-3 text-base text-osso placeholder:text-osso-muted focus:outline-none focus-visible:border-macarico"
              />
              {orderType === "entrega" && (
                <>
                  <label
                    htmlFor="customer-address"
                    className="block text-sm font-semibold text-osso-muted"
                  >
                    Endereço
                  </label>
                  <input
                    id="customer-address"
                    type="text"
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    placeholder="Rua, número, bairro"
                    autoComplete="street-address"
                    className="w-full min-h-11 rounded border border-carvao-borda bg-carvao-leve px-3 text-base text-osso placeholder:text-osso-muted focus:outline-none focus-visible:border-macarico"
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-3 border-t border-carvao-borda bg-carvao-leve p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-osso-muted">Total</span>
            <span className="text-2xl font-bold tabular-nums text-ouro">
              R$ {formatBRL(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleWhatsAppCheckout}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded bg-macarico px-4 text-sm font-semibold text-carvao"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            Manda pro WhatsApp
          </button>
          <a
            href={menuData.brand.anota_ai_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 w-full items-center justify-center rounded border border-carvao-borda bg-carvao px-4 text-sm font-semibold text-osso"
          >
            Pedir pelo Anota AI
          </a>
        </div>
      )}
    </DrawerDialog>
  );
}
