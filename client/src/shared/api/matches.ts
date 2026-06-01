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

/** Viewer-relative outcome filter; "all" leaves the result set unfiltered. */
export type MatchFilter = "all" | "win" | "loss" | "abandoned";

/** Completed-at ordering: "new" (newest first, default) or "old". */
export type MatchSort = "new" | "old";

export interface MatchListParams {
  outcome?: MatchFilter;
  sort?: MatchSort;
}

export function getUserMatches(
  userId: number,
  limit: number,
  offset: number,
  { outcome = "all", sort = "new" }: MatchListParams = {},
): Promise<MatchesListResponse> {
  return axiosClient.get(`/users/${userId}/matches`, {
    // "all" is the server default, so it is omitted to keep the URL clean.
    params: { limit, offset, outcome: outcome === "all" ? undefined : outcome, sort },
  });
}
