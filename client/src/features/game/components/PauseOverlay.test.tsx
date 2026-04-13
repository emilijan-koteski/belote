import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PauseOverlay } from "./PauseOverlay";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "game.pause.title": "Game Paused",
        "game.pause.resume": "Resume",
        "game.pause.pauseButton": "Pause",
        "game.pause.waitingToResume": "Waiting for players to resume...",
      };
      if (key === "game.pause.pausedBy" && opts?.player) {
        return `${opts.player} paused the game`;
      }
      return translations[key] ?? key;
    },
  }),
}));

const mockPlayers = [
  { hand: [], seat: 0, userId: 1, username: "Alice", team: "red", declarations: [], connected: true },
  { hand: [], seat: 1, userId: 2, username: "Bob", team: "blue", declarations: [], connected: true },
  { hand: [], seat: 2, userId: 3, username: "Carol", team: "red", declarations: [], connected: true },
  { hand: [], seat: 3, userId: 4, username: "Dave", team: "blue", declarations: [], connected: true },
] as PauseOverlayProps["players"];

type PauseOverlayProps = Parameters<typeof PauseOverlay>[0];

const defaultPauseUsed: [boolean, boolean, boolean, boolean] = [false, false, false, false];

describe("PauseOverlay", () => {
  it("renders paused player names", () => {
    render(
      <PauseOverlay
        pausedPlayers={[true, false, false, false]}
        pauseUsed={[true, false, false, false]}
        players={mockPlayers}
        myPlayerSeat={1}
        onResume={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice paused the game")).toBeInTheDocument();
    expect(screen.getByText("Game Paused")).toBeInTheDocument();
  });

  it("shows Resume button for player who paused", () => {
    render(
      <PauseOverlay
        pausedPlayers={[true, false, false, false]}
        pauseUsed={[true, false, false, false]}
        players={mockPlayers}
        myPlayerSeat={0}
        onResume={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("pause-resume-button")).toBeInTheDocument();
  });

  it("shows Pause button for player who can stack their pause", () => {
    render(
      <PauseOverlay
        pausedPlayers={[true, false, false, false]}
        pauseUsed={[true, false, false, false]}
        players={mockPlayers}
        myPlayerSeat={2}
        onResume={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("pause-resume-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("pause-stack-button")).toBeInTheDocument();
  });

  it("shows waiting message for player who already used their pause", () => {
    render(
      <PauseOverlay
        pausedPlayers={[true, false, false, false]}
        pauseUsed={[true, false, true, false]}
        players={mockPlayers}
        myPlayerSeat={2}
        onResume={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("pause-resume-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pause-stack-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("pause-waiting")).toBeInTheDocument();
  });

  it("fires onResume on Resume button click", () => {
    const onResume = vi.fn();
    render(
      <PauseOverlay
        pausedPlayers={[true, false, false, false]}
        pauseUsed={[true, false, false, false]}
        players={mockPlayers}
        myPlayerSeat={0}
        onResume={onResume}
        onPause={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("pause-resume-button"));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("fires onPause on stack Pause button click", () => {
    const onPause = vi.fn();
    render(
      <PauseOverlay
        pausedPlayers={[true, false, false, false]}
        pauseUsed={[true, false, false, false]}
        players={mockPlayers}
        myPlayerSeat={1}
        onResume={vi.fn()}
        onPause={onPause}
      />,
    );
    fireEvent.click(screen.getByTestId("pause-stack-button"));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("shows multiple paused players", () => {
    render(
      <PauseOverlay
        pausedPlayers={[true, false, true, false]}
        pauseUsed={[true, false, true, false]}
        players={mockPlayers}
        myPlayerSeat={1}
        onResume={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("pause-player-0")).toBeInTheDocument();
    expect(screen.getByTestId("pause-player-2")).toBeInTheDocument();
  });
});
