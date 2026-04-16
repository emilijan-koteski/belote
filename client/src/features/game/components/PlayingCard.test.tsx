import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "@/shared/types/gameTypes";

import { PlayingCard } from "./PlayingCard";

const kingOfSpades: Card = { rank: "K", suit: "S" };
const tenOfHearts: Card = { rank: "T", suit: "H" };

describe("PlayingCard", () => {
  it("renders face-up card with correct rank and suit symbol", () => {
    render(<PlayingCard card={kingOfSpades} state="default" size="md" />);

    const card = screen.getByTestId("playing-card-KS");
    expect(card).toHaveTextContent("K");
    expect(card).toHaveTextContent("\u2660");
  });

  it("renders ten as '10' not 'T'", () => {
    render(<PlayingCard card={tenOfHearts} state="default" size="md" />);

    const card = screen.getByTestId("playing-card-TH");
    expect(card).toHaveTextContent("10");
    expect(card).toHaveTextContent("\u2665");
  });

  it("renders face-down card with no suit/rank visible", () => {
    render(<PlayingCard card={null} state="face-down" size="md" />);

    const card = screen.getByTestId("playing-card-facedown");
    expect(card).not.toHaveTextContent("K");
    expect(card).not.toHaveTextContent("\u2660");
  });

  it("has accent glow class and cursor-pointer when playable", () => {
    render(<PlayingCard card={kingOfSpades} state="playable" size="md" />);

    const card = screen.getByTestId("playing-card-KS");
    expect(card.className).toContain("cursor-pointer");
    expect(card.className).toContain("shadow-[0_0_12px_var(--color-accent-glow)]");
  });

  it("is grayscaled, faded and lowered with cursor-not-allowed when unplayable", () => {
    render(<PlayingCard card={kingOfSpades} state="unplayable" size="md" />);

    const card = screen.getByTestId("playing-card-KS");
    expect(card.className).toContain("opacity-40");
    expect(card.className).toContain("grayscale");
    expect(card.className).toContain("motion-safe:translate-y-[4px]");
    expect(card.className).toContain("cursor-not-allowed");
  });

  it("is raised above baseline when playable", () => {
    render(<PlayingCard card={kingOfSpades} state="playable" size="md" />);

    const card = screen.getByTestId("playing-card-KS");
    expect(card.className).toContain("motion-safe:translate-y-[-10px]");
    expect(card.className).toContain("motion-safe:hover:translate-y-[-14px]");
  });

  it("calls onClick only when state is playable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(
      <PlayingCard card={kingOfSpades} state="playable" size="md" onClick={onClick} />,
    );

    await user.click(screen.getByTestId("playing-card-KS"));
    expect(onClick).toHaveBeenCalledTimes(1);

    onClick.mockClear();
    rerender(<PlayingCard card={kingOfSpades} state="unplayable" size="md" onClick={onClick} />);

    await user.click(screen.getByTestId("playing-card-KS"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has correct aria-label for face-up card", () => {
    render(<PlayingCard card={kingOfSpades} state="default" size="md" />);

    expect(screen.getByTestId("playing-card-KS")).toHaveAttribute("aria-label", "King of Spades");
  });

  it("has correct aria-label for face-down card", () => {
    render(<PlayingCard card={null} state="face-down" size="md" />);

    expect(screen.getByTestId("playing-card-facedown")).toHaveAttribute(
      "aria-label",
      "face-down card",
    );
  });

  it("fires onClick on Enter key when playable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<PlayingCard card={kingOfSpades} state="playable" size="md" onClick={onClick} />);

    const card = screen.getByTestId("playing-card-KS");
    card.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClick on Space key when playable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<PlayingCard card={kingOfSpades} state="playable" size="md" onClick={onClick} />);

    const card = screen.getByTestId("playing-card-KS");
    card.focus();
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has tabIndex={0} when playable, tabIndex={-1} when not", () => {
    const { rerender } = render(<PlayingCard card={kingOfSpades} state="playable" size="md" />);

    expect(screen.getByTestId("playing-card-KS")).toHaveAttribute("tabindex", "0");

    rerender(<PlayingCard card={kingOfSpades} state="default" size="md" />);

    expect(screen.getByTestId("playing-card-KS")).toHaveAttribute("tabindex", "-1");
  });

  it("sets aria-disabled when unplayable", () => {
    render(<PlayingCard card={kingOfSpades} state="unplayable" size="md" />);

    expect(screen.getByTestId("playing-card-KS")).toHaveAttribute("aria-disabled", "true");
  });
});
