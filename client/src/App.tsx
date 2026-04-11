import { BrowserRouter, Navigate,Route, Routes } from "react-router";

import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { GamePage } from "@/features/game/GamePage";
import { LobbyPage } from "@/features/lobby/LobbyPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { useAuthInit } from "@/shared/hooks/useAuth";
import { useAuthStore } from "@/shared/stores/authStore";

function AppRoutes() {
  useAuthInit();

  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/game" element={<GamePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
