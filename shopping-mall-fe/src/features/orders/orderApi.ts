import { apiClient } from "../../api/client";
import { unwrapData, type ApiResult } from "../../api/types";
import type {
  CancelOrderResult,
  CheckoutPriceRequest,
  CheckoutPriceResult,
  NormalOrderCreated,
  NormalOrderRequest,
  OrderLine,
  OrderRecord,
  SeckillOrderCreated,
} from "./orderTypes";

export async function getOrders(signal?: AbortSignal): Promise<OrderRecord[]> {
  const response = await apiClient.get<ApiResult<OrderRecord[]>>("/order/list", { signal });
  return unwrapData(response.data);
}

export async function getOrderItems(orderId: number, signal?: AbortSignal): Promise<OrderLine[]> {
  const response = await apiClient.get<ApiResult<OrderLine[]>>(`/order/${orderId}/items`, {
    signal,
  });
  return unwrapData(response.data);
}

export async function checkOrderPrices(
  items: CheckoutPriceRequest[],
  signal?: AbortSignal,
): Promise<CheckoutPriceResult> {
  const response = await apiClient.post<ApiResult<CheckoutPriceResult>>("/cart/checkout", items, {
    signal,
  });
  return unwrapData(response.data);
}

export async function createNormalOrder(
  items: NormalOrderRequest[],
  idempotencyKey: string,
): Promise<NormalOrderCreated> {
  const response = await apiClient.post<ApiResult<NormalOrderCreated>>("/order/create", items, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return unwrapData(response.data);
}

export async function createSeckillOrder(
  itemId: number,
  idempotencyKey: string,
): Promise<SeckillOrderCreated> {
  const response = await apiClient.post<ApiResult<SeckillOrderCreated>>(
    "/order/create/seckill",
    { itemId, quantity: 1 },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return unwrapData(response.data);
}

export async function payOrder(orderId: number): Promise<string> {
  const response = await apiClient.post<ApiResult<string>>("/pay", null, { params: { orderId } });
  return unwrapData(response.data);
}

export async function cancelOrder(
  orderId: number,
  idempotencyKey: string,
): Promise<CancelOrderResult> {
  const response = await apiClient.post<ApiResult<CancelOrderResult>>("/order/cancel", null, {
    params: { orderId },
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return unwrapData(response.data);
}

export function createIdempotencyKey(scope: "order" | "cancel" | "seckill") {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `${scope}-${randomId}`
    : `${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
