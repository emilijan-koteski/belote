import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Declaration } from "@/shared/types/gameTypes";

import { DeclarationPrompt } from "./DeclarationPrompt";

const mockDeclarations: Declaration[] = [
  {
    type: "sequence",
    cards: [
      { rank: "J", suit: "D" },
      { rank: "Q", suit: "D" },
      { rank: "K", suit: "D" },
      { rank: "A", suit: "D" },
    ],
    playerSeat: 0,
    value: 50,
  },
];

describe("DeclarationPrompt", () => {
  it("renders the declaration prompt overlay", () => {
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(screen.getByTestId("declaration-prompt")).toBeInTheDocument();
  });

  it("shows DECLARE and SKIP buttons", () => {
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(screen.getByTestId("declaration-prompt-declare")).toBeInTheDocument();
    expect(screen.getByTestId("declaration-prompt-skip")).toBeInTheDocument();
  });

  it("displays declaration value", () => {
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={vi.fn()} onSkip={vi.fn()} />,
    );
    // Value appears in the group row and again in the total footer — both are fine.
    expect(screen.getAllByText(/50/).length).toBeGreaterThan(0);
  });

  it("shows total equal to sum of declaration values", () => {
    const multi: Declaration[] = [
      {
        type: "sequence",
        cards: [
          { rank: "7", suit: "S" },
          { rank: "8", suit: "S" },
          { rank: "9", suit: "S" },
        ],
        playerSeat: 0,
        value: 20,
      },
      {
        type: "four_of_a_kind",
        cards: [
          { rank: "J", suit: "S" },
          { rank: "J", suit: "H" },
          { rank: "J", suit: "D" },
          { rank: "J", suit: "C" },
        ],
        playerSeat: 0,
        value: 200,
      },
    ];
    render(<DeclarationPrompt declarations={multi} onDeclare={vi.fn()} onSkip={vi.fn()} />);
    const totalRow = screen.getByTestId("declaration-prompt-total");
    expect(totalRow).toHaveTextContent(/220/);
  });

  it("total matches single-declaration value when only one group is present", () => {
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={vi.fn()} onSkip={vi.fn()} />,
    );
    const totalRow = screen.getByTestId("declaration-prompt-total");
    expect(totalRow).toHaveTextContent(/50/);
  });

  it("calls onDeclare when DECLARE button is clicked", async () => {
    const user = userEvent.setup();
    const onDeclare = vi.fn();
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={onDeclare} onSkip={vi.fn()} />,
    );
    await user.click(screen.getByTestId("declaration-prompt-declare"));
    expect(onDeclare).toHaveBeenCalledOnce();
  });

  it("calls onSkip when SKIP button is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={vi.fn()} onSkip={onSkip} />,
    );
    await user.click(screen.getByTestId("declaration-prompt-skip"));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("has role dialog and aria-modal", () => {
    render(
      <DeclarationPrompt declarations={mockDeclarations} onDeclare={vi.fn()} onSkip={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("wraps the Skip button with the button-timer ring when per-move", () => {
    const expiry = new Date(Date.now() + 20000).toISOString();
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
        turnExpiresAt={expiry}
        timerDurationSec={30}
      />,
    );
    const ring = screen.getByTestId("button-timer-ring");
    expect(ring).toBeInTheDocument();
    expect(ring.querySelector('[data-testid="declaration-prompt-skip"]')).toBeInTheDocument();
  });

  it("does not render the in-dialog timer ring in relaxed mode", () => {
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
        turnExpiresAt={null}
        timerDurationSec={0}
      />,
    );
    expect(screen.queryByTestId("button-timer-ring")).not.toBeInTheDocument();
  });

  it("does not render the in-dialog timer ring when isActivePlayer is false", () => {
    const expiry = new Date(Date.now() + 20000).toISOString();
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
        turnExpiresAt={expiry}
        timerDurationSec={30}
        isActivePlayer={false}
      />,
    );
    expect(screen.queryByTestId("button-timer-ring")).not.toBeInTheDocument();
  });

  describe("auto-skip on timer expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("does NOT fire onSkip when the in-dialog timer ring reaches zero (server-authoritative auto-skip)", () => {
      const onSkip = vi.fn();
      const expiry = new Date(Date.now() + 5000).toISOString();
      render(
        <DeclarationPrompt
          declarations={mockDeclarations}
          onDeclare={vi.fn()}
          onSkip={onSkip}
          turnExpiresAt={expiry}
          timerDurationSec={5}
        />,
      );

      expect(onSkip).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      // Server-authoritative: auto-skip arrives via state push, not from the client.
      expect(onSkip).not.toHaveBeenCalled();
    });
  });
});
