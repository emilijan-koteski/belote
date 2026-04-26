import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerState } from "@/shared/types/gameTypes";

import { TrumpReveal } from "./TrumpReveal";

function makePlayers(): PlayerState[] {
  return [
    {
      hand: [],
      seat: 0,
      userId: 10,
      username: "Alice",
      team: "red",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 1,
      userId: 20,
      username: "Bob",
      team: "blue",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 2,
      userId: 30,
      username: "Carol",
      team: "red",
      declarations: [],
      connected: true,
    },
    {
      hand: [],
      seat: 3,
      userId: 40,
      username: "Dave",
      team: "blue",
      declarations: [],
      connected: true,
    },
  ];
}

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

describe("TrumpReveal", () => {
  it("renders picker username and the originally face-up card", () => {
    render(<TrumpReveal playerSeat={2} cardId="7S" players={makePlayers()} onComplete={vi.fn()} />);
    expect(screen.getByTestId("trump-reveal")).toBeInTheDocument();
    expect(screen.getByTestId("trump-reveal-title")).toHaveTextContent("Carol");
    expect(screen.getByTestId("playing-card-7S")).toBeInTheDocument();
  });

  it("falls back to unknown-player title when seat has no matching player", () => {
    render(<TrumpReveal playerSeat={5} cardId="9D" players={makePlayers()} onComplete={vi.fn()} />);
    const title = screen.getByTestId("trump-reveal-title");
    expect(title).toBeInTheDocument();
    expect(title.textContent).not.toContain("Alice");
    expect(title.textContent).not.toContain("Bob");
    expect(screen.getByTestId("playing-card-9D")).toBeInTheDocument();
  });

  it("auto-dismisses after ~3.5 seconds", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <TrumpReveal playerSeat={0} cardId="7S" players={makePlayers()} onComplete={onComplete} />,
    );
    vi.advanceTimersByTime(3400);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("auto-dismisses faster with prefers-reduced-motion", () => {
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
      <TrumpReveal playerSeat={0} cardId="7S" players={makePlayers()} onComplete={onComplete} />,
    );
    vi.advanceTimersByTime(1600);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
