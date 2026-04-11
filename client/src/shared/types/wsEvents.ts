// WebSocket event contract — keep in sync with server/internal/ws/events.go

// Event type prefixes
// action: — client -> server
// event:  — server -> client (game state)
// error:  — server -> client (errors)
// system: — server -> client (platform events)

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

// Room events
export const SYSTEM_ROOM_CREATED = "system:room_created" as const;
export const SYSTEM_ROOM_UPDATED = "system:room_updated" as const;

export interface RoomCreatedPayload {
  id: number;
  name: string;
  code: string;
  ownerId: number;
  variant: string;
  matchMode: string;
  timerStyle: string;
  timerDurationSeconds: number | null;
  status: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomUpdatedPayload {
  id: number;
  name: string;
  code: string;
  ownerId: number;
  variant: string;
  matchMode: string;
  timerStyle: string;
  timerDurationSeconds: number | null;
  status: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
}

// Room player events
export const SYSTEM_PLAYER_JOINED = "system:player_joined" as const;
export const SYSTEM_PLAYER_LEFT = "system:player_left" as const;

export interface PlayerJoinedPayload {
  roomId: number;
  userId: number;
  username: string;
  playerCount: number;
}

export interface PlayerLeftPayload {
  roomId: number;
  userId: number;
  username: string;
  playerCount: number;
  newOwnerId?: number;
}

// Seat and game events
export const SYSTEM_SEAT_UPDATED = "system:seat_updated" as const;
export const SYSTEM_GAME_STARTED = "system:game_started" as const;

export interface SeatUpdatedPayload {
  roomId: number;
  userId: number;
  username: string;
  seat: number;
  team: string;
  previousSeat: number | null;
}

export interface GameStartedPayload {
  roomId: number;
}
