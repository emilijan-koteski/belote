import "@/shared/i18n/i18n";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BelotPrompt } from "./BelotPrompt";

describe("BelotPrompt", () => {
  it("renders the belot prompt overlay", () => {
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByTestId("belot-prompt")).toBeInTheDocument();
  });

  it("shows ANNOUNCE and SKIP buttons", () => {
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByTestId("belot-prompt-announce")).toBeInTheDocument();
    expect(screen.getByTestId("belot-prompt-decline")).toBeInTheDocument();
  });

  it("calls onAnnounce when ANNOUNCE is clicked", async () => {
    const user = userEvent.setup();
    const onAnnounce = vi.fn();
    render(<BelotPrompt isKing={false} onAnnounce={onAnnounce} onDecline={vi.fn()} />);
    await user.click(screen.getByTestId("belot-prompt-announce"));
    expect(onAnnounce).toHaveBeenCalledOnce();
  });

  it("calls onDecline when SKIP is clicked", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={onDecline} />);
    await user.click(screen.getByTestId("belot-prompt-decline"));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it("has role dialog and aria-modal", () => {
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("shows Belot copy when playing the Queen first", () => {
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText("Announce Belot?")).toBeInTheDocument();
    expect(screen.getByTestId("belot-prompt-announce")).toHaveTextContent("Announce Belot");
  });

  it("shows Re-belot copy when playing the King first", () => {
    render(<BelotPrompt isKing={true} onAnnounce={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText("Announce Re-belot?")).toBeInTheDocument();
    expect(screen.getByTestId("belot-prompt-announce")).toHaveTextContent("Announce Re-belot");
  });

  it("wraps the Decline button with the button-timer ring when per-move", () => {
    const expiry = new Date(Date.now() + 20000).toISOString();
    render(
      <BelotPrompt
        isKing={false}
        onAnnounce={vi.fn()}
        onDecline={vi.fn()}
        turnExpiresAt={expiry}
        timerDurationSec={30}
      />,
    );
    const ring = screen.getByTestId("button-timer-ring");
    expect(ring).toBeInTheDocument();
    // Auto-action target on expiry is Decline, so the ring must wrap it.
    expect(ring.querySelector('[data-testid="belot-prompt-decline"]')).toBeInTheDocument();
  });

  it("does not render the in-dialog timer ring in relaxed mode", () => {
    render(
      <BelotPrompt
        isKing={false}
        onAnnounce={vi.fn()}
        onDecline={vi.fn()}
        turnExpiresAt={null}
        timerDurationSec={0}
      />,
    );
    expect(screen.queryByTestId("button-timer-ring")).not.toBeInTheDocument();
  });

  it("does not render the in-dialog timer ring when isActivePlayer is false", () => {
    const expiry = new Date(Date.now() + 20000).toISOString();
    render(
      <BelotPrompt
        isKing={false}
        onAnnounce={vi.fn()}
        onDecline={vi.fn()}
        turnExpiresAt={expiry}
        timerDurationSec={30}
        isActivePlayer={false}
      />,
    );
    expect(screen.queryByTestId("button-timer-ring")).not.toBeInTheDocument();
  });

  it("Escape key triggers onDecline (AC7)", () => {
    const onDecline = vi.fn();
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={onDecline} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("outer wrapper uses fixed positioning (AC7)", () => {
    render(<BelotPrompt isKing={false} onAnnounce={vi.fn()} onDecline={vi.fn()} />);
    const wrapper = screen.getByTestId("belot-prompt");
    expect(wrapper.className).toContain("fixed");
    expect(wrapper.className).not.toMatch(/(^|\s)absolute(\s|$)/);
  });
});
