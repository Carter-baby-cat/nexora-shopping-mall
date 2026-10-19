export type ApiResult<T> = {
  code: number;
  message: string;
  data: T | null;
};

export type ApiError = {
  message: string;
  status?: number;
};

export type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };

export function unwrapData<T>(result: ApiResult<T>): T {
  if (result.code !== 200 || result.data === null) {
    throw new Error(result.message || "The request could not be completed.");
  }
  return result.data;
}

export function normalizeApiError(error: unknown): ApiError {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: number; data?: { message?: string } } })
      .response;
    return {
      message: response?.data?.message || "The request could not be completed.",
      status: response?.status,
    };
  }
  return {
    message: error instanceof Error ? error.message : "The request could not be completed.",
  };
}
