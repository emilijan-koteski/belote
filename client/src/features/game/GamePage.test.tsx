import "@/shared/i18n/i18n";

import { act, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { GameState } from "@/shared/types/gameTypes";

import { GamePage } from "./GamePage";

// Mock useWebSocket
vi.mock("@/shared/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    state: "connected" as const,
    sendMessage: vi.fn(),
  }),
}));

// Mock useWsDispatch
vi.mock("@/shared/hooks/useWsDispatch", () => ({
  useWsDispatch: () => vi.fn(),
}));

const mockGameState: GameState = {
  id: 1,
  roomId: 100,
  variant: "bitola",
  matchMode: "1001",
  phase: "playing",
  handNumber: 1,
  dealerSeat: 0,
  trumpSuit: "S",
  trumpCallerSeat: 0,
  trumpCandidate: null,
  biddingRound: 1,
  biddingPassCount: 0,
  activePlayerSeat: 0,
  trickNumber: 1,
  currentTrick: [],
  leadSuit: null,
  trickWinnerSeat: null,
  players: [
    { hand: [{ rank: "K", suit: "S" }], seat: 0, userId: 10, username: "Alice", team: "red", declarations: [], connected: true },
    { hand: [{ rank: "7", suit: "H" }], seat: 1, userId: 20, username: "Bob", team: "blue", declarations: [], connected: true },
    { hand: [{ rank: "A", suit: "D" }], seat: 2, userId: 30, username: "Carol", team: "red", declarations: [], connected: true },
    { hand: [{ rank: "9", suit: "C" }], seat: 3, userId: 40, username: "Dave", team: "blue", declarations: [], connected: true },
  ],
  teamScores: [0, 0],
  handPoints: [0, 0],
  declarationPoints: [0, 0],
  tricksWon: [0, 0],
  turnExpiresAt: null,
};

function renderGamePage() {
  return render(
    <BrowserRouter>
      <GamePage />
    </BrowserRouter>,
  );
}

describe("GamePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().reset();
    useAuthStore.setState({ token: "test-token", user: { id: 10, email: "a@b.com", username: "Alice", languagePreference: "en", createdAt: "" }, isLoading: false });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading state when gameState is null", () => {
    renderGamePage();

    expect(screen.getByText("Connecting to game...")).toBeInTheDocument();
  });

  it("renders 4 PlayerSeat components when gameState is set", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    expect(screen.getByTestId("player-seat-0")).toBeInTheDocument();
    expect(screen.getByTestId("player-seat-1")).toBeInTheDocument();
    expect(screen.getByTestId("player-seat-2")).toBeInTheDocument();
    expect(screen.getByTestId("player-seat-3")).toBeInTheDocument();
  });

  it("derives myPlayerSeat from gameState.players matching authStore.user.id", () => {
    useGameStore.getState().setGameState(mockGameState);

    renderGamePage();

    expect(useGameStore.getState().myPlayerSeat).toBe(0);
  });

  it("renders trick area when gameState is set", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    expect(screen.getByTestId("trick-area")).toBeInTheDocument();
  });

  it("renders hand cards when gameState is set", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    expect(screen.getByTestId("hand-cards")).toBeInTheDocument();
  });

  it("navigates to lobby on match_end phase after 2s delay", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    // Transition to match_end
    act(() => {
      useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
    });

    // Before timeout: still on game page
    expect(screen.getByTestId("game-page")).toBeInTheDocument();

    // After 2s: clearGame should have been called
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(useGameStore.getState().gameState).toBeNull();
  });

  it("shows confirm dialog on browser back button and stays if declined", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    // Mock window.confirm to decline leaving
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    // Simulate popstate event (browser back button)
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(confirmSpy).toHaveBeenCalledWith("Leave the game? You may lose your progress.");
    // Game state should not be cleared
    expect(useGameStore.getState().gameState).not.toBeNull();

    confirmSpy.mockRestore();
  });
});
