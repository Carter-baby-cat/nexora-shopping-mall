export type MerchantItemStatus = "ONLINE" | "SOLD_OUT" | "OFFLINE";

export type MerchantItem = {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  imageUrls: string;
  status: MerchantItemStatus;
  isSeckill: boolean;
  endTime: string | null;
};

export type CreateMerchantItemRequest = {
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  imageUrls: string;
  isSeckill: boolean;
  endTime: string | null;
};

export type UpdateMerchantItemRequest = {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  description: string;
  imageUrls: string;
  status: MerchantItemStatus;
  endTime: string | null;
};

export type AdjustMerchantStockRequest = {
  itemId: number;
  delta: number;
};
