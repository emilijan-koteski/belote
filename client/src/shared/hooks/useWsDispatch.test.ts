import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGameStore } from "@/shared/stores/gameStore";
import { useLobbyStore } from "@/shared/stores/lobbyStore";
import { useRoomLobbyStore } from "@/shared/stores/roomLobbyStore";
import type { GameState } from "@/shared/types/gameTypes";
import type { WsMessage } from "@/shared/types/wsEvents";

import { useWsDispatch } from "./useWsDispatch";

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
  activePlayerSeat: 1,
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
      team: "red",
      declarations: [],
      connected: true,
    },
    {
      hand: [{ rank: "7", suit: "H" }],
      seat: 1,
      userId: 20,
      username: "Bob",
      team: "blue",
      declarations: [],
      connected: true,
    },
    {
      hand: [{ rank: "A", suit: "D" }],
      seat: 2,
      userId: 30,
      username: "Carol",
      team: "red",
      declarations: [],
      connected: true,
    },
    {
      hand: [{ rank: "9", suit: "C" }],
      seat: 3,
      userId: 40,
      username: "Dave",
      team: "blue",
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
  turnTimeRemaining: 0,
  ownerSeat: 0,
  disconnectedSeat: -1,
  reconnectExpiresAt: null,
};

describe("useWsDispatch", () => {
  beforeEach(() => {
    useLobbyStore.setState({
      rooms: [],
      isLoading: false,
      searchQuery: "",
    });
    useGameStore.getState().reset();
    useRoomLobbyStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("routes system:room_created to lobbyStore.addRoom", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    const message: WsMessage = {
      type: "system:room_created",
      payload: {
        id: 1,
        name: "Test Room",
        code: "ABC123",
        ownerId: 42,
        variant: "bitola",
        matchMode: "1001",
        timerStyle: "relaxed",
        timerDurationSeconds: null,
        status: "waiting",
        playerCount: 1,
        createdAt: "2026-04-12T00:00:00Z",
        updatedAt: "2026-04-12T00:00:00Z",
      },
    };

    dispatch(message);

    const rooms = useLobbyStore.getState().rooms;
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.id).toBe(1);
    expect(rooms[0]!.name).toBe("Test Room");
  });

  it("routes system:room_updated to lobbyStore.updateRoom", () => {
    // Pre-populate with a room
    useLobbyStore.getState().addRoom({
      id: 2,
      name: "Old Name",
      code: "XYZ789",
      ownerId: 42,
      variant: "bitola",
      matchMode: "1001",
      timerStyle: "relaxed",
      timerDurationSeconds: null,
      status: "waiting",
      playerCount: 1,
      isQuickPlay: false,
      createdAt: "2026-04-12T00:00:00Z",
      updatedAt: "2026-04-12T00:00:00Z",
    });

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:room_updated",
      payload: {
        id: 2,
        name: "Updated Name",
        code: "XYZ789",
        ownerId: 42,
        variant: "bitola",
        matchMode: "1001",
        timerStyle: "per-move",
        timerDurationSeconds: 30,
        status: "waiting",
        playerCount: 2,
        createdAt: "2026-04-12T00:00:00Z",
        updatedAt: "2026-04-12T00:01:00Z",
      },
    });

    const rooms = useLobbyStore.getState().rooms;
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.name).toBe("Updated Name");
    expect(rooms[0]!.playerCount).toBe(2);
  });

  it("removes room from lobby when status is not waiting", () => {
    useLobbyStore.getState().addRoom({
      id: 3,
      name: "Active Room",
      code: "AAA111",
      ownerId: 42,
      variant: "bitola",
      matchMode: "1001",
      timerStyle: "relaxed",
      timerDurationSeconds: null,
      status: "waiting",
      playerCount: 4,
      isQuickPlay: false,
      createdAt: "2026-04-12T00:00:00Z",
      updatedAt: "2026-04-12T00:00:00Z",
    });

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:room_updated",
      payload: {
        id: 3,
        name: "Active Room",
        code: "AAA111",
        ownerId: 42,
        variant: "bitola",
        matchMode: "1001",
        timerStyle: "relaxed",
        timerDurationSeconds: null,
        status: "playing",
        playerCount: 4,
        createdAt: "2026-04-12T00:00:00Z",
        updatedAt: "2026-04-12T00:01:00Z",
      },
    });

    const rooms = useLobbyStore.getState().rooms;
    expect(rooms).toHaveLength(0);
  });

  it("handles error: prefix without crashing", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "error:not_your_turn",
      payload: { code: "NOT_YOUR_TURN", message: "it is not your turn" },
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles malformed message payload without crashing", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "unknown:prefix",
      payload: {},
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("ignores auth events handled by useWebSocket", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    // These should not throw or route to any store
    dispatch({ type: "system:authenticated", payload: { userId: 42 } });
    dispatch({ type: "error:auth_failed", payload: { message: "bad token" } });

    // No rooms added
    expect(useLobbyStore.getState().rooms).toHaveLength(0);
  });

  it("dispatches event:game_state to gameStore", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:game_state",
      payload: mockGameState,
    });

    const state = useGameStore.getState();
    expect(state.gameState).not.toBeNull();
    expect(state.gameState?.phase).toBe("playing");
    expect(state.gameState?.roomId).toBe(100);
    expect(state.roomId).toBe(100);
  });

  it("dispatches event:card_played to gameStore", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:card_played",
      payload: { playerSeat: 1, cardId: "7H", autoPlayed: false },
    });

    const state = useGameStore.getState();
    expect(state.gameState?.currentTrick).toHaveLength(1);
    expect(state.gameState?.currentTrick[0]!.playerSeat).toBe(1);
  });

  it("dispatches event:hand_scored to gameStore and sets scoreRevealData", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:hand_scored",
      payload: {
        redCardPoints: 70,
        blueCardPoints: 82,
        redDeclPoints: 0,
        blueDeclPoints: 0,
        lastTrickTeam: 1,
        lastTrickBonus: 10,
        capot: false,
        capotTeam: null,
        capotBonus: 0,
        failedContract: false,
        contractingTeam: 1,
        redHandTotal: 70,
        blueHandTotal: 92,
        redMatchScore: 70,
        blueMatchScore: 92,
      },
    });

    const state = useGameStore.getState();
    expect(state.gameState?.teamScores[0]).toBe(70);
    expect(state.gameState?.teamScores[1]).toBe(92);
    expect(state.scoreRevealData).not.toBeNull();
    expect(state.scoreRevealData?.redCardPoints).toBe(70);
    expect(state.scoreRevealData?.capot).toBe(false);
  });

  it("dispatches event:match_end to gameStore", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:match_end",
      payload: { winnerTeam: 0, redFinalScore: 1020, blueFinalScore: 850, matchDurationSec: 300 },
    });

    const state = useGameStore.getState();
    expect(state.gameState?.phase).toBe("match_end");
    expect(state.gameState?.teamScores[0]).toBe(1020);
    expect(state.gameState?.teamScores[1]).toBe(850);
    expect(state.matchEndData?.matchDurationSec).toBe(300);
  });

  // --- Room lobby event dispatch tests ---

  it("dispatches system:player_joined to roomLobbyStore", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:player_joined",
      payload: {
        roomId: 10,
        userId: 42,
        username: "Alice",
        playerCount: 2,
      },
    });

    const state = useRoomLobbyStore.getState();
    expect(state.players).toHaveLength(1);
    expect(state.players[0]!.userId).toBe(42);
    expect(state.players[0]!.username).toBe("Alice");
    expect(state.players[0]!.id).toBe(42); // Uses userId, not hardcoded 0 (D24 fix)
  });

  it("dispatches system:player_left to roomLobbyStore", () => {
    // Pre-populate a player
    useRoomLobbyStore.getState().addPlayer(
      {
        id: 42,
        roomId: 10,
        userId: 42,
        username: "Alice",
        seat: null,
        team: null,
        createdAt: "",
      },
      2,
    );

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:player_left",
      payload: {
        roomId: 10,
        userId: 42,
        username: "Alice",
        playerCount: 1,
      },
    });

    expect(useRoomLobbyStore.getState().players).toHaveLength(0);
  });

  it("dispatches system:seat_updated to roomLobbyStore", () => {
    useRoomLobbyStore.getState().addPlayer(
      {
        id: 42,
        roomId: 10,
        userId: 42,
        username: "Alice",
        seat: null,
        team: null,
        createdAt: "",
      },
      1,
    );

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:seat_updated",
      payload: {
        roomId: 10,
        userId: 42,
        username: "Alice",
        seat: 2,
        team: "red",
        previousSeat: null,
      },
    });

    const player = useRoomLobbyStore.getState().players[0]!;
    expect(player.seat).toBe(2);
    expect(player.team).toBe("red");
  });

  it("dispatches system:game_started to roomLobbyStore", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:game_started",
      payload: { roomId: 10 },
    });

    expect(useRoomLobbyStore.getState().gameStarted).toBe(true);
  });
});
