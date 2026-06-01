import { useQuery } from "@tanstack/react-query";

import { getCareer } from "@/shared/api/career";
import { queryKeys } from "@/shared/api/queryKeys";

export function useCareerQuery(userId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.career.detail(userId!),
    queryFn: () => getCareer(userId!),
    enabled: userId !== undefined,
  });
}
