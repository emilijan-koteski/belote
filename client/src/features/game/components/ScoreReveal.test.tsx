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
        "game.score.red": "Red",
        "game.score.blue": "Blue",
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
  redCardPoints: 70,
  blueCardPoints: 82,
  redDeclPoints: 0,
  blueDeclPoints: 0,
  lastTrickTeam: 1,
  lastTrickBonus: 10,
  capot: false,
  capotTeam: null,
  capotBonus: 0,
  failedContract: false,
  contractingTeam: 1,
  redHandTotal: 70,
  blueHandTotal: 92,
  redMatchScore: 70,
  blueMatchScore: 92,
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
    render(<ScoreReveal data={normalData} onContinue={vi.fn()} />);

    expect(screen.getByTestId("score-reveal")).toBeInTheDocument();
    expect(screen.getByTestId("score-reveal-title")).toHaveTextContent("Hand Score");
    expect(screen.getByTestId("row-card-points")).toBeInTheDocument();
    expect(screen.getByTestId("row-hand-total")).toBeInTheDocument();
    expect(screen.getByTestId("row-match-total")).toBeInTheDocument();
  });

  it("shows last trick bonus when applicable", () => {
    render(<ScoreReveal data={normalData} onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-last-trick")).toBeInTheDocument();
    expect(screen.getByTestId("row-last-trick")).toHaveTextContent("+10");
  });

  it("hides declaration row when points are zero", () => {
    render(<ScoreReveal data={normalData} onContinue={vi.fn()} />);

    expect(screen.queryByTestId("row-decl-points")).not.toBeInTheDocument();
  });

  it("shows declaration row when points are present", () => {
    const withDecls = { ...normalData, redDeclPoints: 50, blueDeclPoints: 20 };
    render(<ScoreReveal data={withDecls} onContinue={vi.fn()} />);

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
    render(<ScoreReveal data={capotData} onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-capot-bonus")).toBeInTheDocument();
    expect(screen.getByTestId("row-capot-bonus")).toHaveTextContent("+100");
  });

  it("shows failed contract message", () => {
    const failedData = { ...normalData, failedContract: true, contractingTeam: 1 };
    render(<ScoreReveal data={failedData} onContinue={vi.fn()} />);

    expect(screen.getByTestId("row-failed-contract")).toBeInTheDocument();
    expect(screen.getByTestId("row-failed-contract")).toHaveTextContent("Blue failed");
  });

  it("Continue button is disabled initially and enabled after 2 seconds", () => {
    render(<ScoreReveal data={normalData} onContinue={vi.fn()} />);

    const btn = screen.getByTestId("score-reveal-continue");
    expect(btn).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(btn).toBeEnabled();
  });

  it("calls onContinue when Continue button is clicked", async () => {
    const onContinue = vi.fn();
    render(<ScoreReveal data={normalData} onContinue={onContinue} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    await userEvent.click(screen.getByTestId("score-reveal-continue"));
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

    render(<ScoreReveal data={normalData} onContinue={vi.fn()} />);

    const btn = screen.getByTestId("score-reveal-continue");
    expect(btn).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(btn).toBeEnabled();
  });
});
