// WebSocket listener for room lobby events (player join/leave).
// WS hub is not yet wired end-to-end — this hook establishes the event
// handler contract so it can be connected when WebSocket infrastructure
// lands in a future story.

import type { Room, RoomPlayer } from "@/shared/types/apiTypes";
import type {
  PlayerJoinedPayload,
  PlayerLeftPayload,
  RoomUpdatedPayload,
  WsMessage,
} from "@/shared/types/wsEvents";
import {
  SYSTEM_PLAYER_JOINED,
  SYSTEM_PLAYER_LEFT,
  SYSTEM_ROOM_UPDATED,
} from "@/shared/types/wsEvents";

interface RoomLobbyCallbacks {
  onPlayerJoined: (player: RoomPlayer, playerCount: number) => void;
  onPlayerLeft: (userId: number, playerCount: number, newOwnerId?: number) => void;
  onRoomUpdated: (room: Room) => void;
}

/**
 * Processes a raw WebSocket message for room lobby events.
 * Export this for future integration with the WebSocket dispatch system.
 */
export function handleWsMessage(
  event: MessageEvent,
  callbacks: RoomLobbyCallbacks,
): void {
  let message: WsMessage;
  try {
    message = JSON.parse(event.data as string) as WsMessage;
  } catch {
    return;
  }

  switch (message.type) {
    case SYSTEM_PLAYER_JOINED: {
      const payload = message.payload as PlayerJoinedPayload;
      const newPlayer: RoomPlayer = {
        id: 0,
        roomId: payload.roomId,
        userId: payload.userId,
        username: payload.username,
        seat: null,
        team: null,
        createdAt: new Date().toISOString(),
      };
      callbacks.onPlayerJoined(newPlayer, payload.playerCount);
      break;
    }
    case SYSTEM_PLAYER_LEFT: {
      const payload = message.payload as PlayerLeftPayload;
      callbacks.onPlayerLeft(payload.userId, payload.playerCount, payload.newOwnerId);
      break;
    }
    case SYSTEM_ROOM_UPDATED: {
      const payload = message.payload as RoomUpdatedPayload;
      callbacks.onRoomUpdated(payload as unknown as Room);
      break;
    }
  }
}
