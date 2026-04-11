import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { refresh } from "@/shared/api/auth";
import { setAuthRedirect } from "@/shared/api/fetchClient";
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

    refresh()
      .then((res) => {
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
        useAuthStore.getState().logout();
      })
      .finally(() => {
        useAuthStore.getState().setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
