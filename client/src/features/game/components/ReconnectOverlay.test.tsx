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
        "game.disconnect.matchEnded": "Match has ended",
        "game.disconnect.reconnectFailed": "Reconnection failed — the match may have ended",
        "game.matchResult.title": "Match Complete",
        "team.us": "Us",
        "team.them": "Them",
      };
      if (key === "game.disconnect.waitingMessage" && opts?.player) {
        return `The game is on hold while we wait for ${opts.player} to reconnect.`;
      }
      if (key === "game.disconnect.matchAbandoned" && opts?.player) {
        return `${opts.player} disconnected — match ended`;
      }
      if (key === "game.disconnect.matchAbandonedScores" && opts) {
        return `Final: Us ${opts.us} : Them ${opts.them}`;
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

  it("falls back to a 'match ended' panel when the window expired without an abandon event", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString(); // already expired
    render(<ReconnectOverlay disconnectedPlayerName="Carol" reconnectExpiresAt={expiresAt} />);

    // Countdown is replaced by the match-ended fallback view, so the user
    // isn't stuck on a 0:00 timer when the server already tore down the
    // session and the abandon broadcast never reached this client.
    expect(screen.queryByTestId("reconnect-countdown")).not.toBeInTheDocument();
    expect(screen.getByTestId("match-ended-title")).toBeInTheDocument();
    expect(screen.getByText("Returning to lobby...")).toBeInTheDocument();
  });

  it("auto-redirects to lobby when the reconnect window expires without an abandon event", () => {
    const onReturnToLobby = vi.fn();
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    render(
      <ReconnectOverlay
        disconnectedPlayerName="Henry"
        reconnectExpiresAt={expiresAt}
        onReturnToLobby={onReturnToLobby}
      />,
    );

    expect(onReturnToLobby).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onReturnToLobby).toHaveBeenCalledOnce();
  });

  it("has correct accessibility attributes", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    render(<ReconnectOverlay disconnectedPlayerName="Dave" reconnectExpiresAt={expiresAt} />);

    const overlay = screen.getByTestId("reconnect-overlay");
    expect(overlay).toHaveAttribute("aria-live", "assertive");
  });

  it("renders abandonment message viewer-relative when abandonedData is provided (viewer teamA)", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    const abandonedData = {
      abandonedByPlayer: 2,
      teamAFinalScore: 450,
      teamBFinalScore: 380,
      matchDurationSec: 600,
    };

    render(
      <ReconnectOverlay
        disconnectedPlayerName="Eve"
        reconnectExpiresAt={expiresAt}
        abandonedData={abandonedData}
        viewerTeam="teamA"
        onReturnToLobby={vi.fn()}
      />,
    );

    expect(screen.getByTestId("abandon-title")).toHaveTextContent("Eve disconnected — match ended");
    // Viewer on teamA → Us=450 (a), Them=380 (b)
    expect(screen.getByTestId("abandon-scores")).toHaveTextContent("Final: Us 450 : Them 380");
    expect(screen.getByText("Returning to lobby...")).toBeInTheDocument();
    // Countdown should NOT be visible
    expect(screen.queryByTestId("reconnect-countdown")).not.toBeInTheDocument();
  });

  it("flips abandonment scores when viewer is on teamB", () => {
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    const abandonedData = {
      abandonedByPlayer: 2,
      teamAFinalScore: 450,
      teamBFinalScore: 380,
      matchDurationSec: 600,
    };

    render(
      <ReconnectOverlay
        disconnectedPlayerName="Eve"
        reconnectExpiresAt={expiresAt}
        abandonedData={abandonedData}
        viewerTeam="teamB"
        onReturnToLobby={vi.fn()}
      />,
    );

    // Viewer on teamB → Us=380 (b), Them=450 (a)
    expect(screen.getByTestId("abandon-scores")).toHaveTextContent("Final: Us 380 : Them 450");
  });

  it("auto-redirects to lobby after 3 seconds when abandoned", () => {
    const onReturnToLobby = vi.fn();
    const expiresAt = new Date(Date.now() - 5000).toISOString();
    const abandonedData = {
      abandonedByPlayer: 0,
      teamAFinalScore: 200,
      teamBFinalScore: 300,
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

  it("renders one chip per disconnected player when multiple are offline", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    render(
      <ReconnectOverlay
        disconnectedPlayerName="Alice"
        disconnectedPlayerNames={["Alice", "Bob"]}
        reconnectExpiresAt={expiresAt}
      />,
    );

    const chipContainer = screen.getByTestId("reconnect-player-name");
    expect(chipContainer).toHaveTextContent("Alice");
    expect(chipContainer).toHaveTextContent("Bob");
  });

  it("falls back to a single chip when disconnectedPlayerNames is omitted", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    render(<ReconnectOverlay disconnectedPlayerName="Solo" reconnectExpiresAt={expiresAt} />);

    const chipContainer = screen.getByTestId("reconnect-player-name");
    expect(chipContainer).toHaveTextContent("Solo");
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
