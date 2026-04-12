import { fetchClient } from "@/shared/api/fetchClient";
import type {
  CreateRoomRequest,
  Room,
  RoomDetail,
  SelectSeatResponse,
} from "@/shared/types/apiTypes";

export function createRoom(req: CreateRoomRequest): Promise<Room> {
  return fetchClient<Room>("/rooms", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function getRooms(status: string = "waiting"): Promise<Room[]> {
  return fetchClient<Room[]>(`/rooms?status=${encodeURIComponent(status)}`);
}

export function getRoom(id: number): Promise<RoomDetail> {
  return fetchClient<RoomDetail>(`/rooms/${id}`);
}

export function getRoomByCode(code: string): Promise<RoomDetail> {
  return fetchClient<RoomDetail>(`/rooms/code/${encodeURIComponent(code)}`);
}

export function joinRoom(id: number): Promise<Room> {
  return fetchClient<Room>(`/rooms/${id}/join`, { method: "POST" });
}

export function leaveRoom(id: number): Promise<void> {
  return fetchClient<void>(`/rooms/${id}/leave`, { method: "POST" });
}

export function selectSeat(roomId: number, seat: number): Promise<SelectSeatResponse> {
  return fetchClient<SelectSeatResponse>(`/rooms/${roomId}/seat`, {
    method: "POST",
    body: JSON.stringify({ seat }),
  });
}

export function startGame(roomId: number): Promise<Room> {
  return fetchClient<Room>(`/rooms/${roomId}/start`, { method: "POST" });
}

export function quickPlay(signal?: AbortSignal): Promise<Room> {
  return fetchClient<Room>("/rooms/quick-play", {
    method: "POST",
    signal,
  });
}
