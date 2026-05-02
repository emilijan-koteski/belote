import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogoutApi = vi.fn();
vi.mock("@/shared/api/auth", () => ({
  logout: (...args: unknown[]) => mockLogoutApi(...args),
}));

import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import { useGameStore } from "./gameStore";
import { useRoomLobbyStore } from "./roomLobbyStore";

describe("authStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, isLoading: false });
    useGameStore.getState().clearGame();
    useRoomLobbyStore.getState().reset();
    useChatStore.getState().clearGlobal();
    useChatStore.getState().clearMatch();
    useChatStore.getState().clearRoom();
  });

  it("logout clears token and user from store", () => {
    useAuthStore.setState({
      token: "test-token",
      user: {
        id: 1,
        username: "test",
        email: "test@test.com",
        languagePreference: "en",
        createdAt: "2026-01-01",
      },
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("logout calls backend /auth/logout endpoint", () => {
    useAuthStore.setState({ token: "test-token" });

    useAuthStore.getState().logout();

    expect(mockLogoutApi).toHaveBeenCalled();
  });

  // Story 8.5-1 AC6 (D66): logout must wipe session-scoped stores so a
  // re-login does not inherit stale state. Without this, the 401 →
  // refresh-fail → logout path leaves gameStore.gameState populated and
  // useReconnectionRedirect navigates the freshly re-logged-in user to a
  // finished game's /game/{id} page.
  it("clears gameStore on logout", () => {
    // Bypass setGameState's normalization (which expects a full GameState
    // shape) — the test only cares that gameState is non-null before logout
    // and null after. Other tests cover the GameState shape.
    useGameStore.setState({
      gameState: {
        phase: "match_end",
        players: [],
      } as unknown as Parameters<typeof useGameStore.setState>[0] extends infer S
        ? S extends { gameState?: infer G }
          ? G
          : never
        : never,
    });
    expect(useGameStore.getState().gameState).not.toBeNull();

    useAuthStore.getState().logout();

    expect(useGameStore.getState().gameState).toBeNull();
  });

  it("resets roomLobbyStore on logout", () => {
    useRoomLobbyStore
      .getState()
      .setPlayers([{ id: 1, roomId: 1, userId: 10, username: "P1" }] as unknown as Parameters<
        ReturnType<typeof useRoomLobbyStore.getState>["setPlayers"]
      >[0]);
    expect(useRoomLobbyStore.getState().players.length).toBeGreaterThan(0);

    useAuthStore.getState().logout();

    expect(useRoomLobbyStore.getState().players).toEqual([]);
  });

  it("clears chatStore buffers on logout", () => {
    const msg = {
      userId: 10,
      username: "P1",
      message: "hello",
      timestamp: new Date().toISOString(),
      scope: "global" as const,
    };
    useChatStore.getState().appendGlobal(msg);
    useChatStore.getState().appendMatch({ ...msg, scope: "match" as const });
    useChatStore.getState().appendRoom({ ...msg, scope: "room" as const });
    expect(useChatStore.getState().globalMessages.length).toBe(1);
    expect(useChatStore.getState().matchMessages.length).toBe(1);
    expect(useChatStore.getState().roomMessages.length).toBe(1);

    useAuthStore.getState().logout();

    expect(useChatStore.getState().globalMessages).toEqual([]);
    expect(useChatStore.getState().matchMessages).toEqual([]);
    expect(useChatStore.getState().roomMessages).toEqual([]);
  });
});
