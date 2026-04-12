import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByTestId("declaration-prompt")).toBeInTheDocument();
  });

  it("shows DECLARE and SKIP buttons", () => {
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByTestId("declaration-prompt-declare")).toBeInTheDocument();
    expect(screen.getByTestId("declaration-prompt-skip")).toBeInTheDocument();
  });

  it("displays declaration value", () => {
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it("calls onDeclare when DECLARE button is clicked", async () => {
    const user = userEvent.setup();
    const onDeclare = vi.fn();
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={onDeclare}
        onSkip={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("declaration-prompt-declare"));
    expect(onDeclare).toHaveBeenCalledOnce();
  });

  it("calls onSkip when SKIP button is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={onSkip}
      />,
    );
    await user.click(screen.getByTestId("declaration-prompt-skip"));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("has role dialog and aria-modal", () => {
    render(
      <DeclarationPrompt
        declarations={mockDeclarations}
        onDeclare={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
