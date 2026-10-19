import { apiClient } from "../../api/client";
import { unwrapData, type ApiResult } from "../../api/types";
import type { AccountBalance, RechargeRequest } from "./accountTypes";

export async function getAccountBalance(signal?: AbortSignal): Promise<AccountBalance> {
  const response = await apiClient.get<ApiResult<AccountBalance>>("/user/balance", { signal });
  return unwrapData(response.data);
}

export async function rechargeAccount(request: RechargeRequest): Promise<void> {
  const response = await apiClient.post<ApiResult<null>>("/user/recharge", request);
  if (response.data.code !== 200) {
    throw new Error(response.data.message || "The recharge could not be completed.");
  }
}

export function createRechargeUuid() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
