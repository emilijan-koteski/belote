import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SurrenderPrompt } from "./SurrenderPrompt";

describe("SurrenderPrompt", () => {
  it("renders the prompt overlay", () => {
    render(<SurrenderPrompt proposerUsername="alice" onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByTestId("surrender-prompt")).toBeInTheDocument();
  });

  it("shows accept and decline buttons", () => {
    render(<SurrenderPrompt proposerUsername="alice" onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByTestId("surrender-prompt-accept")).toBeInTheDocument();
    expect(screen.getByTestId("surrender-prompt-decline")).toBeInTheDocument();
  });

  it("interpolates the proposer username into the body copy", () => {
    render(<SurrenderPrompt proposerUsername="alice" onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
  });

  it("calls onAccept when accept is clicked", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(<SurrenderPrompt proposerUsername="alice" onAccept={onAccept} onDecline={vi.fn()} />);
    await user.click(screen.getByTestId("surrender-prompt-accept"));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("calls onDecline when decline is clicked", async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(<SurrenderPrompt proposerUsername="alice" onAccept={vi.fn()} onDecline={onDecline} />);
    await user.click(screen.getByTestId("surrender-prompt-decline"));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it("renders as an aria-modal dialog", () => {
    render(<SurrenderPrompt proposerUsername="alice" onAccept={vi.fn()} onDecline={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
