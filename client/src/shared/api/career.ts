import { axiosClient } from "@/shared/api/axiosClient";

export type StreakKind = "win" | "loss" | "none";

export interface CareerStreak {
  kind: StreakKind;
  length: number;
}

export interface BestHand {
  points: number;
  handNumber: number;
  completedAt: string;
}

export interface PartnerStat {
  userId: number;
  username: string;
  played: number;
  wins: number;
}

export interface RivalStat {
  userId: number;
  username: string;
  wins: number;
  losses: number;
}

/**
 * Derived career stats powering the profile hero (capots), streak callout,
 * milestones, partner spotlight, and rivalries. Returned by
 * GET /users/:id/career. `bestHand` is absent for users with no scored hands.
 */
export interface CareerResponse {
  capots: number;
  avgMatchSeconds: number;
  streak: CareerStreak;
  bestHand?: BestHand;
  /** Completed-at of the most recent match, absent if none played. */
  lastPlayedAt?: string;
  topPartners: PartnerStat[];
  topRivals: RivalStat[];
}

export function getCareer(userId: number): Promise<CareerResponse> {
  return axiosClient.get(`/users/${userId}/career`);
}
