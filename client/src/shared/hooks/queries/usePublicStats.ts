import { useQuery } from "@tanstack/react-query";

import { getPublicStats } from "@/shared/api/lobby";
import { queryKeys } from "@/shared/api/queryKeys";

// Public landing-page counts (online players, open rooms). Polled like the
// lobby stats — the numbers drift on every connect/disconnect and room
// create/join — but at a gentler 30s since the marketing hero is non-critical.
// Always enabled: the endpoint needs no auth, so it works for guests.
const REFETCH_INTERVAL_MS = 30_000;

export function usePublicStatsQuery() {
  return useQuery({
    queryKey: queryKeys.stats.public,
    queryFn: getPublicStats,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
