import { useInfiniteQuery } from "@tanstack/react-query";

import type { MatchFilter, MatchSort } from "@/shared/api/matches";
import { getUserMatches } from "@/shared/api/matches";
import { queryKeys } from "@/shared/api/queryKeys";

interface UseUserMatchesOptions {
  outcome?: MatchFilter;
  sort?: MatchSort;
  pageSize?: number;
}

export function useUserMatchesInfiniteQuery(
  userId: number | undefined,
  { outcome = "all", sort = "new", pageSize = 20 }: UseUserMatchesOptions = {},
) {
  return useInfiniteQuery({
    // Filter + sort are part of the key so changing either refetches from
    // page 0 rather than mixing differently-ordered/filtered pages.
    queryKey: [...queryKeys.matches.byUser(userId ?? 0, outcome, sort), pageSize] as const,
    queryFn: ({ pageParam }) =>
      getUserMatches(userId!, pageSize, pageParam as number, { outcome, sort }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length === 0) return undefined;
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: userId !== undefined,
  });
}
