import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { UpdatePreferencesRequest } from "@/shared/api/profile";
import { updatePreferences } from "@/shared/api/profile";
import { queryKeys } from "@/shared/api/queryKeys";

export function useUpdatePreferencesMutation(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: UpdatePreferencesRequest) => updatePreferences(userId, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.detail(userId) });
    },
  });
}
