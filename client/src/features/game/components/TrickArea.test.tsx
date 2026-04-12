import "@/shared/i18n/i18n";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrickCard } from "@/shared/types/gameTypes";

import { TrickArea } from "./TrickArea";

beforeEach(() => {
  vi.useFakeTimers();
  // Mock matchMedia for prefers-reduced-motion — default: animations allowed
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

const trickCards: TrickCard[] = [
  { card: { rank: "K", suit: "S" }, playerSeat: 0 },
  { card: { rank: "7", suit: "H" }, playerSeat: 1 },
  { card: { rank: "A", suit: "D" }, playerSeat: 2 },
  { card: { rank: "9", suit: "C" }, playerSeat: 3 },
];

describe("TrickArea", () => {
  it("renders empty state with oval outline when no cards", () => {
    const { container } = render(
      <TrickArea trick={[]} winnerSeat={null} myPlayerSeat={0} />,
    );

    expect(screen.getByTestId("trick-area")).toBeInTheDocument();
    const oval = container.querySelector(".rounded-full.opacity-30");
    expect(oval).toBeInTheDocument();
  });

  it("renders played cards in correct compass positions", () => {
    render(
      <TrickArea trick={trickCards.slice(0, 2)} winnerSeat={null} myPlayerSeat={0} />,
    );

    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-7H")).toBeInTheDocument();
  });

  it("shows accent glow on winning card during resolving state", () => {
    const { rerender } = render(
      <TrickArea trick={trickCards} winnerSeat={null} myPlayerSeat={0} />,
    );

    rerender(
      <TrickArea trick={[]} winnerSeat={2} myPlayerSeat={0} />,
    );

    const trickArea = screen.getByTestId("trick-area");
    const glowElement = trickArea.querySelector('[class*="shadow-[0_0_20px_var(--color-accent)]"]');
    expect(glowElement).toBeInTheDocument();
  });

  it("clears display after resolution and sweep timeout", () => {
    const { rerender } = render(
      <TrickArea trick={trickCards} winnerSeat={null} myPlayerSeat={0} />,
    );

    rerender(
      <TrickArea trick={[]} winnerSeat={2} myPlayerSeat={0} />,
    );

    // Cards still visible during 1s resolve pause
    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();

    // Advance past resolve (1000ms) + sweep (150ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.queryByTestId("playing-card-KS")).not.toBeInTheDocument();
  });

  it("clears immediately when prefers-reduced-motion is enabled", () => {
    // Override matchMedia to prefer reduced motion
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

    const { rerender } = render(
      <TrickArea trick={trickCards} winnerSeat={null} myPlayerSeat={0} />,
    );

    rerender(
      <TrickArea trick={[]} winnerSeat={2} myPlayerSeat={0} />,
    );

    // Should clear immediately — no 1s pause
    expect(screen.queryByTestId("playing-card-KS")).not.toBeInTheDocument();
  });

  it("force-syncs displayTrick when trick resets from non-4 length", () => {
    const { rerender } = render(
      <TrickArea trick={trickCards.slice(0, 2)} winnerSeat={null} myPlayerSeat={0} />,
    );

    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();

    // Simulate reconnect: trick resets to empty from 2 cards
    rerender(
      <TrickArea trick={[]} winnerSeat={null} myPlayerSeat={0} />,
    );

    expect(screen.queryByTestId("playing-card-KS")).not.toBeInTheDocument();
  });
});
