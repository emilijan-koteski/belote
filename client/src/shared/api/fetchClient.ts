import { useAuthStore } from "@/shared/stores/authStore";

const BASE_URL = "/api/v1";

interface ApiError {
  code: string;
  message: string;
}

interface ApiErrorResponse {
  error: ApiError;
}

export class FetchError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.code = code;
  }
}

export async function fetchClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    // TODO: implement refresh token cycle
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new FetchError(401, "UNAUTHORIZED", "Session expired");
  }

  if (!response.ok) {
    try {
      const body = (await response.json()) as ApiErrorResponse;
      throw new FetchError(response.status, body.error.code, body.error.message);
    } catch (e) {
      if (e instanceof FetchError) throw e;
      throw new FetchError(response.status, "UNKNOWN_ERROR", response.statusText || "Request failed");
    }
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const body = (await response.json()) as { data: T };
  return body.data;
}
