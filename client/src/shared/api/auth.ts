import { fetchClient } from "@/shared/api/fetchClient";

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

export function register(data: RegisterRequest): Promise<RegisterResponse> {
  return fetchClient<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
