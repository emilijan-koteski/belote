import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrumpIndicator } from "./TrumpIndicator";

describe("TrumpIndicator", () => {
  it("renders spades suit symbol in primary text color", () => {
    render(<TrumpIndicator trumpSuit="S" />);
    const indicator = screen.getByTestId("trump-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain("\u2660");
    expect(indicator.querySelector(".text-text-primary")?.textContent).toContain("\u2660");
  });

  it("renders hearts suit symbol in red", () => {
    render(<TrumpIndicator trumpSuit="H" />);
    const indicator = screen.getByTestId("trump-indicator");
    expect(indicator.textContent).toContain("\u2665");
    expect(indicator.querySelector(".text-red-500")?.textContent).toContain("\u2665");
  });

  it("renders diamonds suit symbol in red", () => {
    render(<TrumpIndicator trumpSuit="D" />);
    const indicator = screen.getByTestId("trump-indicator");
    expect(indicator.textContent).toContain("\u2666");
    expect(indicator.querySelector(".text-red-500")?.textContent).toContain("\u2666");
  });

  it("renders clubs suit symbol in primary text color", () => {
    render(<TrumpIndicator trumpSuit="C" />);
    const indicator = screen.getByTestId("trump-indicator");
    expect(indicator.textContent).toContain("\u2663");
    expect(indicator.querySelector(".text-text-primary")?.textContent).toContain("\u2663");
  });

  it("has aria-live polite for screen reader updates", () => {
    render(<TrumpIndicator trumpSuit="S" />);
    expect(screen.getByTestId("trump-indicator")).toHaveAttribute("aria-live", "polite");
  });

  it("has aria-label describing the trump suit", () => {
    render(<TrumpIndicator trumpSuit="H" />);
    expect(screen.getByTestId("trump-indicator")).toHaveAttribute("aria-label");
  });

  it("shows a red team badge when the trump caller is on an even seat", () => {
    render(<TrumpIndicator trumpSuit="S" trumpCallerSeat={0} />);
    const badge = screen.getByTestId("trump-caller-team");
    expect(badge).toHaveAttribute("data-team", "red");
    expect(badge.className).toContain("text-team-red");
    expect(screen.getByTestId("trump-indicator").className).toContain("border-team-red");
  });

  it("shows a blue team badge when the trump caller is on an odd seat", () => {
    render(<TrumpIndicator trumpSuit="H" trumpCallerSeat={3} />);
    const badge = screen.getByTestId("trump-caller-team");
    expect(badge).toHaveAttribute("data-team", "blue");
    expect(badge.className).toContain("text-team-blue");
    expect(screen.getByTestId("trump-indicator").className).toContain("border-team-blue");
  });

  it("omits the team badge when trump caller seat is null", () => {
    render(<TrumpIndicator trumpSuit="S" trumpCallerSeat={null} />);
    expect(screen.queryByTestId("trump-caller-team")).not.toBeInTheDocument();
    expect(screen.getByTestId("trump-indicator").className).not.toContain("border-team-");
  });
});
