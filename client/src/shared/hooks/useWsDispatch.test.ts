import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLobbyStore } from "@/shared/stores/lobbyStore";
import type { WsMessage } from "@/shared/types/wsEvents";

import { useWsDispatch } from "./useWsDispatch";
import { renderHook } from "@testing-library/react";

describe("useWsDispatch", () => {
  beforeEach(() => {
    useLobbyStore.setState({
      rooms: [],
      isLoading: false,
      searchQuery: "",
    });
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
    expect(rooms[0].id).toBe(1);
    expect(rooms[0].name).toBe("Test Room");
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
    expect(rooms[0].name).toBe("Updated Name");
    expect(rooms[0].playerCount).toBe(2);
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
});
