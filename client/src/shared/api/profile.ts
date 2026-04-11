import { fetchClient } from "@/shared/api/fetchClient";

export interface ProfileResponse {
  id: number;
  username: string;
  languagePreference: string;
  createdAt: string;
}

export interface UpdatePreferencesRequest {
  languagePreference: string;
}

export function getProfile(userId: number): Promise<ProfileResponse> {
  return fetchClient<ProfileResponse>(`/users/${userId}/profile`);
}

export function updatePreferences(
  userId: number,
  prefs: UpdatePreferencesRequest,
): Promise<{ languagePreference: string }> {
  return fetchClient<{ languagePreference: string }>(`/users/${userId}/preferences`, {
    method: "PATCH",
    body: JSON.stringify(prefs),
  });
}
