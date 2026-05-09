import { useQuery } from "@tanstack/react-query";

import { getLobbyStats } from "@/shared/api/lobby";
import { queryKeys } from "@/shared/api/queryKeys";

// Polled rather than pushed: the underlying counts shift on every WS connect /
// disconnect, room create/join/leave, and game start/end — wiring a dedicated
// broadcast for each path would be a lot of plumbing for a non-load-bearing
// activity panel. 10s feels live without hammering the API.
const REFETCH_INTERVAL_MS = 10_000;

export function useLobbyStatsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.lobby.stats,
    queryFn: getLobbyStats,
    enabled,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
