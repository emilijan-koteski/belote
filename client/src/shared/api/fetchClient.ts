import { refresh } from "@/shared/api/auth";
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

let authRedirect: (() => void) | null = null;

export function setAuthRedirect(fn: () => void): void {
  authRedirect = fn;
}

function redirectToLogin(): void {
  if (authRedirect) {
    authRedirect();
  } else {
    window.location.href = "/login";
  }
}

let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refresh()
    .then((res) => {
      useAuthStore.getState().setToken(res.token);
      useAuthStore.getState().setUser({
        id: res.id,
        username: res.username,
        email: res.email,
        languagePreference: res.languagePreference,
        createdAt: res.createdAt,
      });
      return res.token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function fetchClient<T>(
  path: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
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
    if (_isRetry) {
      useAuthStore.getState().logout();
      redirectToLogin();
      throw new FetchError(401, "UNAUTHORIZED", "Session expired");
    }

    try {
      const newToken = await doRefresh();
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };
      return fetchClient<T>(path, { ...options, headers: retryHeaders }, true);
    } catch {
      useAuthStore.getState().logout();
      redirectToLogin();
      throw new FetchError(401, "UNAUTHORIZED", "Session expired");
    }
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
