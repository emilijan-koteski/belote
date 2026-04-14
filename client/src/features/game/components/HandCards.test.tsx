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
});
