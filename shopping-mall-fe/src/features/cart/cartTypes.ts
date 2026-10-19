import type { ItemStatus } from "../items/itemTypes";

export type CartProduct = {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  imageUrls: string;
  status: ItemStatus;
  isSeckill: boolean;
  endTime: string | null;
};

export type CartEntry = {
  itemDTO: CartProduct;
  quantity: number;
};

export type CartUpdateRequest = {
  itemId: number;
  quantity: number;
};

export type CartCheckoutDraftItem = {
  itemId: number;
  quantity: number;
  price: number;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
};

export type CartCheckoutLocationState = {
  source: "cart";
  items: CartCheckoutDraftItem[];
  estimatedTotal: number;
};
