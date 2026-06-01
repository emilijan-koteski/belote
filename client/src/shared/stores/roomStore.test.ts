import { beforeEach, describe, expect, it } from "vitest";

import { useRoomStore } from "./roomStore";

describe("roomStore", () => {
  beforeEach(() => {
    useRoomStore.getState().reset();
  });

  it("initializes with null room, empty players, and matchStarted false", () => {
    const state = useRoomStore.getState();
    expect(state.room).toBeNull();
    expect(state.players).toEqual([]);
    expect(state.matchStarted).toBe(false);
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
    useRoomStore.getState().addPlayer(player, 2);

    const state = useRoomStore.getState();
    expect(state.players).toHaveLength(1);
    expect(state.players[0]!.username).toBe("Alice");
  });

  it("addPlayer updates room playerCount", () => {
    useRoomStore.getState().setRoom({
      id: 10,
      name: "Test",
      code: "ABC123",
      ownerId: 1,
      ownerUsername: "owner",
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
    useRoomStore.getState().addPlayer(player, 2);

    expect(useRoomStore.getState().room?.playerCount).toBe(2);
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
    useRoomStore.getState().addPlayer(player, 1);
    useRoomStore.getState().addPlayer(player, 2);

    expect(useRoomStore.getState().players).toHaveLength(1);
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
    useRoomStore.getState().addPlayer(player, 1);
    useRoomStore.getState().removePlayer(42, 0);

    expect(useRoomStore.getState().players).toHaveLength(0);
  });

  it("removePlayer updates ownerId when newOwnerId is provided", () => {
    useRoomStore.getState().setRoom({
      id: 10,
      name: "Test",
      code: "ABC123",
      ownerId: 42,
      ownerUsername: "owner",
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

    useRoomStore.getState().removePlayer(42, 1, 99);

    expect(useRoomStore.getState().room?.ownerId).toBe(99);
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
    useRoomStore.getState().addPlayer(player, 1);

    useRoomStore.getState().updatePlayerSeat(42, 2, "teamA", null);

    const updated = useRoomStore.getState().players[0]!;
    expect(updated.seat).toBe(2);
    expect(updated.team).toBe("teamA");
  });

  it("setMatchStarted sets the matchStarted flag", () => {
    useRoomStore.getState().setMatchStarted(true);
    expect(useRoomStore.getState().matchStarted).toBe(true);
  });

  it("reset clears all state", () => {
    useRoomStore.getState().setMatchStarted(true);
    useRoomStore.getState().addPlayer(
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

    useRoomStore.getState().reset();

    const state = useRoomStore.getState();
    expect(state.room).toBeNull();
    expect(state.players).toEqual([]);
    expect(state.matchStarted).toBe(false);
  });
});
