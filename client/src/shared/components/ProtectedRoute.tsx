import { Navigate, Outlet } from "react-router";

import { useReconnectionRedirect } from "@/shared/hooks/useReconnectionRedirect";
import { WebSocketProvider } from "@/shared/providers/WebSocketProvider";
import { useAuthStore } from "@/shared/stores/authStore";

function ProtectedContent() {
  useReconnectionRedirect();
  return <Outlet />;
}

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  if (!token) {
    // Unauthenticated → the public landing ("/"), the logged-out home (it has
    // its own "Log in" CTA). Keeping this aligned with the logout navigation
    // and the axios 401 redirect means a deliberate logout always lands on the
    // landing, never racing to /login as the protected tree unmounts.
    return <Navigate to="/" replace />;
  }

  return (
    <WebSocketProvider>
      <ProtectedContent />
    </WebSocketProvider>
  );
}
