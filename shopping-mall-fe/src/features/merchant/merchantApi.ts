import { apiClient } from "../../api/client";
import { unwrapData, type ApiResult } from "../../api/types";
import type {
  AdjustMerchantStockRequest,
  CreateMerchantItemRequest,
  MerchantItem,
  UpdateMerchantItemRequest,
} from "./merchantTypes";

function ensureMutationSuccess(result: ApiResult<null>) {
  if (result.code !== 200) {
    throw new Error(result.message || "The request could not be completed.");
  }
}

export async function getMerchantItems(signal?: AbortSignal): Promise<MerchantItem[]> {
  const response = await apiClient.get<ApiResult<MerchantItem[]>>("/item/merchant/list", {
    signal,
  });
  return unwrapData(response.data);
}

export async function uploadMerchantItemImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<ApiResult<string>>("/item/upload/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrapData(response.data);
}

export async function createMerchantItem(request: CreateMerchantItemRequest): Promise<void> {
  const response = await apiClient.post<ApiResult<null>>("/item/add", request);
  ensureMutationSuccess(response.data);
}

export async function updateMerchantItem(request: UpdateMerchantItemRequest): Promise<void> {
  const response = await apiClient.put<ApiResult<null>>("/item/update", request);
  ensureMutationSuccess(response.data);
}

export async function adjustMerchantStock(request: AdjustMerchantStockRequest): Promise<void> {
  const response = await apiClient.patch<ApiResult<null>>("/item/stock", request);
  ensureMutationSuccess(response.data);
}

export async function takeMerchantItemOffline(itemId: number): Promise<void> {
  const response = await apiClient.delete<ApiResult<null>>("/item/offline", {
    params: { itemId },
  });
  ensureMutationSuccess(response.data);
}

export function getMerchantItemImages(item: Pick<MerchantItem, "imageUrls">) {
  return item.imageUrls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}
