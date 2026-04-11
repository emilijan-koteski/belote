// API response types — keep in sync with server models

export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface User {
  id: number;
  username: string;
  email: string;
  languagePreference: string;
  createdAt: string;
}

export interface Room {
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
  isQuickPlay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomRequest {
  name: string;
  variant: string;
  matchMode: string;
  timerStyle: string;
  timerDurationSeconds: number | null;
}

export interface RoomPlayer {
  id: number;
  roomId: number;
  userId: number;
  username: string;
  seat: number | null;
  team: string | null;
  createdAt: string;
}

export interface RoomDetail {
  room: Room;
  players: RoomPlayer[];
}

export interface SelectSeatResponse {
  players: RoomPlayer[];
  gameStarted: boolean;
}
