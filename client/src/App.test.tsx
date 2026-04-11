import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/auth/LoginPage";
import { LobbyPage } from "@/features/lobby/LobbyPage";
import { useAuthStore } from "@/shared/stores/authStore";

vi.mock("@/shared/api/auth", () => ({
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/shared/api/rooms", () => ({
  createRoom: vi.fn(),
}));

describe("App routing", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isLoading: false });
  });

  it("renders login page at /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("login-title")).toHaveTextContent("Log In");
  });

  it("renders lobby page at /lobby", () => {
    render(
      <MemoryRouter initialEntries={["/lobby"]}>
        <Routes>
          <Route path="/lobby" element={<LobbyPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("quick-play-card")).toBeInTheDocument();
    expect(screen.getByTestId("create-room-card")).toBeInTheDocument();
  });
});
