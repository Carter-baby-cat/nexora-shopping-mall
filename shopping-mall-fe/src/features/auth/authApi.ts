import { apiClient } from "../../api/client";
import type { ApiResult } from "../../api/types";

export type AuthRequest = {
  username: string;
  password: string;
  authority: "ROLE_USER" | "ROLE_MERCHANT";
};

export async function login(request: AuthRequest): Promise<string> {
  const response = await apiClient.post<ApiResult<{ accessToken: string }>>("/user/login", request);
  if (response.data.code !== 200 || !response.data.data?.accessToken) {
    throw new Error(response.data.message || "Unable to sign in.");
  }
  return response.data.data.accessToken;
}

export async function register(request: AuthRequest): Promise<void> {
  const response = await apiClient.post<ApiResult<null>>("/user/register", request);
  if (response.data.code !== 200)
    throw new Error(response.data.message || "Unable to create account.");
}

export async function logout(): Promise<void> {
  await apiClient.post<ApiResult<null>>("/user/logout");
}
