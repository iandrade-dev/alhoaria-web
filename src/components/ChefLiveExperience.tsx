"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flame,
  UtensilsCrossed,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  MessageCircle,
  MapPin,
  Check,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import KitchenCanvas from "./KitchenCanvas";
import type { CameraPreset } from "@/lib/kitchen-engine";
import { useCart } from "@/store/useCart";
import menuData from "@/data/menu.json";
import { formatBRL } from "@/lib/money";
import { whatsAppForUnit, findUnit } from "@/lib/whatsapp";
import FoodMedia from "./FoodMedia";

const fillings = [
  {
    id: "costela",
    menuId: "costela",
    root: "filling_costela",
    tag: "Mais pedido 🔥",
    detail: "Cozida 6h. Desfiada, transbordando suculência.",
  },
  {
    id: "alcatra",
    menuId: "mr-alcatra",
    root: "filling_alcatra",
    tag: "Corte nobre",
    detail: "Tiras macias de alcatra na chapa quente.",
  },
  {
    id: "pork",
    menuId: "pulled-pork",
    root: "filling_pork",
    tag: "Defumado 4h",
    detail: "Pernil suíno desmanchando na mordida.",
  },
  {
    id: "frango",
    menuId: "frango",
    root: "filling_frango",
    tag: "Crocante & macio",
    detail: "Sobrecoxa dourada marinada no alho e ervas.",
  },
  {
    id: "brocolis",
    menuId: "brocolis-queijo",
    root: "filling_brocolis",
    tag: "Vegetariano",
    detail: "Brócolis fresco puxado no alho, azeite e fondue.",
  },
] as const;

const toppings = [
  {
    root: "stage_garlic",
    name: "Pasta de alho da casa",
    detail: "A receita secreta da Alhoaria.",
    iconId: "6959",
    color: "E8B84A",
    without: "pasta de alho",
  },
  {
    root: "stage_cream",
    name: "Creme artesanal de queijo",
    detail: "Aveludado, derrete junto com o recheio.",
    iconId: "8330",
    color: "F0C75E",
    without: "creme de queijo",
  },
  {
    root: "stage_gratin",
    name: "Queijo gratinado no maçarico",
    detail: "Mussarela borbulhando tostada no fogo vivo.",
    iconId: "3104",
    color: "FF6A1A",
    without: "queijo gratinado",
  },
];

const companionSides = [
  {
    id: "chopp-lohn-caneca",
    name: "Caneca Chopp Lohn 500ml",
    price: 9.9,
    detail: "Pilsen artesanal trincando de gelado",
    iconId: "8383",
    color: "E8B84A",
    image: "",
  },
  {
    id: "batata-rustica",
    name: "Batata Rústica Temperada",
    price: 24.9,
    detail: "Com alecrim e alho frito crocante",
    iconId: "8332",
    color: "E8B84A",
    image: "",
  },
  {
    id: "dadinho-tapioca",
    name: "Dadinho de Tapioca",
    price: 29.9,
    detail: "Crocante por fora, puxa-puxa por dentro",
    iconId: "8330",
    color: "F0C75E",
    image: "",
  },
];

function getMenuProduct(menuId: string) {
  const item = menuData.items.find((entry) => entry.id === menuId);
  if (!item) throw new Error(`Item ausente: ${menuId}`);
  return item;
}

