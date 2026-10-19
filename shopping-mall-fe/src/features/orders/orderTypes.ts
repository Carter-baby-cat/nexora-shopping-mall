import type { CartCheckoutDraftItem } from "../cart/cartTypes";

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export type OrderRecord = {
  id: number;
  orderNo: string;
  userId: number;
  totalAmount: number | string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrderLine = {
  imageUrl: string | null;
  itemName: string;
  quantity: number;
  totalPrice: number | string;
};

export type CheckoutPriceRequest = {
  itemId: number;
  quantity: number;
  price: number;
};

export type CheckoutPriceResult =
  | {
      attention: string;
      updatedItems: CheckoutPriceRequest[];
    }
  | {
      info: string;
      totalPrice: number | string;
    };

export type NormalOrderRequest = {
  itemId: number;
  quantity: number;
};

export type NormalOrderCreated = {
  info: string;
  order: OrderRecord;
};

export type SeckillOrderCreated = {
  info: string;
  orderNo: string;
};

export type CancelOrderResult = {
  cancelled: boolean;
};

export type CheckoutDraft = CartCheckoutDraftItem[];

export type ProductDetailCheckoutState = {
  source: "product-detail";
  itemId: number;
  itemName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  isSeckill: boolean;
  idempotencyKey?: string;
  brand?: string;
  category?: string;
};
