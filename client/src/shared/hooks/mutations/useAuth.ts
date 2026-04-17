import { useMutation } from "@tanstack/react-query";

import type { LoginRequest, RegisterRequest } from "@/shared/api/auth";
import { login, register } from "@/shared/api/auth";
import { useAuthStore } from "@/shared/stores/authStore";

function setAuthState(res: {
  token: string;
  id: number;
  username: string;
  email: string;
  languagePreference: string;
  createdAt: string;
}) {
  useAuthStore.getState().setToken(res.token);
  useAuthStore.getState().setUser({
    id: res.id,
    username: res.username,
    email: res.email,
    languagePreference: res.languagePreference,
    createdAt: res.createdAt,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (data: LoginRequest) => login(data),
    onSuccess: setAuthState,
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => register(data),
    onSuccess: setAuthState,
  });
}
