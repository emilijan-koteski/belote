import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReconnectOverlay } from "./ReconnectOverlay";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "game.disconnect.reconnecting": "Reconnecting...",
        "game.disconnect.countdownLabel": "Time remaining",
      };
      if (key === "game.disconnect.waitingMessage" && opts?.player) {
        return `The game is on hold while we wait for ${opts.player} to reconnect.`;
      }
      return translations[key] ?? key;
    },
  }),
}));

describe("ReconnectOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders player name and countdown", () => {
    const expiresAt = new Date(Date.now() + 120_000).toISOString(); // 2 minutes from now
    render(
      <ReconnectOverlay
        disconnectedPlayerName="Alice"
        reconnectExpiresAt={expiresAt}
      />,
    );

    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    expect(screen.getByText(/wait for Alice to reconnect/)).toBeInTheDocument();
    expect(screen.getByTestId("reconnect-countdown")).toBeInTheDocument();
    // Should show roughly 2:00
    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("2:00");
  });

  it("countdown decrements over time", () => {
    const expiresAt = new Date(Date.now() + 65_000).toISOString(); // 65 seconds
    render(
      <ReconnectOverlay
        disconnectedPlayerName="Bob"
        reconnectExpiresAt={expiresAt}
      />,
    );

    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("1:05");

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("0:55");
  });

  it("countdown stops at zero", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString(); // already expired
    render(
      <ReconnectOverlay
        disconnectedPlayerName="Carol"
        reconnectExpiresAt={expiresAt}
      />,
    );

    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("0:00");
  });

  it("has correct accessibility attributes", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    render(
      <ReconnectOverlay
        disconnectedPlayerName="Dave"
        reconnectExpiresAt={expiresAt}
      />,
    );

    const overlay = screen.getByTestId("reconnect-overlay");
    expect(overlay).toHaveAttribute("aria-live", "assertive");
  });
});
