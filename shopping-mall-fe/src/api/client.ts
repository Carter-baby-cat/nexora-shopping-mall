import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../features/auth/authStore";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _authRetry?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const config = error.config;
    const status = error.response?.status;
    const endpoint = config?.url || "";
    const authRequest = endpoint.startsWith("/user/login") || endpoint.startsWith("/user/register");

    if (status !== 401 || !config || authRequest || config._authRetry) throw error;

    const authorization = error.response?.headers?.authorization as string | undefined;
    const refreshedToken = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!refreshedToken) {
      useAuthStore.getState().clearSession();
      window.dispatchEvent(new CustomEvent("nexora:auth-expired"));
      throw error;
    }

    config._authRetry = true;
    useAuthStore.getState().updateAccessToken(refreshedToken);
    config.headers.set("Authorization", `Bearer ${refreshedToken}`);
    return apiClient.request(config);
  },
);
