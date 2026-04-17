import i18n from "i18next";
import { useCallback } from "react";
import { toast } from "sonner";

import { handleWsMessage as handleRoomListMessage } from "@/features/lobby/useRoomUpdates";
import { useGameStore } from "@/shared/stores/gameStore";
import { useRoomLobbyStore } from "@/shared/stores/roomLobbyStore";
import type { GameState } from "@/shared/types/gameTypes";
import type {
  BelotAnnouncedPayload,
  CardPlayedPayload,
  DeclarationsResolvedPayload,
  GameResumedPayload,
  GameStartedPayload,
  HandScoredPayload,
  MatchAbandonedPayload,
  MatchEndPayload,
  PlayerDisconnectedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PlayerReconnectedPayload,
  SeatUpdatedPayload,
  TrickResolvedPayload,
  WsMessage,
} from "@/shared/types/wsEvents";
import {
  ERROR_AUTH_FAILED,
  ERROR_ILLEGAL_PLAY,
  ERROR_INVALID_ACTION,
  ERROR_NO_ACTIVE_PAUSE,
  ERROR_NOT_ROOM_OWNER,
  ERROR_NOT_YOUR_TURN,
  ERROR_PAUSE_EXHAUSTED,
  ERROR_PLAYER_DISCONNECTED,
  ERROR_WRONG_PHASE,
  EVENT_BELOT_ANNOUNCED,
  EVENT_CARD_PLAYED,
  EVENT_DECLARATIONS_RESOLVED,
  EVENT_GAME_PAUSED,
  EVENT_GAME_RESUMED,
  EVENT_GAME_STATE,
  EVENT_HAND_SCORED,
  EVENT_MATCH_ABANDONED,
  EVENT_MATCH_END,
  EVENT_PLAYER_DISCONNECTED,
  EVENT_PLAYER_RECONNECTED,
  EVENT_TRICK_RESOLVED,
  EVENT_TRUMP_SELECTED,
  SYSTEM_AUTHENTICATED,
  SYSTEM_CHAT_MESSAGE,
  SYSTEM_GAME_STARTED,
  SYSTEM_PLAYER_JOINED,
  SYSTEM_PLAYER_LEFT,
  SYSTEM_ROOM_CREATED,
  SYSTEM_ROOM_UPDATED,
  SYSTEM_SEAT_UPDATED,
} from "@/shared/types/wsEvents";

export function useWsDispatch() {
  const dispatch = useCallback((message: WsMessage) => {
    const { type } = message;

    // Auth events are handled by useWebSocket directly
    if (type === SYSTEM_AUTHENTICATED || type === ERROR_AUTH_FAILED) {
      return;
    }

    const prefix = type.indexOf(":") >= 0 ? type.slice(0, type.indexOf(":")) : "";

    switch (prefix) {
      case "event":
        dispatchGameEvent(message);
        break;
      case "system":
        dispatchSystemEvent(message);
        break;
      case "error":
        dispatchErrorEvent(message);
        break;
      default:
        console.warn("WS: unknown event prefix", type);
    }
  }, []);

  return dispatch;
}

