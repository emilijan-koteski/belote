import { axiosClient } from "@/shared/api/axiosClient";

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
  return axiosClient.get(`/users/${userId}/profile`);
}

export function updatePreferences(
  userId: number,
  prefs: UpdatePreferencesRequest,
): Promise<{ languagePreference: string }> {
  return axiosClient.patch(`/users/${userId}/preferences`, prefs);
}
