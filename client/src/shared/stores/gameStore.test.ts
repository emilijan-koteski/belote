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
  deck: [],
  activePlayerSeat: 1,
  trickNumber: 0,
  currentTrick: [],
  leadSuit: null,
  trickWinnerSeat: null,
  awaitingDeclaration: false,
  declarationsResolved: false,
  players: [
    {
      hand: [],
      seat: 0,
      userId: 10,
      username: "Alice",
      team: "teamA",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 1,
      userId: 20,
      username: "Bob",
      team: "teamB",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 2,
      userId: 30,
      username: "Carol",
      team: "teamA",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
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
      teamACardPoints: 70,
      teamBCardPoints: 82,
      teamADeclPoints: 0,
      teamBDeclPoints: 0,
      lastTrickTeam: 1,
      lastTrickBonus: 10,
      capot: false,
      capotTeam: null,
      capotBonus: 0,
      failedContract: false,
      contractingTeam: 1,
      teamAHandTotal: 70,
      teamBHandTotal: 92,
      teamAMatchScore: 70,
      teamBMatchScore: 92,
    });
    useGameStore.getState().setMatchEndData({
      winnerTeam: 0,
      teamAFinalScore: 1020,
      teamBFinalScore: 850,
      matchDurationSec: 300,
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

  it("initializes activeEmotes with all four slots null", () => {
    const state = useGameStore.getState();
    expect(state.activeEmotes).toEqual({ 0: null, 1: null, 2: null, 3: null });
  });

  it("setActiveEmote writes a per-seat slot with a receivedAt stamp", () => {
    useGameStore.getState().setActiveEmote(2, "thumbs_up");

    const slot = useGameStore.getState().activeEmotes[2];
    expect(slot).not.toBeNull();
    expect(slot?.emote).toBe("thumbs_up");
    expect(typeof slot?.receivedAt).toBe("number");
    // Other seats untouched
    expect(useGameStore.getState().activeEmotes[0]).toBeNull();
    expect(useGameStore.getState().activeEmotes[1]).toBeNull();
    expect(useGameStore.getState().activeEmotes[3]).toBeNull();
  });

  it("setActiveEmote replaces an existing slot without leaking the previous value", () => {
    useGameStore.getState().setActiveEmote(1, "clap");
    const first = useGameStore.getState().activeEmotes[1];

    useGameStore.getState().setActiveEmote(1, "laugh");
    const second = useGameStore.getState().activeEmotes[1];

    expect(second?.emote).toBe("laugh");
    // The slot must be a fresh object — mutating the previous one would
    // break React's reference-equality re-render guard.
    expect(second).not.toBe(first);
  });

  it("setActiveEmote(seat, null) clears the slot", () => {
    useGameStore.getState().setActiveEmote(0, "heart");
    expect(useGameStore.getState().activeEmotes[0]).not.toBeNull();

    useGameStore.getState().setActiveEmote(0, null);
    expect(useGameStore.getState().activeEmotes[0]).toBeNull();
  });

  it("clearGame zeroes all four emote slots", () => {
    useGameStore.getState().setActiveEmote(0, "thumbs_up");
    useGameStore.getState().setActiveEmote(1, "clap");
    useGameStore.getState().setActiveEmote(2, "laugh");
    useGameStore.getState().setActiveEmote(3, "heart");

    useGameStore.getState().clearGame();

    expect(useGameStore.getState().activeEmotes).toEqual({
      0: null,
      1: null,
      2: null,
      3: null,
    });
  });

  it("initializes lastEmoteSentAt to 0", () => {
    expect(useGameStore.getState().lastEmoteSentAt).toBe(0);
  });

  it("setLastEmoteSentAt updates the value", () => {
    useGameStore.getState().setLastEmoteSentAt(12345.6);
    expect(useGameStore.getState().lastEmoteSentAt).toBe(12345.6);
  });

  it("clearGame resets lastEmoteSentAt to 0 (AC8)", () => {
    useGameStore.getState().setLastEmoteSentAt(12345.6);
    useGameStore.getState().clearGame();
    expect(useGameStore.getState().lastEmoteSentAt).toBe(0);
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
