import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub sonner so toast assertions can run; the real module exports more than
// these methods but the dispatcher only touches `info`/`warning`/`success`/`error`.
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

import { queryClient } from "@/shared/api/queryClient";
import { queryKeys } from "@/shared/api/queryKeys";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";
import { useRoomLobbyStore } from "@/shared/stores/roomLobbyStore";
import type { Room } from "@/shared/types/apiTypes";
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
  deck: [],
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

describe("useWsDispatch", () => {
  beforeEach(() => {
    queryClient.clear();
    useGameStore.getState().reset();
    useRoomLobbyStore.getState().reset();
    useChatStore.setState({ globalMessages: [], matchMessages: [], roomMessages: [] });
    vi.restoreAllMocks();
  });

  it("routes system:room_created to queryClient room cache", () => {
    // Seed the cache with an empty rooms list
    queryClient.setQueryData<Room[]>(queryKeys.rooms.list("waiting"), []);

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

    const rooms = queryClient.getQueryData<Room[]>(queryKeys.rooms.list("waiting"));
    expect(rooms).toHaveLength(1);
    expect(rooms![0]!.id).toBe(1);
    expect(rooms![0]!.name).toBe("Test Room");
  });

  it("routes system:room_updated to queryClient room cache", () => {
    // Pre-populate with a room
    queryClient.setQueryData<Room[]>(queryKeys.rooms.list("waiting"), [
      {
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
      },
    ]);

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

    const rooms = queryClient.getQueryData<Room[]>(queryKeys.rooms.list("waiting"));
    expect(rooms).toHaveLength(1);
    expect(rooms![0]!.name).toBe("Updated Name");
    expect(rooms![0]!.playerCount).toBe(2);
  });

  it("removes room from cache when status is not waiting", () => {
    queryClient.setQueryData<Room[]>(queryKeys.rooms.list("waiting"), [
      {
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
      },
    ]);

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

    const rooms = queryClient.getQueryData<Room[]>(queryKeys.rooms.list("waiting"));
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

    // No rooms added to cache
    expect(queryClient.getQueryData(queryKeys.rooms.list("waiting"))).toBeUndefined();
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
      },
    });

    const state = useGameStore.getState();
    expect(state.gameState?.teamScores[0]).toBe(70);
    expect(state.gameState?.teamScores[1]).toBe(92);
    expect(state.scoreRevealData).not.toBeNull();
    expect(state.scoreRevealData?.teamACardPoints).toBe(70);
    expect(state.scoreRevealData?.capot).toBe(false);
  });

  it("zeroes handPoints and declarationPoints on event:hand_scored to clear stale potential", () => {
    useGameStore.getState().setGameState({
      ...mockGameState,
      handPoints: [70, 82],
      declarationPoints: [0, 50],
    });

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:hand_scored",
      payload: {
        teamACardPoints: 70,
        teamBCardPoints: 82,
        teamADeclPoints: 0,
        teamBDeclPoints: 50,
        lastTrickTeam: 1,
        lastTrickBonus: 10,
        capot: false,
        capotTeam: null,
        capotBonus: 0,
        failedContract: false,
        contractingTeam: 1,
        teamAHandTotal: 70,
        teamBHandTotal: 142,
        teamAMatchScore: 70,
        teamBMatchScore: 142,
      },
    });

    const state = useGameStore.getState();
    expect(state.gameState?.handPoints).toEqual([0, 0]);
    expect(state.gameState?.declarationPoints).toEqual([0, 0]);
  });

  it("dispatches event:match_end to gameStore", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:match_end",
      payload: {
        winnerTeam: 0,
        teamAFinalScore: 1020,
        teamBFinalScore: 850,
        matchDurationSec: 300,
      },
    });

    const state = useGameStore.getState();
    expect(state.gameState?.phase).toBe("match_end");
    expect(state.gameState?.teamScores[0]).toBe(1020);
    expect(state.gameState?.teamScores[1]).toBe(850);
    expect(state.matchEndData?.matchDurationSec).toBe(300);
  });

  it("dispatches event:trump_selected to gameStore.trumpReveal", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:trump_selected",
      payload: { playerSeat: 2, trumpSuit: "S", cardId: "7S" },
    });

    const reveal = useGameStore.getState().trumpReveal;
    expect(reveal).not.toBeNull();
    expect(reveal?.playerSeat).toBe(2);
    expect(reveal?.trumpSuit).toBe("S");
    expect(reveal?.cardId).toBe("7S");
  });

  it("ignores malformed event:trump_selected payloads (cardId guard)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:trump_selected",
      payload: { playerSeat: 2, trumpSuit: "S", cardId: "" },
    });
    dispatch({
      type: "event:trump_selected",
      payload: { playerSeat: 2, trumpSuit: "S", cardId: "X" },
    });

    expect(useGameStore.getState().trumpReveal).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
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
        team: "teamA",
        previousSeat: null,
      },
    });

    const player = useRoomLobbyStore.getState().players[0]!;
    expect(player.seat).toBe(2);
    expect(player.team).toBe("teamA");
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

  it("appends system:chat_message with scope=global to chatStore", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:chat_message",
      payload: {
        userId: 7,
        username: "alice",
        message: "hello world",
        timestamp: "2026-04-18T10:00:00Z",
        scope: "global",
      },
    });

    const messages = useChatStore.getState().globalMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      userId: 7,
      username: "alice",
      message: "hello world",
      scope: "global",
    });
  });

  it("appends system:chat_message with scope=match to chatStore.matchMessages when in a match", () => {
    // Dispatcher requires gameStore.roomId to be set (defence in depth)
    useGameStore.setState({ roomId: 42 });

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:chat_message",
      payload: {
        userId: 7,
        username: "alice",
        message: "team only",
        timestamp: "2026-04-18T10:00:00Z",
        scope: "match",
      },
    });

    const state = useChatStore.getState();
    expect(state.matchMessages).toHaveLength(1);
    expect(state.matchMessages[0]).toMatchObject({
      userId: 7,
      username: "alice",
      message: "team only",
      scope: "match",
    });
    expect(state.globalMessages).toHaveLength(0);
  });

  it("drops scope=match payloads when gameStore.roomId is null (no active match)", () => {
    // roomId=null is the default from beforeEach reset — a match payload
    // arriving after clearGame must not leak into the next match's history.
    expect(useGameStore.getState().roomId).toBeNull();

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:chat_message",
      payload: {
        userId: 7,
        username: "alice",
        message: "stale",
        timestamp: "2026-04-18T10:00:00Z",
        scope: "match",
      },
    });

    expect(useChatStore.getState().matchMessages).toHaveLength(0);
  });

  it("appends system:chat_message with scope=room to chatStore.roomMessages when in a room", () => {
    // Dispatcher requires roomLobbyStore.currentRoomId to be set (defence in depth)
    useRoomLobbyStore.setState({ currentRoomId: 5 });

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:chat_message",
      payload: {
        userId: 7,
        username: "alice",
        message: "room ping",
        timestamp: "2026-04-22T10:00:00Z",
        scope: "room",
      },
    });

    const state = useChatStore.getState();
    expect(state.roomMessages).toHaveLength(1);
    expect(state.roomMessages[0]).toMatchObject({
      userId: 7,
      username: "alice",
      message: "room ping",
      scope: "room",
    });
    expect(state.globalMessages).toHaveLength(0);
    expect(state.matchMessages).toHaveLength(0);
  });

  it("drops scope=room payloads when roomLobbyStore.currentRoomId is null", () => {
    // currentRoomId=null is the default from beforeEach reset — a stale room
    // payload arriving after leaving the room must not leak into the next
    // room's history.
    expect(useRoomLobbyStore.getState().currentRoomId).toBeNull();

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:chat_message",
      payload: {
        userId: 7,
        username: "alice",
        message: "stale",
        timestamp: "2026-04-22T10:00:00Z",
        scope: "room",
      },
    });

    expect(useChatStore.getState().roomMessages).toHaveLength(0);
  });

  it("scope=global does not leak into matchMessages (partition isolation)", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:chat_message",
      payload: {
        userId: 1,
        username: "alice",
        message: "global-only",
        timestamp: "2026-04-18T10:00:00Z",
        scope: "global",
      },
    });

    expect(useChatStore.getState().matchMessages).toHaveLength(0);
    expect(useChatStore.getState().globalMessages).toHaveLength(1);
  });

  it("ignores malformed system:chat_message payloads (defensive validation)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    const malformedPayloads: unknown[] = [
      null,
      undefined,
      {},
      { userId: "not-a-number", username: "x", message: "x", timestamp: "x", scope: "global" },
      { userId: 1, username: null, message: "x", timestamp: "x", scope: "global" },
      { userId: 1, username: "x", message: 42, timestamp: "x", scope: "global" },
      { userId: 1, username: "x", message: "x", timestamp: undefined, scope: "global" },
      { userId: 1, username: "x", message: "x", timestamp: "x" /* no scope */ },
    ];

    for (const payload of malformedPayloads) {
      dispatch({ type: "system:chat_message", payload });
    }

    expect(useChatStore.getState().globalMessages).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("dispatches system:room_kicked to roomLobbyStore when currentRoomId matches", () => {
    useRoomLobbyStore.getState().setCurrentRoomId(5);
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:room_kicked",
      payload: { roomId: 5, reason: "kicked_by_owner" },
    });

    expect(useRoomLobbyStore.getState().kickedFromRoomId).toBe(5);
  });

  it("ignores system:room_kicked for a different room", () => {
    useRoomLobbyStore.getState().setCurrentRoomId(9);
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:room_kicked",
      payload: { roomId: 5, reason: "kicked_by_owner" },
    });

    expect(useRoomLobbyStore.getState().kickedFromRoomId).toBeNull();
  });

  it("ignores system:room_kicked when currentRoomId is null", () => {
    // currentRoomId=null means the user is not viewing any room. Setting
    // kickedFromRoomId here would persist as a sticky flag and trip on a
    // later re-entry to the same room — so the dispatcher requires a
    // positive room match.
    expect(useRoomLobbyStore.getState().currentRoomId).toBeNull();
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:room_kicked",
      payload: { roomId: 5, reason: "kicked_by_owner" },
    });

    expect(useRoomLobbyStore.getState().kickedFromRoomId).toBeNull();
  });

  // --- Surrender (Story 8.2) ---

  it("dispatches event:surrender_proposed to gameStore.surrenderProposed", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:surrender_proposed",
      payload: {
        proposerSeat: 0,
        proposerTeam: 0,
        proposerUsername: "Alice",
        partnerSeat: 2,
      },
    });

    const state = useGameStore.getState();
    expect(state.surrenderProposed).not.toBeNull();
    expect(state.surrenderProposed?.proposerSeat).toBe(0);
    expect(state.surrenderProposed?.partnerSeat).toBe(2);
  });

  it("ignores event:surrender_proposed when no active game state", () => {
    // Defence in depth — gameState=null means no active match, so the
    // proposal must not surface in the store.
    expect(useGameStore.getState().gameState).toBeNull();

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:surrender_proposed",
      payload: {
        proposerSeat: 0,
        proposerTeam: 0,
        proposerUsername: "Alice",
        partnerSeat: 2,
      },
    });

    expect(useGameStore.getState().surrenderProposed).toBeNull();
  });

  it("dispatches event:surrender_declined to gameStore.surrenderDeclined", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:surrender_declined",
      payload: { proposerSeat: 0, decliningSeat: 2 },
    });

    const declined = useGameStore.getState().surrenderDeclined;
    expect(declined).not.toBeNull();
    expect(declined?.proposerSeat).toBe(0);
    expect(declined?.decliningSeat).toBe(2);
  });

  it("propagates outcomeReason+surrenderedBySeat through event:match_end", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "event:match_end",
      payload: {
        winnerTeam: 1,
        teamAFinalScore: 420,
        teamBFinalScore: 600,
        matchDurationSec: 280,
        outcomeReason: "surrender",
        surrenderedBySeat: 0,
      },
    });

    const data = useGameStore.getState().matchEndData;
    expect(data?.outcomeReason).toBe("surrender");
    expect(data?.surrenderedBySeat).toBe(0);
  });

  it("does NOT crash on error:surrender_exhausted", () => {
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    expect(() =>
      dispatch({
        type: "error:surrender_exhausted",
        payload: { code: "SURRENDER_EXHAUSTED", message: "already used" },
      }),
    ).not.toThrow();
  });

  it("surfaces toast.error on error:surrender_exhausted", () => {
    vi.mocked(toast.error).mockClear();
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "error:surrender_exhausted",
      payload: { code: "SURRENDER_EXHAUSTED", message: "already used" },
    });

    // i18next without an initialized bundle in this test suite returns the
    // resolved key path or undefined depending on setup; the load-bearing
    // assertion is that the dispatcher calls toast.error exactly once for
    // this event type, which the previous "does NOT crash" test missed.
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("writes ERROR_SURRENDER_EXHAUSTED to gameStore.lastError", () => {
    expect(useGameStore.getState().lastError).toBeNull();
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "error:surrender_exhausted",
      payload: { code: "SURRENDER_EXHAUSTED", message: "already used" },
    });

    expect(useGameStore.getState().lastError).toBe("error:surrender_exhausted");
  });

  // --- Emote (Story 8.3) ---

  it("writes a valid system:emote payload to gameStore.activeEmotes", () => {
    useGameStore.getState().setGameState(mockGameState);

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:emote",
      payload: { playerSeat: 2, emote: "thumbs_up" },
    });

    const slot = useGameStore.getState().activeEmotes[2];
    expect(slot).not.toBeNull();
    expect(slot?.emote).toBe("thumbs_up");
    expect(typeof slot?.receivedAt).toBe("number");
  });

  it("ignores malformed system:emote payloads (defensive validation)", () => {
    useGameStore.getState().setGameState(mockGameState);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    const malformedPayloads: unknown[] = [
      null,
      undefined,
      {},
      { playerSeat: -1, emote: "thumbs_up" },
      { playerSeat: 4, emote: "thumbs_up" },
      { playerSeat: "2", emote: "thumbs_up" },
      { playerSeat: 0, emote: "shrug" },
      { playerSeat: 0, emote: 42 },
      { playerSeat: 0 /* no emote */ },
    ];

    for (const payload of malformedPayloads) {
      dispatch({ type: "system:emote", payload });
    }

    // No slots written.
    expect(useGameStore.getState().activeEmotes).toEqual({
      0: null,
      1: null,
      2: null,
      3: null,
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignores system:emote when no active game state (defence in depth)", () => {
    expect(useGameStore.getState().gameState).toBeNull();

    const { result } = renderHook(() => useWsDispatch());
    const dispatch = result.current;

    dispatch({
      type: "system:emote",
      payload: { playerSeat: 0, emote: "clap" },
    });

    expect(useGameStore.getState().activeEmotes).toEqual({
      0: null,
      1: null,
      2: null,
      3: null,
    });
  });
});
