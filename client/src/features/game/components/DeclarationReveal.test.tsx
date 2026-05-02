import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AC10 / D120: mock react-i18next so visible-text assertions can verify the
// viewer-relative "Us declared" / "Them declared" copy. Mirrors the pattern
// used by MatchResult.test.tsx.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "team.us": "Us",
        "team.them": "Them",
      };
      if (key === "game.declaration.teamDeclared" && opts) return `${opts.team} declared`;
      if (key === "game.declaration.sequenceShort" && opts) return `${opts.count} in a row`;
      if (key === "game.declaration.fourOfAKindShort" && opts) return `four of a kind`;
      return translations[key] ?? key;
    },
  }),
}));

import type { PlayerState } from "@/shared/types/gameTypes";
import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

import { DeclarationReveal } from "./DeclarationReveal";

function testPlayer(seat: number, username: string): PlayerState {
  return {
    seat,
    hand: [],
    userId: seat + 1,
    username,
    team: seat % 2 === 0 ? "teamA" : "teamB",
    declarations: [],
    connected: true,
  };
}

const mockPlayers: PlayerState[] = [
  testPlayer(0, "alice"),
  testPlayer(1, "bob"),
  testPlayer(2, "carol"),
  testPlayer(3, "dave"),
];

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

const mockPayload: DeclarationsResolvedPayload = {
  winnerTeam: 1,
  declarations: [{ playerSeat: 1, type: "sequence", value: 50, cards: ["JD", "QD", "KD", "AD"] }],
};

describe("DeclarationReveal", () => {
  it("renders panel with winner team data-team and cards", () => {
    render(
      <DeclarationReveal
        payload={mockPayload}
        players={mockPlayers}
        viewerTeam="teamB"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("declaration-reveal")).toBeInTheDocument();
    const label = screen.getByTestId("declaration-reveal-team");
    expect(label).toHaveAttribute("data-team", "teamB");
    expect(screen.getByTestId("playing-card-JD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-QD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-KD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-AD")).toBeInTheDocument();
  });

  it("renders 'Us declared' when viewer's partner declares", () => {
    // viewer is teamB (seat 1 or 3); declarer is seat 1 (teamB) → both partners see Us
    render(
      <DeclarationReveal
        payload={mockPayload}
        players={mockPlayers}
        viewerTeam="teamB"
        onComplete={vi.fn()}
      />,
    );
    const label = screen.getByTestId("declaration-reveal-team");
    expect(label).toHaveAttribute("data-team", "teamB");
    expect(label).toHaveTextContent("Us declared");
  });

  it("renders 'Them declared' when viewer is teamA and opponents declare", () => {
    // viewer is teamA; declarer is on teamB → they see Them
    render(
      <DeclarationReveal
        payload={mockPayload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    const label = screen.getByTestId("declaration-reveal-team");
    // The winner team is still teamB — data-team reflects the winner team
    // (used for styling), not the viewer-relative label.
    expect(label).toHaveAttribute("data-team", "teamB");
    expect(label).toHaveTextContent("Them declared");
  });

  it("centers the panel regardless of winning declarer's seat", () => {
    const eastWinner: DeclarationsResolvedPayload = {
      winnerTeam: 1,
      declarations: [
        { playerSeat: 1, type: "sequence", value: 50, cards: ["JD", "QD", "KD", "AD"] },
      ],
    };
    const northWinner: DeclarationsResolvedPayload = {
      winnerTeam: 0,
      declarations: [
        { playerSeat: 2, type: "sequence", value: 50, cards: ["JD", "QD", "KD", "AD"] },
      ],
    };
    const expectedCenterClasses = ["top-1/2", "left-1/2", "-translate-x-1/2", "-translate-y-1/2"];

    const { rerender } = render(
      <DeclarationReveal
        payload={eastWinner}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    let panel = screen.getByTestId("declaration-reveal");
    for (const cls of expectedCenterClasses) {
      expect(panel.className).toContain(cls);
    }

    rerender(
      <DeclarationReveal
        payload={northWinner}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    panel = screen.getByTestId("declaration-reveal");
    for (const cls of expectedCenterClasses) {
      expect(panel.className).toContain(cls);
    }
  });

  it("does not render any +total number", () => {
    render(
      <DeclarationReveal
        payload={mockPayload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/\+50/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+100/)).not.toBeInTheDocument();
  });

  it("does not render when winnerTeam is null", () => {
    const payload: DeclarationsResolvedPayload = {
      winnerTeam: null,
      declarations: [],
    };
    render(
      <DeclarationReveal
        payload={payload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("declaration-reveal")).not.toBeInTheDocument();
  });

  it("stacks multiple declarations from the winning team", () => {
    const payload: DeclarationsResolvedPayload = {
      winnerTeam: 0,
      declarations: [
        { playerSeat: 0, type: "sequence", value: 50, cards: ["JS", "QS", "KS", "AS"] },
        { playerSeat: 0, type: "four_of_a_kind", value: 200, cards: ["JC", "JH", "JD", "JS"] },
      ],
    };
    render(
      <DeclarationReveal
        payload={payload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("playing-card-QS")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-JC")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-JH")).toBeInTheDocument();
    // JS appears in both declarations — multiple matches expected
    expect(screen.getAllByTestId("playing-card-JS").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the declarer's username for each declaration row", () => {
    const payload: DeclarationsResolvedPayload = {
      winnerTeam: 0,
      declarations: [
        { playerSeat: 0, type: "sequence", value: 50, cards: ["JS", "QS", "KS", "AS"] },
        { playerSeat: 2, type: "four_of_a_kind", value: 200, cards: ["JC", "JH", "JD", "JS"] },
      ],
    };
    render(
      <DeclarationReveal
        payload={payload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={vi.fn()}
      />,
    );
    const declarers = screen.getAllByTestId("declaration-reveal-declarer");
    expect(declarers).toHaveLength(2);
    expect(declarers[0]).toHaveAttribute("data-seat", "0");
    expect(declarers[0]).toHaveTextContent("alice");
    expect(declarers[1]).toHaveAttribute("data-seat", "2");
    expect(declarers[1]).toHaveTextContent("carol");
  });

  it("falls back to seat marker when player is unknown", () => {
    const payload: DeclarationsResolvedPayload = {
      winnerTeam: 1,
      declarations: [{ playerSeat: 3, type: "sequence", value: 50, cards: ["JD", "QD", "KD"] }],
    };
    render(
      <DeclarationReveal payload={payload} players={[]} viewerTeam="teamA" onComplete={vi.fn()} />,
    );
    expect(screen.getByTestId("declaration-reveal-declarer")).toHaveTextContent("#3");
  });

  it("auto-dismisses after 8 seconds", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <DeclarationReveal
        payload={mockPayload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={onComplete}
      />,
    );
    vi.advanceTimersByTime(7900);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("auto-dismisses faster with prefers-reduced-motion", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <DeclarationReveal
        payload={mockPayload}
        players={mockPlayers}
        viewerTeam="teamA"
        onComplete={onComplete}
      />,
    );
    vi.advanceTimersByTime(1600);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
