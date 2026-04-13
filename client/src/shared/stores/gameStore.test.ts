import { beforeEach, describe, expect, it } from "vitest";

import type { GameState } from "@/shared/types/gameTypes";

import { useGameStore } from "./gameStore";

const mockGameState: GameState = {
  id: 1,
  roomId: 100,
  variant: "bitola",
  matchMode: "1001",
  phase: "bidding",
  handNumber: 1,
  dealerSeat: 0,
  trumpSuit: null,
  trumpCallerSeat: null,
  trumpCandidate: { rank: "K", suit: "S" },
  biddingRound: 1,
  biddingPassCount: 0,
  activePlayerSeat: 1,
  trickNumber: 0,
  currentTrick: [],
  leadSuit: null,
  trickWinnerSeat: null,
  awaitingDeclaration: false,
  declarationsResolved: false,
  players: [
    { hand: [], seat: 0, userId: 10, username: "Alice", team: "red", declarations: [], connected: true },
    { hand: [], seat: 1, userId: 20, username: "Bob", team: "blue", declarations: [], connected: true },
    { hand: [], seat: 2, userId: 30, username: "Carol", team: "red", declarations: [], connected: true },
    { hand: [], seat: 3, userId: 40, username: "Dave", team: "blue", declarations: [], connected: true },
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
  turnTimeRemaining: 0,
};

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it("initializes with null gameState", () => {
    const state = useGameStore.getState();
    expect(state.gameState).toBeNull();
    expect(state.myPlayerSeat).toBeNull();
    expect(state.roomId).toBeNull();
  });

  it("sets full game state via setGameState", () => {
    useGameStore.getState().setGameState(mockGameState);

    const state = useGameStore.getState();
    expect(state.gameState).toEqual(mockGameState);
    expect(state.roomId).toBe(100);
  });

  it("sets myPlayerSeat", () => {
    useGameStore.getState().setMyPlayerSeat(2);
    expect(useGameStore.getState().myPlayerSeat).toBe(2);
  });

  it("clears all game data via clearGame including scoreRevealData and matchEndData", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setMyPlayerSeat(1);
    useGameStore.getState().setScoreRevealData({
      redCardPoints: 70, blueCardPoints: 82, redDeclPoints: 0, blueDeclPoints: 0,
      lastTrickTeam: 1, lastTrickBonus: 10, capot: false, capotTeam: null, capotBonus: 0,
      failedContract: false, contractingTeam: 1, redHandTotal: 70, blueHandTotal: 92,
      redMatchScore: 70, blueMatchScore: 92,
    });
    useGameStore.getState().setMatchEndData({
      winnerTeam: 0, redFinalScore: 1020, blueFinalScore: 850, matchDurationSec: 300,
    });

    useGameStore.getState().clearGame();

    const state = useGameStore.getState();
    expect(state.gameState).toBeNull();
    expect(state.myPlayerSeat).toBeNull();
    expect(state.roomId).toBeNull();
    expect(state.scoreRevealData).toBeNull();
    expect(state.matchEndData).toBeNull();
  });

  it("resets to initial state via reset", () => {
    useGameStore.getState().setGameState(mockGameState);
    useGameStore.getState().setLoading(true);

    useGameStore.getState().reset();

    const state = useGameStore.getState();
    expect(state.gameState).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("replaces gameState on subsequent setGameState calls", () => {
    useGameStore.getState().setGameState(mockGameState);

    const updatedState: GameState = {
      ...mockGameState,
      phase: "playing",
      trumpSuit: "H",
      activePlayerSeat: 2,
    };
    useGameStore.getState().setGameState(updatedState);

    const state = useGameStore.getState();
    expect(state.gameState?.phase).toBe("playing");
    expect(state.gameState?.trumpSuit).toBe("H");
    expect(state.gameState?.activePlayerSeat).toBe(2);
  });
});
