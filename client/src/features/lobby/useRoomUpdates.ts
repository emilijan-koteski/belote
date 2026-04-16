import { useEffect } from "react";

import { queryClient } from "@/shared/api/queryClient";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Room } from "@/shared/types/apiTypes";
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
      queryClient.setQueryData<Room[]>(queryKeys.rooms.list("waiting"), (old) =>
        old ? [...old, payload] : undefined,
      );
    }

    if (message.type === SYSTEM_ROOM_UPDATED) {
      const payload = message.payload as RoomUpdatedPayload;
      if (payload.status !== "waiting") {
        queryClient.setQueryData<Room[]>(queryKeys.rooms.list("waiting"), (old) =>
          old ? old.filter((r) => r.id !== payload.id) : undefined,
        );
      } else {
        queryClient.setQueryData<Room[]>(queryKeys.rooms.list("waiting"), (old) =>
          old ? old.map((r) => (r.id === payload.id ? payload : r)) : undefined,
        );
      }
    }
  } catch {
    // Ignore non-JSON messages or parse errors
  }
}
