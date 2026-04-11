import { fetchClient } from "@/shared/api/fetchClient";
import type { CreateRoomRequest, Room } from "@/shared/types/apiTypes";

export function createRoom(req: CreateRoomRequest): Promise<Room> {
  return fetchClient<Room>("/rooms", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
