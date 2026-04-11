import { fetchClient, FetchError } from "@/shared/api/fetchClient";

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface RegisterResponse {
  token: string;
  id: number;
  username: string;
  email: string;
  languagePreference: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginResponse = RegisterResponse;

export interface RefreshResponse {
  token: string;
  id: number;
  username: string;
  email: string;
  languagePreference: string;
  createdAt: string;
}

export function register(data: RegisterRequest): Promise<RegisterResponse> {
  return fetchClient<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    try {
      const body = (await response.json()) as { error: { code: string; message: string } };
      throw new FetchError(response.status, body.error.code, body.error.message);
    } catch (e) {
      if (e instanceof FetchError) throw e;
      throw new FetchError(response.status, "UNKNOWN_ERROR", response.statusText || "Login failed");
    }
  }

  const body = (await response.json()) as { data: LoginResponse };
  return body.data;
}

export async function refresh(): Promise<RefreshResponse> {
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Refresh failed: ${response.status}`);
  }

  const body = (await response.json()) as { data: RefreshResponse };
  return body.data;
}

export function logout(): void {
  fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