export default function ChefLiveExperience() {
  const [filling, setFilling] = useState<(typeof fillings)[number]["id"]>("costela");
  const [extras, setExtras] = useState<string[]>([
    "stage_garlic",
    "stage_cream",
    "stage_gratin",
  ]);
  const [sides, setSides] = useState<string[]>([]);
  const [unitId, setUnitId] = useState<string>(menuData.units[0].id);
  const [replayKey, setReplayKey] = useState(0);
  const [torchTriggerKey, setTorchTriggerKey] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("bancada");
  const [status, setStatus] = useState("A bancada está pronta. Escolha o recheio!");
  const [addedToast, setAddedToast] = useState(false);

  const { addItem, setIsCartOpen } = useCart();

  const selectedFilling = fillings.find((entry) => entry.id === filling) ?? fillings[0];
  const product = getMenuProduct(selectedFilling.menuId);

  // 3D Engine model selection queue
  const selection = [
    "stage_bread",
    ...(extras.includes("stage_garlic") ? ["stage_garlic"] : []),
    selectedFilling.root,
    ...extras.filter((extra) => extra !== "stage_garlic"),
  ];

  const toggleExtra = (root: string) => {
    setExtras((current) =>
      current.includes(root) ? current.filter((id) => id !== root) : [...current, root]
    );
  };

  const toggleSide = (id: string) => {
    setSides((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  // Calculate dynamic total price
  const sidesTotal = sides.reduce((acc, sideId) => {
    const side = companionSides.find((s) => s.id === sideId);
    return acc + (side ? side.price : 0);
  }, 0);

  const totalPrice = product.price + sidesTotal;

  // Add to standard cart
  const handleAddToCart = () => {
    const withoutList = toppings
      .filter((topping) => !extras.includes(topping.root))
      .map((topping) => topping.without);

    addItem({
      itemId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity: 1,
      image: product.image,
      notes: withoutList.length ? `sem ${withoutList.join(", ")}` : undefined,
    });

    // Add selected sides
    for (const sideId of sides) {
      const side = companionSides.find((s) => s.id === sideId);
      if (side) {
        addItem({
          itemId: side.id,
          name: side.name,
          unitPrice: side.price,
          quantity: 1,
          image: side.image,
        });
      }
    }

    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2400);
    setIsCartOpen(true);
  };

  // Direct WhatsApp instant order
  const handleDirectWhatsAppOrder = () => {
    const unit = findUnit(unitId) ?? menuData.units[0];
    const unitPhone = whatsAppForUnit(unitId);

    const withoutList = toppings
      .filter((topping) => !extras.includes(topping.root))
      .map((topping) => topping.without);

    const notes = withoutList.length ? `(sem ${withoutList.join(", ")})` : "";

    const lines = [
      "Oi, Alhoaria! Quero pedir agora pelo site 🧄🔥",
      `Unidade: ${unit.name.split(" - ")[0]}`,
      "",
      `1x ${product.name} ${notes} — R$ ${formatBRL(product.price)}`,
    ];

    for (const sideId of sides) {
      const side = companionSides.find((s) => s.id === sideId);
      if (side) {
        lines.push(`1x ${side.name} — R$ ${formatBRL(side.price)}`);
      }
    }

    lines.push("");
    lines.push(`Total: R$ ${formatBRL(totalPrice)}`);
    lines.push("Nome:");
    lines.push("Entrega ou retirada:");

    const message = lines.join("\n");
    const url = `https://wa.me/${unitPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const fireTorch = () => {
    setTorchTriggerKey((k) => k + 1);
  };

  return (
    <div className="relative w-full overflow-hidden bg-carvao text-osso">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,106,26,0.08),transparent_55%)]" />

      {/* Hero Header */}
      <section className="relative mx-auto max-w-7xl px-4 pt-6 pb-4 sm:px-6 sm:pt-10 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-carvao-borda pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-macarico/30 bg-macarico/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-macarico">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-macarico opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-macarico" />
              </span>
              <span>Experiência 3D ao Vivo</span>
            </div>
            <h1 className="font-display text-4xl uppercase tracking-tight text-osso sm:text-6xl lg:text-7xl">
              A Bancada do Chef
            </h1>
            <p className="max-w-xl text-sm sm:text-base text-osso-muted leading-relaxed">
              Lanche bom é no <strong className="text-osso font-semibold">Pão de Alho</strong>.
              Escolha a sua combinação, acione o maçarico e veja o queijo tostar na sua frente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReplayKey((k) => k + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-carvao-borda bg-carvao-leve px-4 text-xs sm:text-sm font-semibold text-osso hover:border-ouro/40 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Remontar Sanduíche</span>
            </button>

            <Link
              href="/cardapio"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-carvao-borda bg-carvao px-4 text-xs sm:text-sm font-semibold text-osso-muted hover:text-osso hover:border-carvao-borda transition-colors"
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>Cardápio em Lista</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Main Interactive Stage */}
      <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Left Column: 3D Physics Canvas */}
          <div className="space-y-4 lg:col-span-7">
            <div className="relative">
              <KitchenCanvas
                selection={selection}
                replayKey={replayKey}
                torchTriggerKey={torchTriggerKey}
                cameraPreset={cameraPreset}
                onStatus={setStatus}
              />
            </div>

            {/* Chef Status & Atmosphere Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-carvao-borda bg-carvao-leve px-4 py-3 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-carvao border border-carvao-borda flex items-center justify-center">
                  <Image
                    src="https://img.icons8.com/?id=20441&format=png&color=F5F5F0&size=48"
                    alt="Chef"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </span>
                <span className="font-medium text-osso">{status}</span>
              </div>

              <button
                type="button"
                onClick={fireTorch}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-macarico px-4 py-2 font-bold text-carvao shadow-lg shadow-macarico/20 active:scale-95 transition-all"
              >
                <Flame className="h-4 w-4 fill-carvao" />
                <span>Acionar Maçarico 🔥</span>
              </button>
            </div>
          </div>

          {/* Right Column: Customizer & Action Controls */}
          <div className="space-y-6 lg:col-span-5">
            {/* Step 1: Escolha a Proteína Core */}
            <div className="rounded-2xl border border-carvao-borda bg-carvao-leve p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    src="https://img.icons8.com/?id=8332&format=png&color=E8B84A&size=48"
                    alt="Recheio"
                    width={22}
                    height={22}
                  />
                  <h3 className="font-display text-lg uppercase tracking-wide text-osso">
                    1. Escolha o Recheio
                  </h3>
                </div>
                <span className="text-xs text-ouro font-semibold uppercase">O Carro-Chefe</span>
              </div>

              <div className="space-y-2">
                {fillings.map((item) => {
                  const prod = getMenuProduct(item.menuId);
                  const isSelected = filling === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilling(item.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-macarico bg-macarico/15 shadow-md shadow-macarico/10"
                          : "border-carvao-borda bg-carvao hover:border-carvao-borda/80"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-madeira-escura border border-carvao-borda">
                          <FoodMedia
                            src={prod.image}
                            name={prod.name}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm uppercase tracking-wide text-osso truncate">
                              {prod.name}
                            </span>
                            <span className="hidden sm:inline-block rounded bg-carvao-borda/60 px-1.5 py-0.5 text-[10px] font-semibold text-ouro uppercase">
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-xs text-osso-muted line-clamp-1 mt-0.5">
                            {item.detail}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block font-bold text-sm text-ouro tabular-nums">
                          R$ {formatBRL(prod.price)}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-macarico mt-0.5">
                            <Check className="h-3 w-3" /> Escolhido
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Pastas & Queijo no Maçarico */}
            <div className="rounded-2xl border border-carvao-borda bg-carvao-leve p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    src="https://img.icons8.com/?id=6959&format=png&color=E8B84A&size=48"
                    alt="Alho"
                    width={22}
                    height={22}
                  />
                  <h3 className="font-display text-lg uppercase tracking-wide text-osso">
                    2. Pastas & Queijo
                  </h3>
                </div>
                <span className="text-xs text-osso-muted font-medium">Toque para retirar</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {toppings.map((topping) => {
                  const checked = extras.includes(topping.root);
                  return (
                    <button
                      key={topping.root}
                      type="button"
                      onClick={() => toggleExtra(topping.root)}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                        checked
                          ? "border-ouro/50 bg-ouro/10"
                          : "border-carvao-borda bg-carvao opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={`https://img.icons8.com/?id=${topping.iconId}&format=png&color=${topping.color}&size=48`}
                          alt=""
                          width={20}
                          height={20}
                          className="shrink-0"
                        />
                        <div>
                          <span
                            className={`block font-display text-xs uppercase tracking-wide ${
                              checked ? "text-osso" : "text-osso-muted line-through"
                            }`}
                          >
                            {topping.name}
                          </span>
                          <span className="block text-[11px] text-osso-muted">
                            {topping.detail}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`h-5 w-5 rounded flex items-center justify-center border transition-colors ${
                          checked
                            ? "border-ouro bg-ouro text-carvao font-bold"
                            : "border-carvao-borda bg-carvao"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Acompanhamentos & Chopp Lohn (Upsell Rápido) */}
            <div className="rounded-2xl border border-carvao-borda bg-carvao-leve p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    src="https://img.icons8.com/?id=8383&format=png&color=E8B84A&size=48"
                    alt="Chopp"
                    width={22}
                    height={22}
                  />
                  <h3 className="font-display text-lg uppercase tracking-wide text-osso">
                    3. Quer Acompanhamento?
                  </h3>
                </div>
                <span className="text-xs text-macarico font-semibold">Chopp & Porções</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {companionSides.map((side) => {
                  const isChecked = sides.includes(side.id);
                  return (
                    <button
                      key={side.id}
                      type="button"
                      onClick={() => toggleSide(side.id)}
                      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                        isChecked
                          ? "border-ouro bg-ouro/15 shadow-sm"
                          : "border-carvao-borda bg-carvao hover:border-ouro/30"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Image
                            src={`https://img.icons8.com/?id=${side.iconId}&format=png&color=${side.color}&size=48`}
                            alt=""
                            width={18}
                            height={18}
                          />
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center border ${
                              isChecked
                                ? "border-ouro bg-ouro text-carvao"
                                : "border-carvao-borda"
                            }`}
                          >
                            {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <span className="block font-display text-xs uppercase text-osso mt-1 line-clamp-1">
                          {side.name}
                        </span>
                      </div>
                      <span className="block font-bold text-xs text-ouro mt-2">
                        + R$ {formatBRL(side.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Checkout Visceral (WhatsApp / Sacola) */}
            <div className="rounded-2xl border border-ouro/30 bg-gradient-to-b from-[#1c130c] to-carvao-leve p-6 space-y-5 shadow-xl shadow-black/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-carvao-borda pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-osso-muted">
                    Unidade de Atendimento:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-macarico" />
                    <select
                      value={unitId}
                      onChange={(e) => setUnitId(e.target.value)}
                      className="bg-carvao border border-carvao-borda rounded-lg px-2.5 py-1 text-xs font-bold text-osso focus:outline-none focus:border-ouro"
                    >
                      {menuData.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-osso-muted block">
                    Total do Pedido:
                  </span>
                  <span className="font-display text-3xl font-bold tabular-nums text-ouro">
                    R$ {formatBRL(totalPrice)}
                  </span>
                </div>
              </div>

              {/* Visceral CTAs */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDirectWhatsAppOrder}
                  className="w-full flex items-center justify-center gap-3 rounded-xl bg-macarico hover:bg-[#ff7a2e] text-white font-bold py-4 px-6 text-base shadow-xl shadow-macarico/25 active:scale-98 transition-all"
                >
                  <MessageCircle className="h-5 w-5 fill-white" />
                  <span className="uppercase tracking-wide">QUERO ESSE LANCHE AGORA!</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-carvao-borda bg-carvao hover:bg-white/5 text-osso font-semibold py-3 px-4 text-sm transition-colors"
                >
                  <ShoppingBag className="h-4 w-4 text-ouro" />
                  <span>Colocar na Sacola e Continuar</span>
                </button>
              </div>

              {addedToast && (
                <p className="text-center text-xs font-semibold text-ouro animate-fade-in">
                  ✓ Lanche adicionado à sacola com sucesso!
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mini Highlights Footer Banner */}
      <section className="border-t border-carvao-borda bg-[#100a07] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <Image
                src="https://img.icons8.com/?id=8332&format=png&color=E8B84A&size=64"
                alt=""
                width={36}
                height={36}
              />
              <div>
                <h4 className="font-display text-sm uppercase text-osso">Costela 6 Horas</h4>
                <p className="text-xs text-osso-muted">Desfiada à mão, suculenta e macia.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <Image
                src="https://img.icons8.com/?id=3104&format=png&color=FF6A1A&size=64"
                alt=""
                width={36}
                height={36}
              />
              <div>
                <h4 className="font-display text-sm uppercase text-osso">Fogo do Maçarico</h4>
                <p className="text-xs text-osso-muted">Gratinado borbulhante na hora da entrega.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <Image
                src="https://img.icons8.com/?id=8383&format=png&color=E8B84A&size=64"
                alt=""
                width={36}
                height={36}
              />
              <div>
                <h4 className="font-display text-sm uppercase text-osso">Chopp Lohn Trincando</h4>
                <p className="text-xs text-osso-muted">Cerveja artesanal de Santa Catarina.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
