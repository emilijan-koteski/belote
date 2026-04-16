import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";

import { GuestRoute } from "./GuestRoute";

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Route>
        <Route path="/lobby" element={<div data-testid="lobby-page">Lobby Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GuestRoute", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isLoading: false });
  });

  it("renders children when no token", () => {
    renderWithRouter("/login");

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("lobby-page")).not.toBeInTheDocument();
  });

  it("redirects to /lobby when token present", () => {
    useAuthStore.setState({ token: "test-token", isLoading: false });
    renderWithRouter("/login");

    expect(screen.getByTestId("lobby-page")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("renders nothing during auth initialization", () => {
    useAuthStore.setState({ token: null, isLoading: true });
    renderWithRouter("/login");

    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lobby-page")).not.toBeInTheDocument();
  });
});
