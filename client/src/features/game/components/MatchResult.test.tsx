import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "game.matchResult.title": "Match Complete",
        "game.matchResult.duration": "Match Duration",
        "game.matchResult.returnToLobby": "Return to Lobby",
        "team.us": "Us",
        "team.them": "Them",
        "game.surrender.unknownProposer": "your opponent",
      };
      if (key === "game.matchResult.winner" && opts) {
        return `${opts.team} Wins!`;
      }
      if (key === "game.matchResult.surrenderNote" && opts) {
        return `${opts.username} surrendered the match`;
      }
      return translations[key] ?? key;
    },
  }),
}));

import type { MatchEndPayload } from "@/shared/types/wsEvents";

import { MatchResult } from "./MatchResult";

const matchData: MatchEndPayload = {
  winnerTeam: 0,
  teamAFinalScore: 1020,
  teamBFinalScore: 850,
  matchDurationSec: 725,
};

describe("MatchResult", () => {
  it("renders winner banner with 'Us Wins!' when viewer is on the winning team", () => {
    render(<MatchResult data={matchData} viewerTeam="teamA" onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result")).toBeInTheDocument();
    expect(screen.getByTestId("match-result-title")).toHaveTextContent("Match Complete");
    const winner = screen.getByTestId("match-result-winner");
    expect(winner).toHaveTextContent("Us Wins!");
    expect(winner).toHaveAttribute("data-team", "teamA");
  });

  it("renders winner banner with 'Them Wins!' when viewer is NOT on the winning team", () => {
    render(<MatchResult data={matchData} viewerTeam="teamB" onReturnToLobby={vi.fn()} />);

    const winner = screen.getByTestId("match-result-winner");
    expect(winner).toHaveTextContent("Them Wins!");
    expect(winner).toHaveAttribute("data-team", "teamA");
  });

  it("renders final scores and column data-team attributes", () => {
    render(<MatchResult data={matchData} viewerTeam="teamA" onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result-team-a-score")).toHaveTextContent("1020");
    expect(screen.getByTestId("match-result-team-b-score")).toHaveTextContent("850");
    expect(screen.getByTestId("match-result-team-a-column")).toHaveAttribute("data-team", "teamA");
    expect(screen.getByTestId("match-result-team-b-column")).toHaveAttribute("data-team", "teamB");
  });

  it("renders score column labels viewer-relative — viewer on teamA sees Us / Them", () => {
    render(<MatchResult data={matchData} viewerTeam="teamA" onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result-team-a-column")).toHaveTextContent("Us");
    expect(screen.getByTestId("match-result-team-b-column")).toHaveTextContent("Them");
  });

  it("renders score column labels viewer-relative — viewer on teamB sees Them / Us", () => {
    render(<MatchResult data={matchData} viewerTeam="teamB" onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result-team-a-column")).toHaveTextContent("Them");
    expect(screen.getByTestId("match-result-team-b-column")).toHaveTextContent("Us");
  });

  it("formats match duration correctly", () => {
    render(<MatchResult data={matchData} viewerTeam="teamA" onReturnToLobby={vi.fn()} />);

    // 725 seconds = 12m 5s
    expect(screen.getByTestId("match-result-duration")).toHaveTextContent("12m 5s");
  });

  it("renders teamB winner correctly", () => {
    const bWin = { ...matchData, winnerTeam: 1 };
    render(<MatchResult data={bWin} viewerTeam="teamB" onReturnToLobby={vi.fn()} />);

    const winner = screen.getByTestId("match-result-winner");
    expect(winner).toHaveTextContent("Us Wins!");
    expect(winner).toHaveAttribute("data-team", "teamB");
  });

  it("calls onReturnToLobby when button is clicked", async () => {
    const onReturn = vi.fn();
    render(<MatchResult data={matchData} viewerTeam="teamA" onReturnToLobby={onReturn} />);

    await userEvent.click(screen.getByTestId("match-result-lobby-btn"));
    expect(onReturn).toHaveBeenCalledOnce();
  });

  it("does NOT render surrender note for natural match-end", () => {
    render(<MatchResult data={matchData} viewerTeam="teamA" onReturnToLobby={vi.fn()} />);
    expect(screen.queryByTestId("match-result-surrender-note")).toBeNull();
  });

  it("renders surrender note when outcomeReason is 'surrender'", () => {
    const surrenderData: MatchEndPayload = {
      ...matchData,
      outcomeReason: "surrender",
      surrenderedBySeat: 1,
    };
    render(
      <MatchResult
        data={surrenderData}
        viewerTeam="teamA"
        onReturnToLobby={vi.fn()}
        surrenderedByUsername="alice"
      />,
    );
    const note = screen.getByTestId("match-result-surrender-note");
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent("alice surrendered the match");
  });

  it("falls back to unknownProposer when surrender username is missing", () => {
    const surrenderData: MatchEndPayload = {
      ...matchData,
      outcomeReason: "surrender",
      surrenderedBySeat: 1,
    };
    render(<MatchResult data={surrenderData} viewerTeam="teamA" onReturnToLobby={vi.fn()} />);
    const note = screen.getByTestId("match-result-surrender-note");
    expect(note).toHaveTextContent(/your opponent/);
  });
});
