"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Trash2, Plus, Minus, ArrowRight, MessageCircle, MapPin, Store } from "lucide-react";
import { useCart } from "@/store/useCart";
import menuData from "@/data/menu.json";

export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    getTotal,
    selectedUnit,
    setSelectedUnit,
  } = useCart();

  const [orderType, setOrderType] = useState<"entrega" | "retirada">("entrega");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  if (!isCartOpen) return null;

  const total = getTotal();

  const handleWhatsAppCheckout = () => {
    if (items.length === 0) return;

    const unitName =
      selectedUnit === "pedra-branca"
        ? "Pedra Branca (Palhoça)"
        : "Kobrasol (São José)";

    let message = `Oi, Alhoaria! Quero fazer um pedido 🧄\n`;
    message += `*Unidade:* ${unitName}\n`;
    message += `*Modalidade:* ${orderType === "entrega" ? "Entrega (Delivery)" : "Retirada no balcão"}\n\n`;
    message += `*Itens do Pedido:*\n`;

    items.forEach((item) => {
      let itemLine = `• ${item.quantity}x ${item.name}`;
      if (item.configuration) {
        const parts = [];
        if (item.configuration.pasta) parts.push(item.configuration.pasta);
        if (item.configuration.sauce) parts.push(item.configuration.sauce);
        if (item.configuration.proteins && item.configuration.proteins.length > 0) {
          parts.push(item.configuration.proteins.join(", "));
        }
        if (parts.length > 0) itemLine += ` (${parts.join(" · ")})`;
      }
      itemLine += ` — R$ ${(item.unitPrice * item.quantity).toFixed(2).replace(".", ",")}\n`;
      if (item.notes) {
        itemLine += `  _Obs: ${item.notes}_\n`;
      }
      message += itemLine;
    });

    message += `\n*Total: R$ ${total.toFixed(2).replace(".", ",")}*\n\n`;
    message += `*Nome:* ${customerName.trim() || "[Preencher no zap]"}\n`;
    if (orderType === "entrega") {
      message += `*Endereço de entrega:* ${customerAddress.trim() || "[Preencher no zap]"}\n`;
    }

    const encoded = encodeURIComponent(message);
    const whatsappNumber = menuData.brand.whatsapp_default;
    window.open(`https://wa.me/${whatsappNumber}?text=${encoded}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={() => setIsCartOpen(false)} />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md h-full bg-carvao border-l border-carvao-borda shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-carvao-borda flex items-center justify-between bg-carvao-leve">
          <div>
            <h2 className="font-display text-xl uppercase tracking-wide text-osso">
              Seu Pedido
            </h2>
            <p className="text-xs text-osso-muted">
              {items.length} {items.length === 1 ? "item adicionado" : "itens adicionados"}
            </p>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 text-osso-muted hover:text-osso transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-osso-muted space-y-3">
              <Store className="w-12 h-12 text-osso-muted/40" />
              <p className="text-sm font-medium">Sua sacola está vazia.</p>
              <p className="text-xs text-osso-muted/70 max-w-xs">
                Escolha um dos nossos lanches artesanais no pão de alho para começar.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.cartId}
                className="bg-carvao-leve border border-carvao-borda rounded-2xl p-3.5 flex gap-3.5 items-center"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black flex-shrink-0">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-sm uppercase tracking-wide text-osso truncate">
                    {item.name}
                  </h4>
                  {item.configuration && (
                    <p className="text-[11px] text-ouro truncate">
                      {[
                        item.configuration.pasta,
                        item.configuration.sauce,
                        ...(item.configuration.proteins || []),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[11px] text-osso-muted truncate italic">
                      Obs: {item.notes}
                    </p>
                  )}
                  <span className="text-xs font-bold text-ouro mt-1 block tabular-nums">
                    R$ {(item.unitPrice * item.quantity).toFixed(2).replace(".", ",")}
                  </span>
                </div>

                <div className="flex flex-col items-end justify-between h-full gap-2">
                  <button
                    onClick={() => removeItem(item.cartId)}
                    className="text-osso-muted hover:text-rose-500 transition-colors p-1"
                    aria-label="Remover item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 bg-carvao border border-carvao-borda rounded-lg px-2 py-0.5">
                    <button
                      onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                      className="text-osso-muted hover:text-osso text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-semibold text-osso w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                      className="text-osso-muted hover:text-osso text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Unit & Order Details Form */}
          {items.length > 0 && (
            <div className="border-t border-carvao-borda pt-4 space-y-4">
              {/* Unit Selector */}
              <div>
                <label className="text-xs uppercase font-bold tracking-wider text-osso-muted block mb-2">
                  Selecione a Unidade
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedUnit("pedra-branca")}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      selectedUnit === "pedra-branca"
                        ? "bg-macarico/15 border-macarico text-macarico"
                        : "bg-carvao-leve border-carvao-borda text-osso hover:border-white/20"
                    }`}
                  >
                    Pedra Branca
                    <span className="block text-[10px] text-osso-muted font-normal">
                      Palhoça
                    </span>
                  </button>
                  <button
                    onClick={() => setSelectedUnit("kobrasol")}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      selectedUnit === "kobrasol"
                        ? "bg-macarico/15 border-macarico text-macarico"
                        : "bg-carvao-leve border-carvao-borda text-osso hover:border-white/20"
                    }`}
                  >
                    Kobrasol
                    <span className="block text-[10px] text-osso-muted font-normal">
                      São José
                    </span>
                  </button>
                </div>
              </div>

              {/* Delivery vs Pickup */}
              <div>
                <label className="text-xs uppercase font-bold tracking-wider text-osso-muted block mb-2">
                  Forma de Recebimento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrderType("entrega")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      orderType === "entrega"
                        ? "bg-ouro/15 border-ouro text-ouro"
                        : "bg-carvao-leve border-carvao-borda text-osso hover:border-white/20"
                    }`}
                  >
                    Entrega (Delivery)
                  </button>
                  <button
                    onClick={() => setOrderType("retirada")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      orderType === "retirada"
                        ? "bg-ouro/15 border-ouro text-ouro"
                        : "bg-carvao-leve border-carvao-borda text-osso hover:border-white/20"
                    }`}
                  >
                    Retirada no Balcão
                  </button>
                </div>
              </div>

              {/* Client Info */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-carvao-leve border border-carvao-borda rounded-xl p-2.5 text-xs text-osso placeholder:text-osso-muted/50 focus:outline-none focus:border-macarico"
                />
                {orderType === "entrega" && (
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Endereço (Rua, Número, Bairro, Compl.)"
                    className="w-full bg-carvao-leve border border-carvao-borda rounded-xl p-2.5 text-xs text-osso placeholder:text-osso-muted/50 focus:outline-none focus:border-macarico"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Checkout */}
        {items.length > 0 && (
          <div className="p-5 border-t border-carvao-borda bg-carvao-leve space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-osso-muted">
                Total do Pedido
              </span>
              <span className="font-sans font-bold text-2xl text-ouro tabular-nums">
                R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {/* Primary CTA: WhatsApp */}
            <button
              onClick={handleWhatsAppCheckout}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-macarico hover:bg-macarico-glow text-white font-bold text-sm transition-all shadow-macarico-glow active:scale-[0.98]"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Mandar Pedido no WhatsApp</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            {/* Secondary CTA: Anota AI */}
            <a
              href={menuData.brand.anota_ai_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-osso-muted hover:text-osso text-xs font-semibold border border-white/10 transition-colors text-center"
            >
              Ou pedir diretamente pelo Anota AI
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
