import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReconnectOverlay } from "./ReconnectOverlay";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "game.disconnect.reconnecting": "Reconnecting...",
        "game.disconnect.countdownLabel": "Time remaining",
        "game.disconnect.returningToLobby": "Returning to lobby...",
      };
      if (key === "game.disconnect.waitingMessage" && opts?.player) {
        return `The game is on hold while we wait for ${opts.player} to reconnect.`;
      }
      if (key === "game.disconnect.matchAbandoned" && opts?.player) {
        return `${opts.player} disconnected — match ended`;
      }
      if (key === "game.disconnect.matchAbandonedScores" && opts) {
        return `Final: Red ${opts.red} : Blue ${opts.blue}`;
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
    render(<ReconnectOverlay disconnectedPlayerName="Alice" reconnectExpiresAt={expiresAt} />);

    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    expect(screen.getByText(/wait for Alice to reconnect/)).toBeInTheDocument();
    expect(screen.getByTestId("reconnect-countdown")).toBeInTheDocument();
    // Should show roughly 2:00
    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("2:00");
  });

  it("countdown decrements over time", () => {
    const expiresAt = new Date(Date.now() + 65_000).toISOString(); // 65 seconds
    render(<ReconnectOverlay disconnectedPlayerName="Bob" reconnectExpiresAt={expiresAt} />);

    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("1:05");

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("0:55");
  });

  it("countdown stops at zero", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString(); // already expired
    render(<ReconnectOverlay disconnectedPlayerName="Carol" reconnectExpiresAt={expiresAt} />);

    expect(screen.getByTestId("reconnect-countdown").textContent).toBe("0:00");
  });

  it("has correct accessibility attributes", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    render(<ReconnectOverlay disconnectedPlayerName="Dave" reconnectExpiresAt={expiresAt} />);

    const overlay = screen.getByTestId("reconnect-overlay");
    expect(overlay).toHaveAttribute("aria-live", "assertive");
  });

  it("renders abandonment message when abandonedData is provided", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    const abandonedData = {
      abandonedByPlayer: 2,
      redFinalScore: 450,
      blueFinalScore: 380,
      matchDurationSec: 600,
    };

    render(
      <ReconnectOverlay
        disconnectedPlayerName="Eve"
        reconnectExpiresAt={expiresAt}
        abandonedData={abandonedData}
        onReturnToLobby={vi.fn()}
      />,
    );

    expect(screen.getByTestId("abandon-title")).toHaveTextContent("Eve disconnected — match ended");
    expect(screen.getByTestId("abandon-scores")).toHaveTextContent("Final: Red 450 : Blue 380");
    expect(screen.getByText("Returning to lobby...")).toBeInTheDocument();
    // Countdown should NOT be visible
    expect(screen.queryByTestId("reconnect-countdown")).not.toBeInTheDocument();
  });

  it("auto-redirects to lobby after 3 seconds when abandoned", () => {
    const onReturnToLobby = vi.fn();
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    const abandonedData = {
      abandonedByPlayer: 0,
      redFinalScore: 200,
      blueFinalScore: 300,
      matchDurationSec: 120,
    };

    render(
      <ReconnectOverlay
        disconnectedPlayerName="Frank"
        reconnectExpiresAt={expiresAt}
        abandonedData={abandonedData}
        onReturnToLobby={onReturnToLobby}
      />,
    );

    expect(onReturnToLobby).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onReturnToLobby).toHaveBeenCalledOnce();
  });

  it("does not auto-redirect without abandonedData", () => {
    const onReturnToLobby = vi.fn();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    render(
      <ReconnectOverlay
        disconnectedPlayerName="Grace"
        reconnectExpiresAt={expiresAt}
        onReturnToLobby={onReturnToLobby}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onReturnToLobby).not.toHaveBeenCalled();
    expect(screen.getByTestId("reconnect-countdown")).toBeInTheDocument();
  });
});
