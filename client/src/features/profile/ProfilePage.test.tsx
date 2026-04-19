import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileResponse } from "@/shared/api/profile";
import { useAuthStore } from "@/shared/stores/authStore";
import { QueryWrapper } from "@/test-utils";

import { ProfilePage } from "./ProfilePage";

vi.mock("@/shared/api/auth", () => ({
  logout: vi.fn(),
}));

const mockGetProfile = vi.fn();
vi.mock("@/shared/api/profile", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updatePreferences: vi.fn().mockResolvedValue({ languagePreference: "en" }),
}));

const mockGetUserMatches = vi.fn();
vi.mock("@/shared/api/matches", () => ({
  getUserMatches: (...args: unknown[]) => mockGetUserMatches(...args),
}));

function renderProfilePage() {
  return render(
    <QueryWrapper>
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    </QueryWrapper>,
  );
}

function profileFixture(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 1,
    username: "testuser",
    languagePreference: "en",
    createdAt: "2026-01-15T10:00:00Z",
    totalGamesPlayed: 0,
    wins: 0,
    losses: 0,
    abandoned: 0,
    ...overrides,
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockGetUserMatches.mockReset();
    // Default: MatchHistory renders the empty state so existing tests need no per-case setup.
    mockGetUserMatches.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        languagePreference: "en",
        createdAt: "2026-01-15T10:00:00Z",
      },
      isLoading: false,
    });
  });

  it("renders loading state initially", () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    renderProfilePage();

    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();
  });

  it("renders username after profile loads", async () => {
    mockGetProfile.mockResolvedValueOnce(profileFixture());

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-username")).toHaveTextContent("testuser");
    });
  });

  it("renders member since date", async () => {
    mockGetProfile.mockResolvedValueOnce(profileFixture());

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-member-since")).toBeInTheDocument();
    });

    const memberSinceText = screen.getByTestId("profile-member-since").textContent;
    expect(memberSinceText).toContain("2026");
  });

  it("renders match-history section + four stat tiles", async () => {
    mockGetProfile.mockResolvedValueOnce(profileFixture());

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-match-history")).toBeInTheDocument();
    });

    expect(screen.getByTestId("profile-stats")).toBeInTheDocument();
    // All four tiles exist with data-value="0" for a zero-games fixture.
    expect(screen.getByTestId("profile-stat-games-played")).toHaveAttribute("data-value", "0");
    expect(screen.getByTestId("profile-stat-wins")).toHaveAttribute("data-value", "0");
    expect(screen.getByTestId("profile-stat-losses")).toHaveAttribute("data-value", "0");
    // Win-rate for zero games is the em-dash, data-value is empty string.
    expect(screen.getByTestId("profile-stat-win-rate")).toHaveAttribute("data-value", "");
  });

  it("handles profile fetch error gracefully", async () => {
    mockGetProfile.mockRejectedValueOnce(new Error("Network error"));

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    });

    // Falls back to auth store data
    expect(screen.getByTestId("profile-username")).toHaveTextContent("testuser");
  });

  it("renders real stats when profile has played games", async () => {
    mockGetProfile.mockResolvedValueOnce(
      profileFixture({ totalGamesPlayed: 10, wins: 7, losses: 2, abandoned: 1 }),
    );

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-stat-games-played")).toHaveAttribute("data-value", "10");
    });

    expect(screen.getByTestId("profile-stat-wins")).toHaveAttribute("data-value", "7");
    expect(screen.getByTestId("profile-stat-losses")).toHaveAttribute("data-value", "2");
    // Denominator is totalGamesPlayed (abandoned included): 7 / 10 = 70%.
    expect(screen.getByTestId("profile-stat-win-rate")).toHaveAttribute("data-value", "70");
    expect(screen.getByTestId("profile-stat-win-rate").textContent).toContain("70%");
  });

  it("counts abandoned games in the win-rate denominator", async () => {
    mockGetProfile.mockResolvedValueOnce(
      profileFixture({ totalGamesPlayed: 10, wins: 4, losses: 3, abandoned: 3 }),
    );

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-stat-games-played")).toHaveAttribute("data-value", "10");
    });

    // 4 / 10 = 40% — NOT 4 / (4+3) = 57%.
    expect(screen.getByTestId("profile-stat-win-rate")).toHaveAttribute("data-value", "40");
    expect(screen.getByTestId("profile-stat-win-rate").textContent).toContain("40%");
  });

  it("renders stats error state when profile query fails", async () => {
    mockGetProfile.mockRejectedValueOnce(new Error("500 Internal Server Error"));

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-stats-error")).toBeInTheDocument();
    });

    // Error branch replaces the tile grid — numeric tiles must not render.
    expect(screen.queryByTestId("profile-stat-games-played")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile-stat-win-rate")).not.toBeInTheDocument();
  });

  it("renders em-dash for win-rate when zero games played", async () => {
    mockGetProfile.mockResolvedValueOnce(profileFixture());

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("profile-stat-win-rate")).toBeInTheDocument();
    });

    const winRate = screen.getByTestId("profile-stat-win-rate");
    expect(winRate).toHaveAttribute("data-value", "");
    // Em-dash character, never "NaN%" or "0%".
    expect(winRate.textContent).toContain("\u2014");
    expect(winRate.textContent).not.toContain("NaN");
    expect(winRate.textContent).not.toContain("0%");
  });

  it("renders stats tiles alongside match-history empty state when user has no games", async () => {
    mockGetProfile.mockResolvedValueOnce(profileFixture());
    // MatchHistory empty state comes from mockGetUserMatches default in beforeEach.

    renderProfilePage();

    await waitFor(() => {
      expect(screen.getByTestId("match-history-empty")).toBeInTheDocument();
    });

    // Both empty states coexist.
    expect(screen.getByTestId("profile-stat-games-played")).toHaveAttribute("data-value", "0");
    expect(screen.getByTestId("profile-stat-win-rate")).toHaveAttribute("data-value", "");
  });
});
