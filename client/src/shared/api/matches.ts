import { axiosClient } from "@/shared/api/axiosClient";

export type MatchOutcome = "win" | "loss" | "abandoned";

export interface MatchPlayer {
  seat: number;
  userId: number;
  username: string;
}

export interface MatchHandView {
  handNumber: number;
  teamACardPoints: number;
  teamBCardPoints: number;
  teamADeclPoints: number;
  teamBDeclPoints: number;
  lastTrickTeam: number;
  lastTrickBonus: number;
  capot: boolean;
  capotTeam?: number;
  capotBonus: number;
  failedContract: boolean;
  contractingTeam: number;
  teamAHandTotal: number;
  teamBHandTotal: number;
}

export interface MatchListItem {
  id: number;
  variant: string;
  matchMode: string;
  startedAt: string;
  completedAt: string;
  status: string;
  winnerTeam: number;
  teamAScore: number;
  teamBScore: number;
  abandonedBy?: number;
  viewerSeat: number;
  outcome: MatchOutcome;
  players: MatchPlayer[];
  hands: MatchHandView[];
}

export interface MatchesListResponse {
  items: MatchListItem[];
  total: number;
  limit: number;
  offset: number;
}

export function getUserMatches(
  userId: number,
  limit: number,
  offset: number,
): Promise<MatchesListResponse> {
  return axiosClient.get(`/users/${userId}/matches`, {
    params: { limit, offset },
  });
}
