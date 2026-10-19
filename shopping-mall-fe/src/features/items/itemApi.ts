import { apiClient } from "../../api/client";
import { unwrapData, type ApiResult } from "../../api/types";
import type { ItemDetail, ItemSearchParams, ItemSearchResult } from "./itemTypes";

export async function suggestItems(prefix: string, signal?: AbortSignal): Promise<string[]> {
  const response = await apiClient.get<ApiResult<string[]>>("/item/suggest", {
    params: { prefix },
    signal,
  });
  return unwrapData(response.data);
}

export async function searchItems(
  search: ItemSearchParams,
  signal?: AbortSignal,
): Promise<ItemSearchResult> {
  const params = new URLSearchParams();
  if (search.name?.trim()) params.set("name", search.name.trim());
  search.categories?.forEach((category) => params.append("categories", category));
  search.brands?.forEach((brand) => params.append("brands", brand));
  params.set("page", String(search.page ?? 1));
  params.set("size", String(search.size ?? 12));

  const response = await apiClient.get<ApiResult<ItemSearchResult>>(
    `/item/search/list?${params.toString()}`,
    { signal },
  );
  return unwrapData(response.data);
}

export async function getItemDetail(itemId: number, signal?: AbortSignal): Promise<ItemDetail> {
  const response = await apiClient.get<ApiResult<ItemDetail>>(`/item/${itemId}`, { signal });
  return unwrapData(response.data);
}
