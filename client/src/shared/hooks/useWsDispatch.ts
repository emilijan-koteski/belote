import { useCallback } from "react";

import { handleWsMessage as handleRoomListMessage } from "@/features/lobby/useRoomUpdates";
import { useGameStore } from "@/shared/stores/gameStore";
import type { GameState } from "@/shared/types/gameTypes";
import type {
  CardPlayedPayload,
  HandScoredPayload,
  MatchEndPayload,
  TrumpSelectedPayload,
  WsMessage,
} from "@/shared/types/wsEvents";
import {
  ERROR_AUTH_FAILED,
  EVENT_BELOT_ANNOUNCED,
  EVENT_CARD_PLAYED,
  EVENT_DECLARATIONS_RESOLVED,
  EVENT_GAME_STATE,
  EVENT_HAND_SCORED,
  EVENT_MATCH_END,
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
      const rank = payload.cardId[0];
      const suit = payload.cardId[1];
      store.setGameState({
        ...current,
        currentTrick: [
          ...current.currentTrick,
          { card: { rank: rank as "7"|"8"|"9"|"T"|"J"|"Q"|"K"|"A", suit: suit as "S"|"H"|"D"|"C" }, playerSeat: payload.playerSeat },
        ],
      });
    }
    return;
  }

  if (type === EVENT_TRICK_RESOLVED) {
    const current = store.gameState;
    if (current) {
      store.setGameState({
        ...current,
        currentTrick: [],
        trickNumber: current.trickNumber + 1,
      });
    }
    return;
  }

  if (type === EVENT_HAND_SCORED) {
    const payload = message.payload as HandScoredPayload;
    const current = store.gameState;
    if (current) {
      store.setGameState({
        ...current,
        teamScores: [payload.redMatchScore, payload.blueMatchScore],
        handPoints: [payload.redHandPoints, payload.blueHandPoints],
      });
    }
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
    return;
  }

  if (type === EVENT_TRUMP_SELECTED) {
    const payload = message.payload as TrumpSelectedPayload;
    const current = store.gameState;
    if (current) {
      store.setGameState({
        ...current,
        trumpSuit: payload.trumpSuit as GameState["trumpSuit"],
        phase: "playing",
      });
    }
    return;
  }

  if (type === EVENT_DECLARATIONS_RESOLVED || type === EVENT_BELOT_ANNOUNCED) {
    // For complex state transitions, wait for full state snapshot
    // These events are informational — the next event:game_state will have the full picture
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

  // Room lobby updates — consumed by room lobby components directly
  if (type === SYSTEM_PLAYER_JOINED || type === SYSTEM_PLAYER_LEFT ||
      type === SYSTEM_SEAT_UPDATED || type === SYSTEM_GAME_STARTED) {
    return;
  }

  // Chat events
  if (type === SYSTEM_CHAT_MESSAGE) {
    return;
  }
}

function dispatchErrorEvent(message: WsMessage): void {
  const payload = message.payload as { code?: string; message?: string };
  console.warn("WS error:", message.type, payload.message ?? "");
}
