import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

import { DeclarationReveal } from "./DeclarationReveal";

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
    render(<DeclarationReveal payload={mockPayload} myPlayerSeat={0} onComplete={vi.fn()} />);
    expect(screen.getByTestId("declaration-reveal")).toBeInTheDocument();
    const label = screen.getByTestId("declaration-reveal-team");
    expect(label).toHaveAttribute("data-team", "1");
    expect(screen.getByTestId("playing-card-JD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-QD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-KD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-AD")).toBeInTheDocument();
  });

  it("does not render any +total number", () => {
    render(<DeclarationReveal payload={mockPayload} myPlayerSeat={0} onComplete={vi.fn()} />);
    expect(screen.queryByText(/\+50/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+100/)).not.toBeInTheDocument();
  });

  it("does not render when winnerTeam is null", () => {
    const payload: DeclarationsResolvedPayload = {
      winnerTeam: null,
      declarations: [],
    };
    render(<DeclarationReveal payload={payload} myPlayerSeat={0} onComplete={vi.fn()} />);
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
    render(<DeclarationReveal payload={payload} myPlayerSeat={0} onComplete={vi.fn()} />);
    expect(screen.getByTestId("playing-card-QS")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-JC")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-JH")).toBeInTheDocument();
    // JS appears in both declarations — multiple matches expected
    expect(screen.getAllByTestId("playing-card-JS").length).toBeGreaterThanOrEqual(1);
  });

  it("auto-dismisses after 4 seconds", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<DeclarationReveal payload={mockPayload} myPlayerSeat={0} onComplete={onComplete} />);
    vi.advanceTimersByTime(3900);
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
    render(<DeclarationReveal payload={mockPayload} myPlayerSeat={0} onComplete={onComplete} />);
    vi.advanceTimersByTime(1600);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
