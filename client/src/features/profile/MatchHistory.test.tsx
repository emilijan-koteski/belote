import "@/shared/i18n/i18n";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchesListResponse, MatchHandView, MatchListItem } from "@/shared/api/matches";
import { QueryWrapper } from "@/test-utils";

import { MatchHistory } from "./MatchHistory";

const mockGetUserMatches = vi.fn();
vi.mock("@/shared/api/matches", () => ({
  getUserMatches: (...args: unknown[]) => mockGetUserMatches(...args),
}));

function renderMatchHistory(userId: number | undefined = 1) {
  return render(
    <QueryWrapper>
      <BrowserRouter>
        <MatchHistory userId={userId} />
      </BrowserRouter>
    </QueryWrapper>,
  );
}

function makeHand(overrides: Partial<MatchHandView> = {}): MatchHandView {
  return {
    handNumber: 1,
    redCardPoints: 60,
    blueCardPoints: 102,
    redDeclPoints: 20,
    blueDeclPoints: 0,
    lastTrickTeam: 1,
    lastTrickBonus: 10,
    capot: false,
    capotTeam: undefined,
    capotBonus: 0,
    failedContract: false,
    contractingTeam: 0,
    redHandTotal: 80,
    blueHandTotal: 112,
    ...overrides,
  };
}

function makeMatch(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: 1,
    variant: "bitola",
    matchMode: "1001",
    startedAt: "2026-04-10T12:00:00Z",
    completedAt: "2026-04-10T12:25:00Z",
    status: "completed",
    winnerTeam: 0,
    teamRedScore: 1010,
    teamBlueScore: 640,
    abandonedBy: undefined,
    viewerSeat: 0,
    outcome: "win",
    players: [
      { seat: 0, userId: 10, username: "viewer" },
      { seat: 1, userId: 11, username: "opp1" },
      { seat: 2, userId: 12, username: "mate" },
      { seat: 3, userId: 13, username: "opp2" },
    ],
    hands: [
      makeHand({ handNumber: 1 }),
      makeHand({ handNumber: 2, capot: true, capotTeam: 0, capotBonus: 100 }),
    ],
    ...overrides,
  };
}

function makeResponse(
  items: MatchListItem[],
  total: number,
  offset = 0,
  limit = 20,
): MatchesListResponse {
  return { items, total, offset, limit };
}

