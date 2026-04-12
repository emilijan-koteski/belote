import { useCallback } from "react";

import { handleWsMessage as handleRoomListMessage } from "@/features/lobby/useRoomUpdates";
import type { WsMessage } from "@/shared/types/wsEvents";
import {
  ERROR_AUTH_FAILED,
  SYSTEM_AUTHENTICATED,
  SYSTEM_CHAT_MESSAGE,
  SYSTEM_PLAYER_JOINED,
  SYSTEM_PLAYER_LEFT,
  SYSTEM_ROOM_CREATED,
  SYSTEM_ROOM_UPDATED,
  SYSTEM_SEAT_UPDATED,
  SYSTEM_GAME_STARTED,
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

function dispatchGameEvent(_message: WsMessage): void {
  // Game events will be handled in Story 4.2 when gameStore is expanded.
}

function dispatchSystemEvent(message: WsMessage): void {
  const { type } = message;

  // Room list updates — delegate to existing useRoomUpdates handler
  if (type === SYSTEM_ROOM_CREATED || type === SYSTEM_ROOM_UPDATED) {
    handleRoomListMessage(new MessageEvent("message", { data: JSON.stringify(message) }));
    return;
  }

  // Room lobby updates — these are consumed by room lobby components directly
  if (type === SYSTEM_PLAYER_JOINED || type === SYSTEM_PLAYER_LEFT ||
      type === SYSTEM_SEAT_UPDATED || type === SYSTEM_GAME_STARTED) {
    // useRoomLobbyUpdates.ts handles these via callbacks in the component
    return;
  }

  // Chat events
  if (type === SYSTEM_CHAT_MESSAGE) {
    // Chat store updates will be wired in Epic 6
    return;
  }
}

function dispatchErrorEvent(message: WsMessage): void {
  const payload = message.payload as { code?: string; message?: string };
  console.warn("WS error:", message.type, payload.message ?? "");
}
