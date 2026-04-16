import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { refresh } from "@/shared/api/auth";
import { setAuthRedirect } from "@/shared/api/axiosClient";
import { useAuthStore } from "@/shared/stores/authStore";

export function useAuthInit(): void {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  useEffect(() => {
    setAuthRedirect(() => navigate("/login"));
  }, [navigate]);

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (token) {
      useAuthStore.getState().setLoading(false);
      return;
    }

    const abortController = new AbortController();

    refresh(abortController.signal)
      .then((res) => {
        if (abortController.signal.aborted) return;
        useAuthStore.getState().setToken(res.token);
        useAuthStore.getState().setUser({
          id: res.id,
          username: res.username,
          email: res.email,
          languagePreference: res.languagePreference,
          createdAt: res.createdAt,
        });
        i18n.changeLanguage(res.languagePreference);
      })
      .catch(() => {
        if (abortController.signal.aborted) return;
        // Clear local state only — don't call logout() which fires an API
        // request to /api/v1/auth/logout when no session exists yet.
        useAuthStore.getState().setToken(null);
      })
      .finally(() => {
        if (abortController.signal.aborted) return;
        useAuthStore.getState().setLoading(false);
      });

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
