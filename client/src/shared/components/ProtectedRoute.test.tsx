import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";

import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("@/shared/api/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("@/shared/providers/WebSocketProvider", () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing-page">Landing Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<div data-testid="lobby-page">Lobby Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isLoading: false });
  });

  it("redirects to the landing (/) when no token", () => {
    renderWithRouter("/lobby");

    expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    expect(screen.queryByTestId("lobby-page")).not.toBeInTheDocument();
  });

  it("renders children when token present", () => {
    useAuthStore.setState({ token: "test-token", isLoading: false });
    renderWithRouter("/lobby");

    expect(screen.getByTestId("lobby-page")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("renders nothing during auth initialization", () => {
    useAuthStore.setState({ token: null, isLoading: true });
    renderWithRouter("/lobby");

    expect(screen.queryByTestId("lobby-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });
});