function dispatchGameEvent(message: WsMessage): void {
  const store = useGameStore.getState();
  const { type } = message;

  if (type === EVENT_GAME_STATE) {
    const gameState = message.payload as GameState;
    store.setGameState(gameState);
    return;
  }

  if (type === EVENT_CARD_PLAYED) {
    // Card played is an incremental event — update trick only.
    // activePlayerSeat is NOT computed client-side (no local game logic).
    // The server will send the authoritative state via event:game_state or
    // the next action's broadcast will carry the correct active player.
    const payload = message.payload as CardPlayedPayload;
    const current = store.gameState;
    if (current) {
      if (!payload.cardId || payload.cardId.length < 2) return;
      const rank = payload.cardId[0];
      const suit = payload.cardId[1];
      store.setGameState({
        ...current,
        currentTrick: [
          ...(current.currentTrick ?? []),
          {
            card: {
              rank: rank as "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A",
              suit: suit as "S" | "H" | "D" | "C",
            },
            playerSeat: payload.playerSeat,
          },
        ],
      });
    }

    // Auto-play toast notification
    if (payload.autoPlayed) {
      toast.info(i18n.t("game.timer.autoPlayed", { card: payload.cardId }), {
        duration: 3000,
      });
    }
    return;
  }

  if (type === EVENT_TRICK_RESOLVED) {
    const payload = message.payload as TrickResolvedPayload;
    const current = store.gameState;
    if (current) {
      store.setGameState({
        ...current,
        currentTrick: [],
        trickNumber: current.trickNumber + 1,
        trickWinnerSeat: payload.winnerSeat,
      });
    }
    return;
  }

  if (type === EVENT_HAND_SCORED) {
    const payload = message.payload as HandScoredPayload;
    const current = store.gameState;
    if (current) {
      // Clear per-hand fields here so the ScorePanel's "this hand" line disappears
      // immediately. The follow-up event:game_state will replace them with the
      // new-hand defaults, but zeroing now avoids a flicker of stale potentials.
      store.setGameState({
        ...current,
        teamScores: [payload.redMatchScore, payload.blueMatchScore],
        handPoints: [0, 0],
        declarationPoints: [0, 0],
      });
    }
    store.setScoreRevealData(payload);
    return;
  }

  if (type === EVENT_MATCH_END) {
    const payload = message.payload as MatchEndPayload;
    const current = store.gameState;
    if (current) {
      store.setGameState({
        ...current,
        phase: "match_end",
        teamScores: [payload.redFinalScore, payload.blueFinalScore],
      });
    }
    store.setMatchEndData(payload);
    return;
  }

  if (type === EVENT_TRUMP_SELECTED) {
    // Informational only — the full event:game_state that follows carries all updated fields
    // (activePlayerSeat, trumpSuit, phase, trumpCallerSeat, etc.)
    return;
  }

  if (type === EVENT_DECLARATIONS_RESOLVED) {
    const payload = message.payload as DeclarationsResolvedPayload;
    store.setDeclarationReveal(payload);
    // Full game state update follows via event:game_state
    return;
  }

  if (type === EVENT_BELOT_ANNOUNCED) {
    const payload = message.payload as BelotAnnouncedPayload;
    // Mirror the card_played guard: drop malformed payloads rather than propagate
    // an empty cardId to BelotReveal where rendering/rank detection would silently break.
    if (!payload.cardId || payload.cardId.length < 2) return;
    store.setBelotReveal(payload);
    // Full state update follows via event:game_state
    return;
  }

  if (type === EVENT_GAME_PAUSED) {
    // Informational — the full event:game_state that follows carries pause state
    return;
  }

  if (type === EVENT_GAME_RESUMED) {
    const payload = message.payload as GameResumedPayload;
    if (payload.ownerOverride) {
      toast.info(i18n.t("game.pause.ownerResumedToast"), { duration: 3000 });
    }
    // Full state update follows via event:game_state
    return;
  }

  if (type === EVENT_PLAYER_DISCONNECTED) {
    const payload = message.payload as PlayerDisconnectedPayload;
    const current = store.gameState;
    const playerName =
      current?.players[payload.playerSeat]?.username ??
      payload.username ??
      `Player ${payload.playerSeat + 1}`;
    toast.warning(i18n.t("game.disconnect.playerDisconnected", { player: playerName }), {
      duration: 5000,
    });
    // Full state update follows via event:game_state
    return;
  }

  if (type === EVENT_PLAYER_RECONNECTED) {
    const payload = message.payload as PlayerReconnectedPayload;
    const current = store.gameState;
    const playerName =
      current?.players[payload.playerSeat]?.username ?? `Player ${payload.playerSeat + 1}`;
    toast.success(i18n.t("game.disconnect.playerReconnected", { player: playerName }), {
      duration: 3000,
    });
    // Full state update follows via event:game_state
    return;
  }

  if (type === EVENT_MATCH_ABANDONED) {
    const payload = message.payload as MatchAbandonedPayload;
    store.setMatchAbandonedData(payload);
    return;
  }
}

function dispatchSystemEvent(message: WsMessage): void {
  const { type } = message;

  // Room list updates — delegate to existing useRoomUpdates handler
  if (type === SYSTEM_ROOM_CREATED || type === SYSTEM_ROOM_UPDATED) {
    handleRoomListMessage(new MessageEvent("message", { data: JSON.stringify(message) }));
    return;
  }

  // Room lobby updates — dispatch to roomLobbyStore (only if event matches the currently viewed room)
  if (type === SYSTEM_PLAYER_JOINED) {
    const payload = message.payload as PlayerJoinedPayload;
    const store = useRoomLobbyStore.getState();
    if (store.currentRoomId !== null && store.currentRoomId !== payload.roomId) return;
    store.addPlayer(
      {
        id: payload.userId, // Use userId as a client-side ID (fixes D24: no longer hardcodes 0)
        roomId: payload.roomId,
        userId: payload.userId,
        username: payload.username,
        seat: null,
        team: null,
        createdAt: new Date().toISOString(),
      },
      payload.playerCount,
    );
    return;
  }

  if (type === SYSTEM_PLAYER_LEFT) {
    const payload = message.payload as PlayerLeftPayload;
    const store = useRoomLobbyStore.getState();
    if (store.currentRoomId !== null && store.currentRoomId !== payload.roomId) return;
    store.removePlayer(payload.userId, payload.playerCount, payload.newOwnerId);
    return;
  }

  if (type === SYSTEM_SEAT_UPDATED) {
    const payload = message.payload as SeatUpdatedPayload;
    const store = useRoomLobbyStore.getState();
    if (store.currentRoomId !== null && store.currentRoomId !== payload.roomId) return;
    store.updatePlayerSeat(payload.userId, payload.seat, payload.team, payload.previousSeat);
    return;
  }

  if (type === SYSTEM_GAME_STARTED) {
    const payload = message.payload as GameStartedPayload;
    const store = useRoomLobbyStore.getState();
    if (store.currentRoomId !== null && store.currentRoomId !== payload.roomId) return;
    store.setGameStarted(true);
    return;
  }

  // Chat events
  if (type === SYSTEM_CHAT_MESSAGE) {
    return;
  }
}

// Game error types that should trigger a user-visible toast
const GAME_ERROR_TYPES: Set<string> = new Set([
  ERROR_WRONG_PHASE,
  ERROR_NOT_YOUR_TURN,
  ERROR_INVALID_ACTION,
  ERROR_ILLEGAL_PLAY,
  ERROR_PAUSE_EXHAUSTED,
  ERROR_NO_ACTIVE_PAUSE,
  ERROR_NOT_ROOM_OWNER,
  ERROR_PLAYER_DISCONNECTED,
]);

function dispatchErrorEvent(message: WsMessage): void {
  const payload = message.payload as { code?: string; message?: string };
  if (GAME_ERROR_TYPES.has(message.type)) {
    useGameStore.getState().setLastError(message.type);
  }
  console.warn("WS error:", message.type, payload.message ?? "");
}
