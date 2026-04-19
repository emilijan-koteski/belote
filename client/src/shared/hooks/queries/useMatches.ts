import { useInfiniteQuery } from "@tanstack/react-query";

import { getUserMatches } from "@/shared/api/matches";
import { queryKeys } from "@/shared/api/queryKeys";

export function useUserMatchesInfiniteQuery(userId: number | undefined, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.matches.byUser(userId ?? 0), pageSize] as const,
    queryFn: ({ pageParam }) => getUserMatches(userId!, pageSize, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length === 0) return undefined;
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: userId !== undefined,
  });
}
