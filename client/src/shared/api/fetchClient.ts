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
    const body = (await response.json()) as ApiErrorResponse;
    throw new FetchError(response.status, body.error.code, body.error.message);
  }

  const body = (await response.json()) as { data: T };
  return body.data;
}
