import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrumpIndicator } from "./TrumpIndicator";

describe("TrumpIndicator", () => {
  it("renders spades suit symbol with accent color", () => {
    render(<TrumpIndicator trumpSuit="S" />);
    const indicator = screen.getByTestId("trump-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain("\u2660");
  });

  it("renders hearts suit symbol", () => {
    render(<TrumpIndicator trumpSuit="H" />);
    expect(screen.getByTestId("trump-indicator").textContent).toContain("\u2665");
  });

  it("renders diamonds suit symbol", () => {
    render(<TrumpIndicator trumpSuit="D" />);
    expect(screen.getByTestId("trump-indicator").textContent).toContain("\u2666");
  });

  it("renders clubs suit symbol", () => {
    render(<TrumpIndicator trumpSuit="C" />);
    expect(screen.getByTestId("trump-indicator").textContent).toContain("\u2663");
  });

  it("has aria-live polite for screen reader updates", () => {
    render(<TrumpIndicator trumpSuit="S" />);
    expect(screen.getByTestId("trump-indicator")).toHaveAttribute("aria-live", "polite");
  });

  it("has aria-label describing the trump suit", () => {
    render(<TrumpIndicator trumpSuit="H" />);
    expect(screen.getByTestId("trump-indicator")).toHaveAttribute("aria-label");
  });
});
