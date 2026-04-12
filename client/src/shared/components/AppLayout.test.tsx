import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";

import { AppLayout } from "./AppLayout";

vi.mock("@/shared/api/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("@/shared/api/profile", () => ({
  updatePreferences: vi.fn().mockResolvedValue({ languagePreference: "en" }),
}));

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/lobby" element={<div data-testid="lobby-content">Lobby</div>} />
          <Route path="/profile" element={<div data-testid="profile-content">Profile</div>} />
          <Route
            path="/leaderboard"
            element={<div data-testid="leaderboard-content">Leaderboard</div>}
          />
          <Route path="/rules" element={<div data-testid="rules-content">Rules</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        languagePreference: "en",
        createdAt: "2026-01-01T00:00:00Z",
      },
      isLoading: false,
    });
  });

  it("renders nav bar with all tabs", () => {
    renderWithRouter("/lobby");

    expect(screen.getByTestId("app-nav")).toBeInTheDocument();
    expect(screen.getByTestId("app-name")).toHaveTextContent("Belote");
    expect(screen.getByTestId("nav-play")).toHaveTextContent("Play");
    expect(screen.getByTestId("nav-leaderboard")).toHaveTextContent("Leaderboard");
    expect(screen.getByTestId("nav-profile")).toHaveTextContent("Profile");
    expect(screen.getByTestId("nav-rules")).toHaveTextContent("Rules");
  });

  it("highlights active tab for /lobby", () => {
    renderWithRouter("/lobby");

    const playTab = screen.getByTestId("nav-play");
    expect(playTab.className).toContain("border-accent");
  });

  it("highlights active tab for /profile", () => {
    renderWithRouter("/profile");

    const profileTab = screen.getByTestId("nav-profile");
    expect(profileTab.className).toContain("border-accent");
  });

  it("renders outlet content", () => {
    renderWithRouter("/lobby");

    expect(screen.getByTestId("lobby-content")).toBeInTheDocument();
  });

  it("renders language selector", () => {
    renderWithRouter("/lobby");

    expect(screen.getByTestId("language-selector")).toBeInTheDocument();
  });

  it("displays current user's username and avatar", () => {
    renderWithRouter("/lobby");

    const userButton = screen.getByTestId("nav-user");
    expect(userButton).toBeInTheDocument();
    expect(userButton).toHaveTextContent("T");
    expect(userButton).toHaveTextContent("testuser");
  });

  it("navigates to /profile when clicking the user avatar", async () => {
    renderWithRouter("/lobby");

    await userEvent.click(screen.getByTestId("nav-user"));

    expect(screen.getByTestId("profile-content")).toBeInTheDocument();
  });

  it("does not display user widget when no user is logged in", () => {
    useAuthStore.setState({ user: null, token: null });
    renderWithRouter("/lobby");

    expect(screen.queryByTestId("nav-user")).not.toBeInTheDocument();
  });
});
