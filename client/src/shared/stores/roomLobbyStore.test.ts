import { beforeEach, describe, expect, it } from "vitest";

import { useRoomLobbyStore } from "./roomLobbyStore";

describe("roomLobbyStore", () => {
  beforeEach(() => {
    useRoomLobbyStore.getState().reset();
  });

  it("initializes with null room, empty players, and gameStarted false", () => {
    const state = useRoomLobbyStore.getState();
    expect(state.room).toBeNull();
    expect(state.players).toEqual([]);
    expect(state.gameStarted).toBe(false);
  });

  it("addPlayer adds a new player to the list", () => {
    const player = {
      id: 1,
      roomId: 10,
      userId: 42,
      username: "Alice",
      seat: null,
      team: null,
      createdAt: "2026-04-12T00:00:00Z",
    };
    useRoomLobbyStore.getState().addPlayer(player, 2);

    const state = useRoomLobbyStore.getState();
    expect(state.players).toHaveLength(1);
    expect(state.players[0]!.username).toBe("Alice");
  });

  it("addPlayer updates room playerCount", () => {
    useRoomLobbyStore.getState().setRoom({
      id: 10,
      name: "Test",
      code: "ABC123",
      ownerId: 1,
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

    const player = {
      id: 2,
      roomId: 10,
      userId: 42,
      username: "Alice",
      seat: null,
      team: null,
      createdAt: "2026-04-12T00:00:00Z",
    };
    useRoomLobbyStore.getState().addPlayer(player, 2);

    expect(useRoomLobbyStore.getState().room?.playerCount).toBe(2);
  });

  it("addPlayer does not duplicate players with the same userId", () => {
    const player = {
      id: 1,
      roomId: 10,
      userId: 42,
      username: "Alice",
      seat: null,
      team: null,
      createdAt: "2026-04-12T00:00:00Z",
    };
    useRoomLobbyStore.getState().addPlayer(player, 1);
    useRoomLobbyStore.getState().addPlayer(player, 2);

    expect(useRoomLobbyStore.getState().players).toHaveLength(1);
  });

  it("removePlayer removes a player by userId", () => {
    const player = {
      id: 1,
      roomId: 10,
      userId: 42,
      username: "Alice",
      seat: null,
      team: null,
      createdAt: "2026-04-12T00:00:00Z",
    };
    useRoomLobbyStore.getState().addPlayer(player, 1);
    useRoomLobbyStore.getState().removePlayer(42, 0);

    expect(useRoomLobbyStore.getState().players).toHaveLength(0);
  });

  it("removePlayer updates ownerId when newOwnerId is provided", () => {
    useRoomLobbyStore.getState().setRoom({
      id: 10,
      name: "Test",
      code: "ABC123",
      ownerId: 42,
      variant: "bitola",
      matchMode: "1001",
      timerStyle: "relaxed",
      timerDurationSeconds: null,
      status: "waiting",
      playerCount: 2,
      isQuickPlay: false,
      createdAt: "2026-04-12T00:00:00Z",
      updatedAt: "2026-04-12T00:00:00Z",
    });

    useRoomLobbyStore.getState().removePlayer(42, 1, 99);

    expect(useRoomLobbyStore.getState().room?.ownerId).toBe(99);
  });

  it("updatePlayerSeat modifies a player's seat and team", () => {
    const player = {
      id: 1,
      roomId: 10,
      userId: 42,
      username: "Alice",
      seat: null,
      team: null,
      createdAt: "2026-04-12T00:00:00Z",
    };
    useRoomLobbyStore.getState().addPlayer(player, 1);

    useRoomLobbyStore.getState().updatePlayerSeat(42, 2, "teamA", null);

    const updated = useRoomLobbyStore.getState().players[0]!;
    expect(updated.seat).toBe(2);
    expect(updated.team).toBe("teamA");
  });

  it("setGameStarted sets the gameStarted flag", () => {
    useRoomLobbyStore.getState().setGameStarted(true);
    expect(useRoomLobbyStore.getState().gameStarted).toBe(true);
  });

  it("reset clears all state", () => {
    useRoomLobbyStore.getState().setGameStarted(true);
    useRoomLobbyStore.getState().addPlayer(
      {
        id: 1,
        roomId: 10,
        userId: 42,
        username: "Alice",
        seat: null,
        team: null,
        createdAt: "2026-04-12T00:00:00Z",
      },
      1,
    );

    useRoomLobbyStore.getState().reset();

    const state = useRoomLobbyStore.getState();
    expect(state.room).toBeNull();
    expect(state.players).toEqual([]);
    expect(state.gameStarted).toBe(false);
  });
});
