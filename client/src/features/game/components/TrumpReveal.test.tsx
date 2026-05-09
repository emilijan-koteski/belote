import "@/shared/i18n/i18n";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerState } from "@/shared/types/gameTypes";

import { TrumpReveal } from "./TrumpReveal";

function makePlayers(): PlayerState[] {
  return [
    {
      hand: [],
      seat: 0,
      userId: 10,
      username: "Alice",
      team: "teamA",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 1,
      userId: 20,
      username: "Bob",
      team: "teamB",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 2,
      userId: 30,
      username: "Carol",
      team: "teamA",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 3,
      userId: 40,
      username: "Dave",
      team: "teamB",
      declarations: [],
      connected: true,
    },
  ];
}

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

describe("TrumpReveal", () => {
  it("renders picker username and the originally face-up card", () => {
    render(
      <TrumpReveal
        playerSeat={2}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trump-reveal")).toBeInTheDocument();
    expect(screen.getByTestId("trump-reveal-title")).toHaveTextContent("Carol");
    expect(screen.getByTestId("playing-card-7S")).toBeInTheDocument();
  });

  it("falls back to unknown-player title when seat has no matching player", () => {
    render(
      <TrumpReveal
        playerSeat={5}
        myPlayerSeat={0}
        cardId="9D"
        trumpSuit="D"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );
    const title = screen.getByTestId("trump-reveal-title");
    expect(title).toBeInTheDocument();
    expect(title.textContent).not.toContain("Alice");
    expect(title.textContent).not.toContain("Bob");
    expect(screen.getByTestId("playing-card-9D")).toBeInTheDocument();
  });

  it("auto-dismisses after 8 seconds", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <TrumpReveal
        playerSeat={0}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={onComplete}
      />,
    );
    vi.advanceTimersByTime(7000);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("auto-dismisses faster with prefers-reduced-motion (~1.5 s)", () => {
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
      <TrumpReveal
        playerSeat={0}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={onComplete}
      />,
    );
    vi.advanceTimersByTime(2000);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("can be dismissed early by clicking the X", () => {
    const onComplete = vi.fn();
    render(
      <TrumpReveal
        playerSeat={2}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByTestId("trump-reveal-close"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("tags the toast with the caller's viewer-relative team (gold = Us)", () => {
    // Caller seat 2, viewer seat 0 — same parity → gold (Us)
    render(
      <TrumpReveal
        playerSeat={2}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );
    const toast = screen.getByTestId("trump-reveal").querySelector("[data-team]");
    expect(toast?.getAttribute("data-team")).toBe("gold");
  });

  it("round-2 free pick: shows chosen-suit chip, captions chosen suit, omits playing card, lists candidate by full name", () => {
    render(
      <TrumpReveal
        playerSeat={2}
        myPlayerSeat={0}
        cardId="9S"
        trumpSuit="D"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );

    // Suit chip (chosen suit) renders in place of the playing card.
    const chip = screen.getByTestId("trump-reveal-suit-chip");
    expect(chip).toBeInTheDocument();
    expect(chip.getAttribute("data-suit")).toBe("D");
    expect(screen.queryByTestId("playing-card-9S")).toBeNull();

    // Title says the chosen suit (Diamonds), not the candidate's suit (Spades).
    const title = screen.getByTestId("trump-reveal-title");
    expect(title.textContent).toContain("Diamonds");
    expect(title.textContent).not.toContain("Spades");

    // Candidate caption uses full English words — never glyphs or single-letter
    // rank codes. Specifically guard against `9S`, the suit glyphs, and the
    // standalone letter codes that round-2 visuals must never expose.
    const caption = screen.getByTestId("trump-reveal-candidate");
    expect(caption.textContent).toContain("Nine");
    expect(caption.textContent).toContain("Spades");
    const captionText = caption.textContent ?? "";
    expect(captionText).not.toContain("9S");
    for (const glyph of ["♠", "♥", "♦", "♣"]) {
      expect(captionText).not.toContain(glyph);
    }
    // No standalone single-letter rank codes (T/J/Q/K/A surrounded by
    // word boundaries) leaked into the caption text.
    expect(/\b[TJQKA]\b/.test(captionText)).toBe(false);
  });

  it("round-2 free pick with T-rank candidate: caption says 'Ten of Clubs', never the bare letter T", () => {
    // IO Matrix Row 3 — guards specifically against the `T` single-letter
    // rank code leaking into user-facing text. Without this case, the
    // negative regex `\b[TJQKA]\b` in the prior test never fires on its
    // most likely real-world miss.
    render(
      <TrumpReveal
        playerSeat={2}
        myPlayerSeat={0}
        cardId="TC"
        trumpSuit="H"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );
    const caption = screen.getByTestId("trump-reveal-candidate");
    const captionText = caption.textContent ?? "";
    expect(captionText).toContain("Ten");
    expect(captionText).toContain("Clubs");
    expect(captionText).not.toContain("TC");
    expect(/\b[TJQKA]\b/.test(captionText)).toBe(false);
    // Title still shows the chosen suit (Hearts), not the candidate's (Clubs).
    const title = screen.getByTestId("trump-reveal-title");
    expect(title.textContent).toContain("Hearts");
    expect(title.textContent).not.toContain("Clubs");
    // Chip uses chosen-suit (Hearts → red color path); explicit data-suit asserts identity.
    expect(screen.getByTestId("trump-reveal-suit-chip").getAttribute("data-suit")).toBe("H");
  });

  it("round-1 pick (suits match): renders the candidate playing card, no suit chip", () => {
    render(
      <TrumpReveal
        playerSeat={2}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("playing-card-7S")).toBeInTheDocument();
    expect(screen.queryByTestId("trump-reveal-suit-chip")).toBeNull();
    expect(screen.queryByTestId("trump-reveal-candidate")).toBeNull();
  });

  it("flips to silver glow when the caller is on the opposing team", () => {
    // Caller seat 1, viewer seat 0 — opposite parity → silver (Them)
    render(
      <TrumpReveal
        playerSeat={1}
        myPlayerSeat={0}
        cardId="7S"
        trumpSuit="S"
        players={makePlayers()}
        onComplete={vi.fn()}
      />,
    );
    const toast = screen.getByTestId("trump-reveal").querySelector("[data-team]");
    expect(toast?.getAttribute("data-team")).toBe("silver");
  });
});
