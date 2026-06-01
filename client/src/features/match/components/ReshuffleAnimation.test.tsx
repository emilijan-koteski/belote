import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReshuffleAnimation } from "./ReshuffleAnimation";

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

describe("ReshuffleAnimation", () => {
  it("renders reshuffle animation", () => {
    render(<ReshuffleAnimation onComplete={vi.fn()} />);
    expect(screen.getByTestId("reshuffle-animation")).toBeInTheDocument();
  });

  it("calls onComplete after animation duration", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<ReshuffleAnimation onComplete={onComplete} />);
    vi.advanceTimersByTime(1300);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("completes instantly with prefers-reduced-motion", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const onComplete = vi.fn();
    render(<ReshuffleAnimation onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
