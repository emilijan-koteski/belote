import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/shared/api/queryKeys";
import { getRoom, getRooms } from "@/shared/api/rooms";

export function useRoomsQuery(status: string = "waiting", enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.rooms.list(status),
    queryFn: () => getRooms(status),
    enabled,
  });
}

export function useRoomDetailQuery(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.rooms.detail(id!),
    queryFn: () => getRoom(id!),
    enabled: id !== undefined,
  });
}
