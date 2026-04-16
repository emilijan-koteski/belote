import { Navigate, Outlet } from "react-router";

import { useAuthStore } from "@/shared/stores/authStore";

export function GuestRoute() {
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  if (token) {
    return <Navigate to="/lobby" replace />;
  }

  return <Outlet />;
}
