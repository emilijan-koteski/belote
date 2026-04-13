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
        "game.score.red": "Red",
        "game.score.blue": "Blue",
      };
      if (key === "game.matchResult.winner" && opts) {
        return `${opts.team} Wins!`;
      }
      return translations[key] ?? key;
    },
  }),
}));

import type { MatchEndPayload } from "@/shared/types/wsEvents";

import { MatchResult } from "./MatchResult";

const matchData: MatchEndPayload = {
  winnerTeam: 0,
  redFinalScore: 1020,
  blueFinalScore: 850,
  matchDurationSec: 725,
};

describe("MatchResult", () => {
  it("renders match result with winner", () => {
    render(<MatchResult data={matchData} onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result")).toBeInTheDocument();
    expect(screen.getByTestId("match-result-title")).toHaveTextContent("Match Complete");
    expect(screen.getByTestId("match-result-winner")).toHaveTextContent("Red Wins!");
  });

  it("renders final scores", () => {
    render(<MatchResult data={matchData} onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result-red-score")).toHaveTextContent("1020");
    expect(screen.getByTestId("match-result-blue-score")).toHaveTextContent("850");
  });

  it("formats match duration correctly", () => {
    render(<MatchResult data={matchData} onReturnToLobby={vi.fn()} />);

    // 725 seconds = 12m 5s
    expect(screen.getByTestId("match-result-duration")).toHaveTextContent("12m 5s");
  });

  it("renders blue team winner correctly", () => {
    const blueWin = { ...matchData, winnerTeam: 1 };
    render(<MatchResult data={blueWin} onReturnToLobby={vi.fn()} />);

    expect(screen.getByTestId("match-result-winner")).toHaveTextContent("Blue Wins!");
  });

  it("calls onReturnToLobby when button is clicked", async () => {
    const onReturn = vi.fn();
    render(<MatchResult data={matchData} onReturnToLobby={onReturn} />);

    await userEvent.click(screen.getByTestId("match-result-lobby-btn"));
    expect(onReturn).toHaveBeenCalledOnce();
  });
});