describe("MatchHistory", () => {
  beforeEach(() => {
    mockGetUserMatches.mockReset();
  });

  it("renders loading skeleton on first mount", () => {
    mockGetUserMatches.mockReturnValue(new Promise(() => {}));
    renderMatchHistory();
    expect(screen.getByTestId("match-history-loading")).toBeInTheDocument();
  });

  it("renders empty state with lobby link when total is 0", async () => {
    mockGetUserMatches.mockResolvedValueOnce(makeResponse([], 0));
    renderMatchHistory();
    const empty = await screen.findByTestId("match-history-empty");
    expect(empty).toBeInTheDocument();
    const cta = screen.getByTestId("match-history-empty-cta");
    expect(cta).toHaveAttribute("href", "/lobby");
  });

  it("renders rows with teammate, opponents, outcome and score", async () => {
    mockGetUserMatches.mockResolvedValueOnce(makeResponse([makeMatch()], 1));
    renderMatchHistory();
    const row = await screen.findByTestId("match-history-row");
    expect(within(row).getByText("mate")).toBeInTheDocument();
    expect(within(row).getByText(/opp1/)).toBeInTheDocument();
    expect(within(row).getByText(/opp2/)).toBeInTheDocument();
    expect(within(row).getByText("1010")).toBeInTheDocument();
    expect(within(row).getByText("640")).toBeInTheDocument();
    expect(within(row).getByTestId("match-history-outcome")).toHaveAttribute("data-outcome", "win");
  });

  it("shows all three outcome variants", async () => {
    const matches = [
      makeMatch({ id: 1, outcome: "win" }),
      makeMatch({ id: 2, outcome: "loss" }),
      makeMatch({ id: 3, outcome: "abandoned" }),
    ];
    mockGetUserMatches.mockResolvedValueOnce(makeResponse(matches, 3));
    renderMatchHistory();
    await waitFor(() => {
      expect(screen.getAllByTestId("match-history-row")).toHaveLength(3);
    });
    const outcomes = screen.getAllByTestId("match-history-outcome");
    expect(outcomes.map((el) => el.getAttribute("data-outcome"))).toEqual([
      "win",
      "loss",
      "abandoned",
    ]);
  });

  it("toggles detail view on row click with correct aria state", async () => {
    mockGetUserMatches.mockResolvedValueOnce(makeResponse([makeMatch()], 1));
    renderMatchHistory();
    const row = await screen.findByTestId("match-history-row");
    const toggle = within(row).getByRole("button");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("match-history-detail")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const detail = screen.getByTestId("match-history-detail");
    expect(detail).toBeInTheDocument();
    expect(within(detail).getAllByTestId("match-history-hand-row")).toHaveLength(2);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("match-history-detail")).not.toBeInTheDocument();
  });

  it("renders Capot badge on hand 2 and failed-contract pill when present", async () => {
    const match = makeMatch({
      hands: [
        makeHand({
          handNumber: 1,
          failedContract: true,
          contractingTeam: 0,
          redCardPoints: 0,
          redHandTotal: 0,
          blueCardPoints: 162,
          blueHandTotal: 182,
        }),
        makeHand({
          handNumber: 2,
          capot: true,
          capotTeam: 1,
          capotBonus: 100,
          blueCardPoints: 162,
          blueHandTotal: 312,
          redCardPoints: 0,
          redHandTotal: 0,
        }),
      ],
    });
    mockGetUserMatches.mockResolvedValueOnce(makeResponse([match], 1));
    renderMatchHistory();
    const row = await screen.findByTestId("match-history-row");
    fireEvent.click(within(row).getByRole("button"));

    expect(screen.getByTestId("match-history-hand-capot")).toBeInTheDocument();
    expect(screen.getByTestId("match-history-hand-failed")).toBeInTheDocument();
    expect(screen.getByTestId("match-history-hand-failed-team")).toHaveTextContent("Red");
  });

  it("shows Load more when total > loaded and appends rows on click", async () => {
    const firstPage = makeResponse([makeMatch({ id: 1 })], 2, 0, 20);
    const secondPage = makeResponse([makeMatch({ id: 2 })], 2, 1, 20);

    mockGetUserMatches.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    renderMatchHistory();

    await waitFor(() => {
      expect(screen.getAllByTestId("match-history-row")).toHaveLength(1);
    });

    const loadMore = await screen.findByTestId("match-history-load-more");
    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(screen.getAllByTestId("match-history-row")).toHaveLength(2);
    });

    expect(screen.queryByTestId("match-history-load-more")).not.toBeInTheDocument();
  });

  it("hides Load more when all rows are loaded", async () => {
    mockGetUserMatches.mockResolvedValueOnce(makeResponse([makeMatch()], 1));
    renderMatchHistory();
    await screen.findByTestId("match-history-row");
    expect(screen.queryByTestId("match-history-load-more")).not.toBeInTheDocument();
  });

  it("shows Load more button when there are more matches to fetch", async () => {
    mockGetUserMatches.mockResolvedValueOnce(
      makeResponse([makeMatch({ id: 1 }), makeMatch({ id: 2 })], 10, 0, 20),
    );
    renderMatchHistory();
    await screen.findAllByTestId("match-history-row");
    expect(screen.getByTestId("match-history-load-more")).toBeInTheDocument();
  });

  it("does not fetch when userId is undefined", () => {
    render(
      <QueryWrapper>
        <BrowserRouter>
          <MatchHistory userId={undefined} />
        </BrowserRouter>
      </QueryWrapper>,
    );
    expect(mockGetUserMatches).not.toHaveBeenCalled();
  });
});
