import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "game.scoreReveal.title": "Hand Score",
        "game.scoreReveal.cardPoints": "Card Points",
        "game.scoreReveal.declarationPoints": "Declarations",
        "game.scoreReveal.lastTrickBonus": "Last Trick Bonus",
        "game.scoreReveal.capotBonus": "Capot Bonus",
        "game.scoreReveal.failedContract": "Failed Contract",
        "game.scoreReveal.handTotal": "Hand Total",
        "game.scoreReveal.matchTotal": "Match Total",
        "game.scoreReveal.continue": "Continue",
        "team.us": "Us",
        "team.them": "Them",
      };
      if (key === "game.scoreReveal.failedContractDesc" && opts) {
        return `${opts.team} failed — all points to ${opts.otherTeam}`;
      }
      return translations[key] ?? key;
    },
  }),
}));

import type { HandScoredPayload } from "@/shared/types/wsEvents";

import { ScoreReveal } from "./ScoreReveal";

const normalData: HandScoredPayload = {
  teamACardPoints: 70,
  teamBCardPoints: 82,
  teamADeclPoints: 0,
  teamBDeclPoints: 0,
  lastTrickTeam: 1,
  lastTrickBonus: 10,
  capot: false,
  capotTeam: null,
  capotBonus: 0,
  failedContract: false,
  contractingTeam: 1,
  teamAHandTotal: 70,
  teamBHandTotal: 92,
  teamAMatchScore: 70,
  teamBMatchScore: 92,
};

describe("ScoreReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock matchMedia for reduced motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders score breakdown", () => {
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={vi.fn()} />);

    expect(screen.getByTestId("score-reveal")).toBeInTheDocument();
    expect(screen.getByTestId("score-reveal-title")).toHaveTextContent("Hand Score");
    expect(screen.getByTestId("row-card-points")).toBeInTheDocument();
    expect(screen.getByTestId("row-hand-total")).toBeInTheDocument();
    expect(screen.getByTestId("row-match-total")).toBeInTheDocument();
  });

  it("attaches data-team attributes on each numeric column", () => {
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={vi.fn()} />);

    const handTotalRow = screen.getByTestId("row-hand-total");
    const teamAValue = handTotalRow.querySelector("[data-team='teamA']");
    const teamBValue = handTotalRow.querySelector("[data-team='teamB']");
    expect(teamAValue).not.toBeNull();
    expect(teamBValue).not.toBeNull();
  });

  it("shows last trick bonus when applicable", () => {
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-last-trick")).toBeInTheDocument();
    expect(screen.getByTestId("row-last-trick")).toHaveTextContent("+10");
  });

  it("hides declaration row when points are zero", () => {
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={vi.fn()} />);

    expect(screen.queryByTestId("row-decl-points")).not.toBeInTheDocument();
  });

  it("shows declaration row when points are present", () => {
    const withDecls = { ...normalData, teamADeclPoints: 50, teamBDeclPoints: 20 };
    render(<ScoreReveal data={withDecls} viewerTeam="teamA" onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-decl-points")).toBeInTheDocument();
  });

  it("shows capot bonus when capot", () => {
    const capotData = {
      ...normalData,
      capot: true,
      capotTeam: 0,
      capotBonus: 100,
      lastTrickBonus: 0,
    };
    render(<ScoreReveal data={capotData} viewerTeam="teamA" onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-capot-bonus")).toBeInTheDocument();
    expect(screen.getByTestId("row-capot-bonus")).toHaveTextContent("+100");
  });

  it("shows failed-contract message — viewer on contracting team renders 'Us failed'", () => {
    const failedData = { ...normalData, failedContract: true, contractingTeam: 1 };
    // Viewer on teamB → contracting team (index 1) is "Us"
    render(<ScoreReveal data={failedData} viewerTeam="teamB" onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-failed-contract")).toBeInTheDocument();
    expect(screen.getByTestId("row-failed-contract")).toHaveTextContent("Us failed");
  });

  it("shows failed-contract message — viewer NOT on contracting team renders 'Them failed'", () => {
    const failedData = { ...normalData, failedContract: true, contractingTeam: 1 };
    // Viewer on teamA → contracting team (index 1) is "Them"
    render(<ScoreReveal data={failedData} viewerTeam="teamA" onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-failed-contract")).toHaveTextContent("Them failed");
  });

  it("Continue button is disabled initially and enabled after 2 seconds", () => {
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={vi.fn()} />);

    const btn = screen.getByTestId("score-reveal-continue");
    expect(btn).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(btn).toBeEnabled();
  });

  it("calls onContinue when Continue button is clicked", async () => {
    const onContinue = vi.fn();
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={onContinue} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    await userEvent.click(screen.getByTestId("score-reveal-continue"));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("auto-dismisses by calling onContinue after 8000ms", () => {
    const onContinue = vi.fn();
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={onContinue} />);

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(onContinue).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("auto-dismiss timer is NOT reset when onContinue identity changes mid-reveal", () => {
    // Regression guard: if the parent rebuilds its onContinue closure after
    // event:match_end lands, the 8s clock used to restart from zero.
    const onContinueA = vi.fn();
    const onContinueB = vi.fn();
    const { rerender } = render(
      <ScoreReveal data={normalData} viewerTeam="teamA" onContinue={onContinueA} />,
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // Parent re-renders with a fresh callback identity (e.g. matchEndData arrived)
    rerender(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={onContinueB} />);

    act(() => {
      vi.advanceTimersByTime(4001);
    });
    // The latest callback fires once at the original 8000ms mark — NOT 12001ms.
    expect(onContinueB).toHaveBeenCalledOnce();
    expect(onContinueA).not.toHaveBeenCalled();
  });

  it("auto-dismisses after 1500ms when reduced motion is preferred", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const onContinue = vi.fn();
    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={onContinue} />);

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(onContinue).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("enables Continue button after 500ms when reduced motion is preferred", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<ScoreReveal data={normalData} viewerTeam="teamA" onContinue={vi.fn()} />);

    const btn = screen.getByTestId("score-reveal-continue");
    expect(btn).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(btn).toBeEnabled();
  });
});
