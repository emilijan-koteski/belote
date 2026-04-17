import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerState } from "@/shared/types/gameTypes";
import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

import { DeclarationReveal } from "./DeclarationReveal";

function testPlayer(seat: number, username: string): PlayerState {
  return {
    seat,
    hand: [],
    userId: seat + 1,
    username,
    team: seat % 2 === 0 ? "red" : "blue",
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
  it("renders panel with winner team label and cards", () => {
    render(
      <DeclarationReveal
        payload={mockPayload}
        myPlayerSeat={0}
        players={mockPlayers}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("declaration-reveal")).toBeInTheDocument();
    const label = screen.getByTestId("declaration-reveal-team");
    expect(label).toHaveAttribute("data-team", "1");
    expect(screen.getByTestId("playing-card-JD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-QD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-KD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-AD")).toBeInTheDocument();
  });

  it("does not render any +total number", () => {
    render(
      <DeclarationReveal
        payload={mockPayload}
        myPlayerSeat={0}
        players={mockPlayers}
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
        myPlayerSeat={0}
        players={mockPlayers}
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
        myPlayerSeat={0}
        players={mockPlayers}
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
        myPlayerSeat={0}
        players={mockPlayers}
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
      <DeclarationReveal payload={payload} myPlayerSeat={0} players={[]} onComplete={vi.fn()} />,
    );
    expect(screen.getByTestId("declaration-reveal-declarer")).toHaveTextContent("#3");
  });

  it("auto-dismisses after 8 seconds", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <DeclarationReveal
        payload={mockPayload}
        myPlayerSeat={0}
        players={mockPlayers}
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
        myPlayerSeat={0}
        players={mockPlayers}
        onComplete={onComplete}
      />,
    );
    vi.advanceTimersByTime(1600);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
