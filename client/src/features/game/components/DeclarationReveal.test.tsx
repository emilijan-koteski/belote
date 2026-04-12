import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeclarationsResolvedPayload } from "@/shared/types/wsEvents";

import { DeclarationReveal } from "./DeclarationReveal";

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

const mockPayload: DeclarationsResolvedPayload = {
  winnerTeam: 0,
  declarations: [
    { playerSeat: 0, type: "sequence", value: 50, cards: ["JD", "QD", "KD", "AD"] },
  ],
};

describe("DeclarationReveal", () => {
  it("renders declaration reveal with total value", () => {
    render(
      <DeclarationReveal payload={mockPayload} onComplete={vi.fn()} />,
    );
    expect(screen.getByTestId("declaration-reveal")).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
  });

  it("does not render when winnerTeam is null", () => {
    const payload: DeclarationsResolvedPayload = {
      winnerTeam: null,
      declarations: [],
    };
    render(
      <DeclarationReveal payload={payload} onComplete={vi.fn()} />,
    );
    expect(screen.queryByTestId("declaration-reveal")).not.toBeInTheDocument();
  });

  it("calls onComplete after animation duration", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <DeclarationReveal payload={mockPayload} onComplete={onComplete} />,
    );
    vi.advanceTimersByTime(2100);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("completes faster with prefers-reduced-motion", () => {
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
      <DeclarationReveal payload={mockPayload} onComplete={onComplete} />,
    );
    vi.advanceTimersByTime(600);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
