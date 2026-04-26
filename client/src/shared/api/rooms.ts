import { axiosClient } from "@/shared/api/axiosClient";
import type {
  CreateRoomRequest,
  Room,
  RoomDetail,
  RoomPlayer,
  SelectSeatResponse,
} from "@/shared/types/apiTypes";

export function createRoom(req: CreateRoomRequest): Promise<Room> {
  return axiosClient.post("/rooms", req);
}

export function getRooms(status: string = "waiting"): Promise<Room[]> {
  return axiosClient.get("/rooms", { params: { status } });
}

export function getRoom(id: number): Promise<RoomDetail> {
  return axiosClient.get(`/rooms/${id}`);
}

export function getRoomByCode(code: string): Promise<RoomDetail> {
  return axiosClient.get(`/rooms/code/${encodeURIComponent(code)}`);
}

export function joinRoom(id: number): Promise<Room> {
  return axiosClient.post(`/rooms/${id}/join`);
}

export function leaveRoom(id: number): Promise<void> {
  return axiosClient.post(`/rooms/${id}/leave`);
}

export function selectSeat(roomId: number, seat: number): Promise<SelectSeatResponse> {
  return axiosClient.post(`/rooms/${roomId}/seat`, { seat });
}

export function startGame(roomId: number): Promise<Room> {
  return axiosClient.post(`/rooms/${roomId}/start`);
}

export function quickPlay(signal?: AbortSignal): Promise<Room> {
  return axiosClient.post("/rooms/quick-play", undefined, { signal });
}

export function kickPlayer(roomId: number, userId: number): Promise<{ playerCount: number }> {
  return axiosClient.post(`/rooms/${roomId}/kick`, { userId });
}

export function swapSeats(
  roomId: number,
  seatA: number,
  seatB: number,
): Promise<{ players: RoomPlayer[] }> {
  return axiosClient.post(`/rooms/${roomId}/swap-seats`, { seatA, seatB });
}
