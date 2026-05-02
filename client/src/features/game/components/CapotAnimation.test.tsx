import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "game.capot.title": "CAPOT!",
      };
      return translations[key] ?? key;
    },
  }),
}));

import { CapotAnimation } from "./CapotAnimation";

describe("CapotAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders capot text", () => {
    render(<CapotAnimation capotTeam={0} onComplete={vi.fn()} />);

    expect(screen.getByTestId("capot-animation")).toBeInTheDocument();
    expect(screen.getByTestId("capot-text")).toHaveTextContent("CAPOT!");
  });

  it("renders with team-a color and data-team='teamA' for team 0", () => {
    render(<CapotAnimation capotTeam={0} onComplete={vi.fn()} />);

    const text = screen.getByTestId("capot-text");
    expect(text.className).toContain("text-team-a");
    expect(text).toHaveAttribute("data-team", "teamA");
  });

  it("renders with team-b color and data-team='teamB' for team 1", () => {
    render(<CapotAnimation capotTeam={1} onComplete={vi.fn()} />);

    const text = screen.getByTestId("capot-text");
    expect(text.className).toContain("text-team-b");
    expect(text).toHaveAttribute("data-team", "teamB");
  });

  it("calls onComplete after 2500ms", () => {
    const onComplete = vi.fn();
    render(<CapotAnimation capotTeam={0} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2499);
    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("is non-interactive (pointer-events-none)", () => {
    render(<CapotAnimation capotTeam={0} onComplete={vi.fn()} />);

    expect(screen.getByTestId("capot-animation").className).toContain("pointer-events-none");
  });

  it("calls onComplete after 500ms when reduced motion is preferred", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const onComplete = vi.fn();
    render(<CapotAnimation capotTeam={0} onComplete={onComplete} />);

    vi.advanceTimersByTime(500);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
