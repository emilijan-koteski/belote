import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { GamePage } from "@/features/game/GamePage";
import { LeaderboardPage } from "@/features/leaderboard/LeaderboardPage";
import { LobbyPage } from "@/features/lobby/LobbyPage";
import { RoomLobby } from "@/features/lobby/RoomLobby";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { RulesPage } from "@/features/rules/RulesPage";
import { AppLayout } from "@/shared/components/AppLayout";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { useAuthInit } from "@/shared/hooks/useAuth";
import { QueryProvider } from "@/shared/providers/QueryProvider";
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
        <Route element={<AppLayout />}>
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/rooms/:id" element={<RoomLobby />} />
        </Route>
        <Route path="/game/:roomId" element={<GamePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryProvider>
  );
}
