export type ItemStatus = "ONLINE" | "SOLD_OUT" | "OFFLINE";

/** Search documents keep the field names serialized by the Elasticsearch model. */
export type SearchItem = {
  id: number;
  merchant_id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image_urls: string;
  status: ItemStatus;
  is_seckill: boolean;
  end_time: string | null;
  brand: string;
};

export type ItemSearchResult = {
  items: SearchItem[];
  categories: string[];
  brands: string[];
  total: number;
  page: number;
  size: number;
};

/** Detail responses use the camelCase fields from ItemDetailVO. */
export type ItemDetail = {
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
  seckillEnded: boolean;
};

export type ItemSearchParams = {
  name?: string;
  categories?: string[];
  brands?: string[];
  page?: number;
  size?: number;
};

export function parseImageUrls(imageUrls?: string | null): string[] {
  return imageUrls
    ? imageUrls
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : [];
}
