import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { GamePage } from "@/features/game/GamePage";
import { LeaderboardPage } from "@/features/leaderboard/LeaderboardPage";
import { PrivacyPage } from "@/features/legal/PrivacyPage";
import { TermsPage } from "@/features/legal/TermsPage";
import { LobbyPage } from "@/features/lobby/LobbyPage";
import { RoomLobby } from "@/features/lobby/RoomLobby";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { RulesPage } from "@/features/rules/RulesPage";
import { AppLayout } from "@/shared/components/AppLayout";
import { GuestRoute } from "@/shared/components/GuestRoute";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { useAuthInit } from "@/shared/hooks/useAuth";
import { QueryProvider } from "@/shared/providers/QueryProvider";
import { useAuthStore } from "@/shared/stores/authStore";

function AuthAwareRedirect() {
  const token = useAuthStore((s) => s.token);
  return <Navigate to={token ? "/lobby" : "/login"} replace />;
}

function AppRoutes() {
  useAuthInit();

  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
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
      <Route path="*" element={<AuthAwareRedirect />} />
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
