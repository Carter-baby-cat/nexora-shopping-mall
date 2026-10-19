import { apiClient } from "../../api/client";
import { unwrapData, type ApiResult } from "../../api/types";
import type { CartEntry, CartUpdateRequest } from "./cartTypes";

function ensureMutationSuccess(result: ApiResult<null>) {
  if (result.code !== 200) {
    throw new Error(result.message || "The request could not be completed.");
  }
}

export async function getCart(signal?: AbortSignal): Promise<CartEntry[]> {
  const response = await apiClient.get<ApiResult<CartEntry[]>>("/cart/list", { signal });
  return unwrapData(response.data);
}

export async function addCartItem(request: CartUpdateRequest): Promise<void> {
  const response = await apiClient.post<ApiResult<null>>("/cart/add", request);
  ensureMutationSuccess(response.data);
}

export async function updateCartItem(request: CartUpdateRequest): Promise<void> {
  const response = await apiClient.put<ApiResult<null>>("/cart/update", request);
  ensureMutationSuccess(response.data);
}

export async function deleteCartItem(itemId: number): Promise<void> {
  const response = await apiClient.delete<ApiResult<null>>("/cart/delete", {
    params: { itemId },
  });
  ensureMutationSuccess(response.data);
}
