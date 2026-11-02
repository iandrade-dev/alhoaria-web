import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  cartId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  image: string;
  notes?: string;
  configuration?: {
    pasta?: string;
    sauce?: string;
    proteins?: string[];
  };
}

interface CartStore {
  items: CartItem[];
  selectedUnit: "pedra-branca" | "kobrasol";
  isCartOpen: boolean;
  setSelectedUnit: (unit: "pedra-branca" | "kobrasol") => void;
  setIsCartOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, "cartId">) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getTotalItems: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      selectedUnit: "pedra-branca",
      isCartOpen: false,
      setSelectedUnit: (unit) => set({ selectedUnit: unit }),
      setIsCartOpen: (open) => set({ isCartOpen: open }),
      addItem: (newItem) => {
        const items = get().items;
        const configKey = JSON.stringify(newItem.configuration || {});
        const notesKey = (newItem.notes || "").trim().toLowerCase();
        const cartId = `${newItem.itemId}-${configKey}-${notesKey}`;

        const existingIndex = items.findIndex((i) => i.cartId === cartId);
        if (existingIndex > -1) {
          const updated = [...items];
          updated[existingIndex].quantity += newItem.quantity;
          set({ items: updated, isCartOpen: true });
        } else {
          set({ items: [...items, { ...newItem, cartId }], isCartOpen: true });
        }
      },
      removeItem: (cartId) => {
        set({ items: get().items.filter((i) => i.cartId !== cartId) });
      },
      updateQuantity: (cartId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartId);
        } else {
          set({
            items: get().items.map((i) =>
              i.cartId === cartId ? { ...i, quantity } : i
            ),
          });
        }
      },
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
      },
      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: "alhoaria-cart-storage",
    }
  )
);
