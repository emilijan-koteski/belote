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
    return <Navigate to="/login" replace />;
  }

  return (
    <WebSocketProvider>
      <ProtectedContent />
    </WebSocketProvider>
  );
}
