import { useQuery } from "@tanstack/react-query";

import { getProfile } from "@/shared/api/profile";
import { queryKeys } from "@/shared/api/queryKeys";

export function useProfileQuery(userId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.profile.detail(userId!),
    queryFn: () => getProfile(userId!),
    enabled: userId !== undefined,
  });
}
