import { useEffect } from "react";

import { useLobbyStore } from "@/shared/stores/lobbyStore";
import type { RoomCreatedPayload, RoomUpdatedPayload, WsMessage } from "@/shared/types/wsEvents";
import { SYSTEM_ROOM_CREATED, SYSTEM_ROOM_UPDATED } from "@/shared/types/wsEvents";

// NOTE: This hook establishes the WebSocket event handler contract for room updates.
// The WS hub is not yet wired end-to-end — these handlers will not receive events
// until WebSocket infrastructure is connected in a future story.
// The event type constants and handler logic are correct and ready for integration.

export function useRoomUpdates() {
  useEffect(() => {
    // TODO: Replace with actual WebSocket instance from WS infrastructure (future story).
    // When the WS hub is available, subscribe to the WebSocket connection here
    // and attach handleWsMessage as the message handler.
    // Example:
    //   ws.addEventListener("message", handleWsMessage);
    //   return () => ws.removeEventListener("message", handleWsMessage);
    return undefined;
  }, []);
}

// Exported for future WS integration and testing — will be wired as the
// WebSocket "message" event handler once WS infrastructure is connected.
export function handleWsMessage(event: MessageEvent) {
  try {
    const message = JSON.parse(String(event.data)) as WsMessage;

    if (message.type === SYSTEM_ROOM_CREATED) {
      const payload = message.payload as RoomCreatedPayload;
      useLobbyStore.getState().addRoom(payload);
    }

    if (message.type === SYSTEM_ROOM_UPDATED) {
      const payload = message.payload as RoomUpdatedPayload;
      if (payload.status !== "waiting") {
        useLobbyStore.getState().removeRoom(payload.id);
      } else {
        useLobbyStore.getState().updateRoom(payload);
      }
    }
  } catch {
    // Ignore non-JSON messages or parse errors
  }
}
