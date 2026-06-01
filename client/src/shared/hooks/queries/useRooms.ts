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
    // Room membership/seats are realtime and the default 30s staleTime would
    // otherwise serve a cached snapshot when re-entering a recently-visited
    // room (e.g. Quick Play → Cancel → Quick Play into the same room). The
    // stale snapshot can omit the just-joined viewer, so always refetch on
    // mount and judge membership on fresh data.
    refetchOnMount: "always",
  });
}
