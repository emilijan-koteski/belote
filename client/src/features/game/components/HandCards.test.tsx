import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "@/shared/types/gameTypes";

import { HandCards } from "./HandCards";

const testHand: Card[] = [
  { rank: "K", suit: "S" },
  { rank: "T", suit: "H" },
  { rank: "7", suit: "D" },
];

describe("HandCards", () => {
  it("renders correct number of cards", () => {
    render(
      <HandCards hand={testHand} isMyTurn={false} playableCardIds={[]} onPlayCard={vi.fn()} />,
    );

    expect(screen.getByTestId("hand-cards")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-KS")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-TH")).toBeInTheDocument();
    expect(screen.getByTestId("playing-card-7D")).toBeInTheDocument();
  });

  it("marks cards as playable when isMyTurn and cardId in playableCardIds", () => {
    render(
      <HandCards
        hand={testHand}
        isMyTurn={true}
        playableCardIds={["KS", "7D"]}
        onPlayCard={vi.fn()}
      />,
    );

    expect(screen.getByTestId("playing-card-KS").className).toContain("cursor-pointer");
    expect(screen.getByTestId("playing-card-7D").className).toContain("cursor-pointer");
  });

  it("marks cards as unplayable when isMyTurn and cardId NOT in playableCardIds", () => {
    render(
      <HandCards
        hand={testHand}
        isMyTurn={true}
        playableCardIds={["KS", "7D"]}
        onPlayCard={vi.fn()}
      />,
    );

    expect(screen.getByTestId("playing-card-TH").className).toContain("cursor-not-allowed");
  });

  it("marks all cards as default when not my turn", () => {
    render(
      <HandCards hand={testHand} isMyTurn={false} playableCardIds={[]} onPlayCard={vi.fn()} />,
    );

    const ks = screen.getByTestId("playing-card-KS");
    expect(ks.className).not.toContain("cursor-pointer");
    expect(ks.className).not.toContain("cursor-not-allowed");
  });

  it("renders cards sorted by suit (S, H, C, D) then rank ascending", () => {
    const unordered: Card[] = [
      { rank: "A", suit: "D" },
      { rank: "7", suit: "S" },
      { rank: "K", suit: "H" },
      { rank: "9", suit: "S" },
      { rank: "J", suit: "C" },
      { rank: "T", suit: "H" },
    ];

    render(
      <HandCards hand={unordered} isMyTurn={false} playableCardIds={[]} onPlayCard={vi.fn()} />,
    );

    const container = screen.getByTestId("hand-cards");
    const rendered = Array.from(container.querySelectorAll('[data-testid^="playing-card-"]')).map(
      (el) => el.getAttribute("data-testid")?.replace("playing-card-", ""),
    );

    expect(rendered).toEqual(["7S", "9S", "TH", "KH", "JC", "AD"]);
  });

  it("keeps all cards in default state when not my turn even after sorting", () => {
    const scrambled: Card[] = [
      { rank: "A", suit: "D" },
      { rank: "7", suit: "S" },
      { rank: "K", suit: "H" },
    ];

    render(
      <HandCards hand={scrambled} isMyTurn={false} playableCardIds={[]} onPlayCard={vi.fn()} />,
    );

    for (const id of ["7S", "KH", "AD"]) {
      const el = screen.getByTestId(`playing-card-${id}`);
      expect(el.className).not.toContain("cursor-pointer");
      expect(el.className).not.toContain("cursor-not-allowed");
    }
  });

  it("calls onPlayCard with correct cardId on playable card click", async () => {
    const user = userEvent.setup();
    const onPlayCard = vi.fn();

    render(
      <HandCards
        hand={testHand}
        isMyTurn={true}
        playableCardIds={["KS", "TH", "7D"]}
        onPlayCard={onPlayCard}
      />,
    );

    await user.click(screen.getByTestId("playing-card-TH"));

    expect(onPlayCard).toHaveBeenCalledWith("TH");
  });

  it("hides the flying card via visibility while the overlay paints it, and disables pointer events", () => {
    render(
      <HandCards
        hand={testHand}
        isMyTurn={true}
        playableCardIds={["KS", "TH", "7D"]}
        onPlayCard={vi.fn()}
        flyingId="KS"
      />,
    );

    // The wrapper around the flying card carries visibility:hidden + pointer-
    // events:none so the CardFlight overlay is the sole painter for the
    // moving card; the other cards stay visible at their normal layout.
    const flyingWrapper = screen.getByTestId("playing-card-KS").parentElement;
    const otherWrapper = screen.getByTestId("playing-card-TH").parentElement;
    expect(flyingWrapper?.style.visibility).toBe("hidden");
    expect(flyingWrapper?.style.pointerEvents).toBe("none");
    expect(otherWrapper?.style.visibility).toBe("visible");
  });

  it("treats the flying card as 'default' state so it is not clickable mid-flight", () => {
    const onPlayCard = vi.fn();
    render(
      <HandCards
        hand={testHand}
        isMyTurn={true}
        playableCardIds={["KS", "TH", "7D"]}
        onPlayCard={onPlayCard}
        flyingId="KS"
      />,
    );

    const flying = screen.getByTestId("playing-card-KS");
    // Without the playable lift class, the card is in default state — no
    // cursor-pointer hint, no extra click handler that would re-fire onPlay.
    expect(flying.className).not.toContain("cursor-pointer");
  });
});
