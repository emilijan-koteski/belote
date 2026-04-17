import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
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
});
