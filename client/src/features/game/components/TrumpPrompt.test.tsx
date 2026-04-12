import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrumpPrompt } from "./TrumpPrompt";

const trumpCandidate = { rank: "K" as const, suit: "H" as const };

describe("TrumpPrompt", () => {
  it("renders the prompt overlay", () => {
    render(
      <TrumpPrompt
        trumpCandidate={trumpCandidate}
        biddingRound={1}
        isActiveBidder={true}
        onPick={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trump-prompt")).toBeInTheDocument();
  });

  it("shows PICK and PASS buttons when active bidder in round 1", () => {
    render(
      <TrumpPrompt
        trumpCandidate={trumpCandidate}
        biddingRound={1}
        isActiveBidder={true}
        onPick={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trump-prompt-pick")).toBeInTheDocument();
    expect(screen.getByTestId("trump-prompt-pass")).toBeInTheDocument();
  });

  it("calls onPick when PICK button is clicked in round 1", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <TrumpPrompt
        trumpCandidate={trumpCandidate}
        biddingRound={1}
        isActiveBidder={true}
        onPick={onPick}
        onPass={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("trump-prompt-pick"));
    expect(onPick).toHaveBeenCalledWith();
  });

  it("calls onPass when PASS button is clicked", async () => {
    const user = userEvent.setup();
    const onPass = vi.fn();
    render(
      <TrumpPrompt
        trumpCandidate={trumpCandidate}
        biddingRound={1}
        isActiveBidder={true}
        onPick={vi.fn()}
        onPass={onPass}
      />,
    );
    await user.click(screen.getByTestId("trump-prompt-pass"));
    expect(onPass).toHaveBeenCalledOnce();
  });

  it("shows waiting text for non-active bidder", () => {
    render(
      <TrumpPrompt
        trumpCandidate={trumpCandidate}
        biddingRound={1}
        isActiveBidder={false}
        onPick={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("trump-prompt-pick")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trump-prompt-pass")).not.toBeInTheDocument();
  });

  it("shows suit buttons in round 2 for active bidder", () => {
    render(
      <TrumpPrompt
        trumpCandidate={null}
        biddingRound={2}
        isActiveBidder={true}
        onPick={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trump-prompt-suit-S")).toBeInTheDocument();
    expect(screen.getByTestId("trump-prompt-suit-H")).toBeInTheDocument();
    expect(screen.getByTestId("trump-prompt-suit-D")).toBeInTheDocument();
    expect(screen.getByTestId("trump-prompt-suit-C")).toBeInTheDocument();
  });

  it("calls onPick with suit when suit button clicked in round 2", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <TrumpPrompt
        trumpCandidate={null}
        biddingRound={2}
        isActiveBidder={true}
        onPick={onPick}
        onPass={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("trump-prompt-suit-H"));
    expect(onPick).toHaveBeenCalledWith("H");
  });

  it("has role dialog and aria-modal", () => {
    render(
      <TrumpPrompt
        trumpCandidate={trumpCandidate}
        biddingRound={1}
        isActiveBidder={true}
        onPick={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
