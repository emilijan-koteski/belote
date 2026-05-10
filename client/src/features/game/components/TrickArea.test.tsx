import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TrickCard } from "@/shared/types/gameTypes";

import { TrickArea } from "./TrickArea";

const trickCards: TrickCard[] = [
  { card: { rank: "K", suit: "S" }, playerSeat: 0 },
  { card: { rank: "7", suit: "H" }, playerSeat: 1 },
  { card: { rank: "A", suit: "D" }, playerSeat: 2 },
  { card: { rank: "9", suit: "C" }, playerSeat: 3 },
];

describe("TrickArea", () => {
  it("renders empty state with placeholders only", () => {
    render(<TrickArea trick={[]} winnerSeat={null} myPlayerSeat={0} />);

    expect(screen.getByTestId("trick-area")).toBeInTheDocument();
    // All four compass placeholders present, no cards.
    expect(screen.getByTestId("trick-slot-0")).toBeInTheDocument();
    expect(screen.getByTestId("trick-slot-1")).toBeInTheDocument();
    expect(screen.getByTestId("trick-slot-2")).toBeInTheDocument();
    expect(screen.getByTestId("trick-slot-3")).toBeInTheDocument();
    expect(screen.queryByTestId("playing-card-KS")).not.toBeInTheDocument();
  });

  it("renders played cards in correct compass positions", () => {
    render(<TrickArea trick={trickCards.slice(0, 2)} winnerSeat={null} myPlayerSeat={0} />);

    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-7H")).toBeInTheDocument();
  });

  it("clears cards immediately when trick prop becomes empty (overlay owns motion)", () => {
    const { rerender } = render(
      <TrickArea trick={trickCards.slice(0, 2)} winnerSeat={null} myPlayerSeat={0} />,
    );

    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();

    rerender(<TrickArea trick={[]} winnerSeat={null} myPlayerSeat={0} />);

    expect(screen.queryByTestId("playing-card-KS")).not.toBeInTheDocument();
  });

  it("shows snapshot cards with winner glow when pendingResolvedTrick is set", () => {
    // Simulates the post-resolve frame: server has cleared currentTrick to []
    // but the dispatcher captured the four cards into pendingResolvedTrick so
    // the collect animation can run.
    render(
      <TrickArea
        trick={[]}
        winnerSeat={null}
        myPlayerSeat={0}
        pendingResolvedTrick={{ trick: trickCards, winnerSeat: 2 }}
      />,
    );

    // All four cards rendered from the snapshot.
    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-7H")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-AD")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-9C")).toBeInTheDocument();

    // Winner glow on the partner's compass (seat 2 from viewer seat 0 → north).
    const trickArea = screen.getByTestId("trick-area");
    const glowEl = trickArea.querySelector('[class*="shadow-[0_0_20px_var(--color-accent)]"]');
    expect(glowEl).toBeInTheDocument();
  });

  it("filters out cards present in suppressedCardIds (overlay paints them)", () => {
    render(
      <TrickArea
        trick={trickCards}
        winnerSeat={null}
        myPlayerSeat={0}
        suppressedCardIds={new Set(["KS", "AD"])}
      />,
    );

    // Suppressed cards: hidden so the overlay can paint the flight.
    expect(screen.queryByTestId("playing-card-KS")).not.toBeInTheDocument();
    expect(screen.queryByTestId("playing-card-AD")).not.toBeInTheDocument();
    // Non-suppressed cards still render at their slots.
    expect(screen.getByTestId("playing-card-7H")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-9C")).toBeInTheDocument();
  });

  it("pendingResolvedTrick takes priority over the live trick prop", () => {
    // The dispatcher snapshot must keep showing the just-resolved trick even
    // if a fresh snapshot has already updated currentTrick (e.g., the next
    // hand's first card landed before the collect flight finished).
    render(
      <TrickArea
        trick={[{ card: { rank: "T", suit: "S" }, playerSeat: 1 }]}
        winnerSeat={null}
        myPlayerSeat={0}
        pendingResolvedTrick={{ trick: trickCards, winnerSeat: 0 }}
      />,
    );

    // Snapshot wins: KS is from the resolved trick.
    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();
    // Live trick's TS is hidden until the snapshot clears.
    expect(screen.queryByTestId("playing-card-TS")).not.toBeInTheDocument();
  });
});
