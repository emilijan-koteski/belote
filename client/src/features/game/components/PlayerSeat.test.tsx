import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlayerState } from "@/shared/types/gameTypes";

import { PlayerSeat } from "./PlayerSeat";

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    hand: [],
    seat: 0,
    userId: 10,
    username: "Alice",
    team: "teamA",
    declarations: [],
    connected: true,
    ...overrides,
  };
}

describe("PlayerSeat", () => {
  it("renders empty seat with 'Waiting...' text when player is null", () => {
    render(<PlayerSeat player={null} isSelf={false} isActive={false} team="teamA" />);

    expect(screen.getByText("Waiting...")).toBeInTheDocument();
  });

  it("renders occupied seat with username, team-a border, and data-team='teamA'", () => {
    const { container } = render(
      <PlayerSeat
        player={makePlayer({ username: "Bob" })}
        isSelf={false}
        isActive={false}
        team="teamA"
      />,
    );

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("border-team-a");
    expect(container.firstChild).toHaveAttribute("data-team", "teamA");
  });

  it("renders teamB border and data-team='teamB' correctly", () => {
    const { container } = render(
      <PlayerSeat
        player={makePlayer({ team: "teamB" })}
        isSelf={false}
        isActive={false}
        team="teamB"
      />,
    );

    expect(container.firstChild).toHaveClass("border-team-b");
    expect(container.firstChild).toHaveAttribute("data-team", "teamB");
  });

  it("renders active state with accent border and pulse animation class", () => {
    const { container } = render(
      <PlayerSeat player={makePlayer()} isSelf={false} isActive={true} team="teamA" />,
    );

    expect(container.firstChild).toHaveClass("border-accent");
    expect(container.firstChild).toHaveClass("motion-safe:animate-pulse");
  });

  it("renders self seat with 'You' badge and scale-110", () => {
    const { container } = render(
      <PlayerSeat player={makePlayer()} isSelf={true} isActive={false} team="teamA" />,
    );

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("scale-110");
  });

  it("has correct aria-label including username, team, and active state", () => {
    const { container } = render(
      <PlayerSeat
        player={makePlayer({ username: "Alice" })}
        isSelf={false}
        isActive={true}
        team="teamA"
      />,
    );

    expect(container.firstChild).toHaveAttribute("aria-label", "Alice, Team A, active");
  });

  it("has correct aria-label for waiting state", () => {
    const { container } = render(
      <PlayerSeat
        player={makePlayer({ username: "Bob" })}
        isSelf={false}
        isActive={false}
        team="teamB"
      />,
    );

    expect(container.firstChild).toHaveAttribute("aria-label", "Bob, Team B, waiting");
  });

  it("shows card count for non-self occupied seats", () => {
    render(
      <PlayerSeat
        player={makePlayer()}
        isSelf={false}
        isActive={false}
        team="teamA"
        cardCount={8}
      />,
    );

    expect(screen.getByText(/×8/)).toBeInTheDocument();
  });

  it("renders avatar with initial from username", () => {
    render(
      <PlayerSeat
        player={makePlayer({ username: "Charlie" })}
        isSelf={false}
        isActive={false}
        team="teamA"
      />,
    );

    expect(screen.getByText("C")).toBeInTheDocument();
  });
});
