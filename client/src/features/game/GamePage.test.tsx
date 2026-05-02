import "@/shared/i18n/i18n";

import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { GameState } from "@/shared/types/gameTypes";

import { GamePage } from "./GamePage";

// Mock WebSocket context hooks. The send-message hook returns a stable spy so
// surrender flow tests can assert outgoing actions.
const mockSendMessage = vi.fn();
vi.mock("@/shared/providers/WebSocketContext", () => ({
  useWsSendMessage: () => mockSendMessage,
  useWsConnectionState: () => "connected" as const,
}));

vi.mock("@/shared/providers/WebSocketProvider", () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => children,
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
  deck: [],
  activePlayerSeat: 0,
  trickNumber: 1,
  currentTrick: [],
  leadSuit: null,
  trickWinnerSeat: null,
  awaitingDeclaration: false,
  declarationsResolved: false,
  players: [
    {
      hand: [{ rank: "K", suit: "S" }],
      seat: 0,
      userId: 10,
      username: "Alice",
      team: "teamA",
      declarations: [],
      connected: true,
    },
    {
      hand: [{ rank: "7", suit: "H" }],
      seat: 1,
      userId: 20,
      username: "Bob",
      team: "teamB",
      declarations: [],
      connected: true,
    },
    {
      hand: [{ rank: "A", suit: "D" }],
      seat: 2,
      userId: 30,
      username: "Carol",
      team: "teamA",
      declarations: [],
      connected: true,
    },
    {
      hand: [{ rank: "9", suit: "C" }],
      seat: 3,
      userId: 40,
      username: "Dave",
      team: "teamB",
      declarations: [],
      connected: true,
    },
  ],
  teamScores: [0, 0],
  handPoints: [0, 0],
  declarationPoints: [0, 0],
  tricksWon: [0, 0],
  pendingBelotSeat: null,
  belotAnnounced: false,
  winnerTeam: null,
  lastHandResult: null,
  turnExpiresAt: null,
  timerDurationSec: 0,
  previousPhase: "" as const,
  pausedPlayers: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  pauseUsed: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  surrenderProposerSeat: null,
  surrenderUsed: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  turnTimeRemaining: 0,
  ownerSeat: 0,
  disconnectedSeat: -1,
  reconnectExpiresAt: null,
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
    mockSendMessage.mockClear();
    useGameStore.getState().reset();
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 10,
        email: "a@b.com",
        username: "Alice",
        languagePreference: "en",
        createdAt: "",
      },
      isLoading: false,
    });

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

  it("shows match result overlay on match_end phase with matchEndData", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    // Set match end data and transition to match_end phase
    act(() => {
      useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
      useGameStore.getState().setMatchEndData({
        winnerTeam: 0,
        teamAFinalScore: 1020,
        teamBFinalScore: 850,
        matchDurationSec: 300,
      });
    });

    // Match result overlay should appear
    expect(screen.getByTestId("match-result")).toBeInTheDocument();
    expect(screen.getByTestId("match-result-team-a-score")).toHaveTextContent("1020");
  });

  it("shows error toast when lastError is set and dismisses it on close button click", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    act(() => {
      useGameStore.getState().setLastError("error:illegal_play");
    });

    const toast = screen.getByTestId("error-toast");
    expect(toast).toHaveTextContent("That card cannot be played");

    fireEvent.click(screen.getByTestId("error-toast-close"));

    expect(screen.queryByTestId("error-toast")).not.toBeInTheDocument();
  });

  it("auto-dismisses the error toast after 3 seconds", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    act(() => {
      useGameStore.getState().setLastError("error:illegal_play");
    });

    expect(screen.getByTestId("error-toast")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByTestId("error-toast")).not.toBeInTheDocument();
  });

  it("re-shows the error toast on a new error after manual dismiss", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    act(() => {
      useGameStore.getState().setLastError("error:illegal_play");
    });
    fireEvent.click(screen.getByTestId("error-toast-close"));
    expect(screen.queryByTestId("error-toast")).not.toBeInTheDocument();

    act(() => {
      useGameStore.getState().setLastError("error:not_your_turn");
    });

    expect(screen.getByTestId("error-toast")).toHaveTextContent("It's not your turn");
  });

  // --- Surrender integration tests (Task 9.6) ---

  it("shows SurrenderButton in playing phase, hides in match_end", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    const { rerender } = renderGamePage();
    expect(screen.getByTestId("surrender-button")).toBeInTheDocument();

    act(() => {
      useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
      useGameStore.getState().setMatchEndData({
        winnerTeam: 0,
        teamAFinalScore: 1020,
        teamBFinalScore: 850,
        matchDurationSec: 300,
      });
    });
    rerender(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId("surrender-button")).not.toBeInTheDocument();
  });

  it("shows SurrenderPrompt for the partner when surrenderProposerSeat is set", () => {
    // Local player is seat 2 (Carol); proposer is seat 0 (Alice). Partner of
    // proposer is (0 + 2) % 4 == 2, i.e. the local player.
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 30,
        email: "c@b.com",
        username: "Carol",
        languagePreference: "en",
        createdAt: "",
      },
      isLoading: false,
    });
    useGameStore.getState().setGameState({ ...mockGameState, surrenderProposerSeat: 0 });
    useGameStore.getState().setMyPlayerSeat(2);

    renderGamePage();

    expect(screen.getByTestId("surrender-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("surrender-opponent-banner")).not.toBeInTheDocument();
  });

  it("shows SurrenderOpponentBanner for opponents when surrenderProposerSeat is set", () => {
    // Local player is seat 1 (Bob, team B); proposer is seat 0 (Alice, team A).
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 20,
        email: "b@b.com",
        username: "Bob",
        languagePreference: "en",
        createdAt: "",
      },
      isLoading: false,
    });
    useGameStore.getState().setGameState({ ...mockGameState, surrenderProposerSeat: 0 });
    useGameStore.getState().setMyPlayerSeat(1);

    renderGamePage();

    expect(screen.getByTestId("surrender-opponent-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("surrender-prompt")).not.toBeInTheDocument();
  });

  it("hides SurrenderPrompt when surrenderProposerSeat clears", () => {
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 30,
        email: "c@b.com",
        username: "Carol",
        languagePreference: "en",
        createdAt: "",
      },
      isLoading: false,
    });
    useGameStore.getState().setGameState({ ...mockGameState, surrenderProposerSeat: 0 });
    useGameStore.getState().setMyPlayerSeat(2);

    renderGamePage();
    expect(screen.getByTestId("surrender-prompt")).toBeInTheDocument();

    act(() => {
      useGameStore.getState().setGameState({ ...mockGameState, surrenderProposerSeat: null });
    });

    expect(screen.queryByTestId("surrender-prompt")).not.toBeInTheDocument();
  });

  it("sends action:surrender_request after confirm dialog", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    fireEvent.click(screen.getByTestId("surrender-button"));
    fireEvent.click(screen.getByTestId("surrender-confirm"));

    expect(mockSendMessage).toHaveBeenCalledWith("action:surrender_request", {});
  });

  // --- Emote integration tests (Story 8.3) ---

  it("shows the emote toggle during the playing phase", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    expect(screen.getByTestId("emote-toggle")).toBeInTheDocument();
  });

  it("hides the emote toggle when match has ended", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    const { rerender } = renderGamePage();

    act(() => {
      useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
      useGameStore.getState().setMatchEndData({
        winnerTeam: 0,
        teamAFinalScore: 1020,
        teamBFinalScore: 850,
        matchDurationSec: 300,
      });
    });
    rerender(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId("emote-toggle")).not.toBeInTheDocument();
  });

  it("sends action:emote when a tile is clicked", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    fireEvent.click(screen.getByTestId("emote-toggle"));
    fireEvent.click(screen.getByTestId("emote-tile-thumbs_up"));

    expect(mockSendMessage).toHaveBeenCalledWith("action:emote", { emote: "thumbs_up" });
  });

  it("renders an emote bubble at the correct compass position for an opponent", () => {
    // Local player at seat 0 (South). Opponent at seat 2 emotes — bubble
    // should appear at compass 2 (North) from the receiver's perspective.
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    renderGamePage();

    act(() => {
      useGameStore.getState().setActiveEmote(2, "clap");
    });

    expect(screen.getByTestId("emote-bubble-2")).toBeInTheDocument();
  });

  it("renders the sender's own bubble at South (compass 0)", () => {
    // Local player is seat 1 (Bob). Their own emote should anchor to South
    // (compass 0) regardless of the absolute seat index.
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 20,
        email: "b@b.com",
        username: "Bob",
        languagePreference: "en",
        createdAt: "",
      },
      isLoading: false,
    });
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(1);

    renderGamePage();

    act(() => {
      useGameStore.getState().setActiveEmote(1, "heart");
    });

    expect(screen.getByTestId("emote-bubble-0")).toBeInTheDocument();
  });

  it("suppresses emote bubbles while the match-end overlay is up", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);

    const { rerender } = renderGamePage();

    act(() => {
      useGameStore.getState().setActiveEmote(2, "laugh");
      useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
      useGameStore.getState().setMatchEndData({
        winnerTeam: 0,
        teamAFinalScore: 1020,
        teamBFinalScore: 850,
        matchDurationSec: 300,
      });
    });
    rerender(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId("emote-bubble-2")).not.toBeInTheDocument();
  });

  it("hides declarationReveal while the table is paused (AC3)", () => {
    useGameStore.getState().setGameState({ ...mockGameState, phase: "paused" });
    useGameStore.getState().setMyPlayerSeat(0);
    useGameStore.getState().setDeclarationReveal({
      winnerTeam: 0,
      declarations: [
        {
          playerSeat: 0,
          type: "sequence",
          cards: ["9S", "TS", "JS", "QS"],
          value: 50,
        },
      ],
    });

    renderGamePage();

    expect(screen.queryByTestId("declaration-reveal")).not.toBeInTheDocument();
  });

  it("hides dealer indicator when an overlay is up (AC6)", () => {
    useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
    useGameStore.getState().setMyPlayerSeat(0);
    useGameStore.getState().setMatchEndData({
      winnerTeam: 0,
      teamAFinalScore: 1020,
      teamBFinalScore: 850,
      matchDurationSec: 300,
    });

    renderGamePage();

    expect(screen.queryByTestId("dealer-indicator")).not.toBeInTheDocument();
  });

  it("hides belotReveal while a match-end overlay is up (AC3)", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(0);
    useGameStore.getState().setBelotReveal({
      playerSeat: 0,
      team: 0,
      cardId: "QS",
    });

    const { rerender } = renderGamePage();

    act(() => {
      useGameStore.getState().setGameState({ ...mockGameState, phase: "match_end" });
      useGameStore.getState().setMatchEndData({
        winnerTeam: 0,
        teamAFinalScore: 1020,
        teamBFinalScore: 850,
        matchDurationSec: 300,
      });
    });
    rerender(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId("belot-reveal")).not.toBeInTheDocument();
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
