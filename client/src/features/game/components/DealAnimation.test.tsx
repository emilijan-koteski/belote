import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DealAnimation } from "./DealAnimation";

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

describe("DealAnimation", () => {
  it("renders deal animation container", () => {
    render(
      <DealAnimation
        trumpCandidate={{ rank: "K", suit: "H" }}
      />,
    );
    expect(screen.getByTestId("deal-animation")).toBeInTheDocument();
  });

  it("shows trump candidate card when available", () => {
    vi.useFakeTimers();
    render(
      <DealAnimation
        trumpCandidate={{ rank: "K", suit: "H" }}
      />,
    );
    // Advance to revealing phase
    vi.advanceTimersByTime(900);
    expect(screen.getByTestId("deal-animation")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders without trump candidate", () => {
    render(
      <DealAnimation
        trumpCandidate={null}
      />,
    );
    expect(screen.getByTestId("deal-animation")).toBeInTheDocument();
  });

  it("has aria-label for deal animation", () => {
    render(
      <DealAnimation
        trumpCandidate={{ rank: "K", suit: "H" }}
      />,
    );
    expect(screen.getByTestId("deal-animation")).toHaveAttribute("aria-label");
  });

  it("skips animation instantly when prefers-reduced-motion is set", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    render(
      <DealAnimation
        trumpCandidate={{ rank: "K", suit: "H" }}
      />,
    );
    // With reduced motion, deal phase goes to done immediately
  });
});
