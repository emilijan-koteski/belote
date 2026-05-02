import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "team.us": "Us",
        "team.them": "Them",
        "game.score.tricks": "Tricks",
        "game.score.thisHand": "this hand",
      };
      return translations[key] ?? key;
    },
  }),
}));

import { ScorePanel } from "./ScorePanel";

describe("ScorePanel", () => {
  beforeEach(() => {
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

  it("renders team scores with Us/Them labels for a teamA viewer", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={450}
        teamBScore={320}
        teamATricks={3}
        teamBTricks={2}
      />,
    );

    expect(screen.getByTestId("score-panel")).toBeInTheDocument();
    expect(screen.getByTestId("score-a")).toHaveTextContent("450");
    expect(screen.getByTestId("score-b")).toHaveTextContent("320");
    // Viewer is teamA, so the team-A row says "Us" and team-B says "Them"
    expect(screen.getByTestId("score-label-a")).toHaveTextContent("Us");
    expect(screen.getByTestId("score-label-b")).toHaveTextContent("Them");
  });

  it("renders Us/Them labels inverted for a teamB viewer", () => {
    render(
      <ScorePanel
        viewerTeam="teamB"
        teamAScore={450}
        teamBScore={320}
        teamATricks={3}
        teamBTricks={2}
      />,
    );

    expect(screen.getByTestId("score-label-a")).toHaveTextContent("Them");
    expect(screen.getByTestId("score-label-b")).toHaveTextContent("Us");
  });

  it("attaches data-team attributes on each row", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={1}
        teamBScore={2}
        teamATricks={0}
        teamBTricks={0}
      />,
    );

    expect(screen.getByTestId("score-row-a")).toHaveAttribute("data-team", "teamA");
    expect(screen.getByTestId("score-row-b")).toHaveAttribute("data-team", "teamB");
  });

  it("renders trick count", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={0}
        teamBScore={0}
        teamATricks={5}
        teamBTricks={3}
      />,
    );

    expect(screen.getByTestId("score-tricks")).toHaveTextContent("Tricks: 5 - 3");
  });

  it("has aria-live polite for accessibility", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={0}
        teamBScore={0}
        teamATricks={0}
        teamBTricks={0}
      />,
    );

    expect(screen.getByTestId("score-panel")).toHaveAttribute("aria-live", "polite");
  });

  it("applies transition classes for counter animation on score elements", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={100}
        teamBScore={200}
        teamATricks={0}
        teamBTricks={0}
      />,
    );

    const teamAScore = screen.getByTestId("score-a");
    expect(teamAScore.className).toContain("motion-safe:transition-all");
    expect(teamAScore.className).toContain("motion-safe:duration-300");
  });

  it("shows float-up bonus when lastTrickBonus prop is provided", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={100}
        teamBScore={200}
        teamATricks={4}
        teamBTricks={4}
        lastTrickBonus={10}
        lastTrickTeam={0}
      />,
    );

    const bonus = screen.getByTestId("score-bonus");
    expect(bonus).toHaveTextContent("+10");
    expect(bonus).toHaveAttribute("data-team", "teamA");
  });

  it("hides both potential lines when hand potentials are zero", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={100}
        teamBScore={200}
        teamATricks={0}
        teamBTricks={0}
        teamAHandPotential={0}
        teamBHandPotential={0}
      />,
    );

    expect(screen.queryByTestId("score-a-potential")).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-b-potential")).not.toBeInTheDocument();
  });

  it("shows team-A potential line with summed hand points + declarations", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={100}
        teamBScore={200}
        teamATricks={2}
        teamBTricks={1}
        teamAHandPotential={12}
        teamBHandPotential={0}
      />,
    );

    const potential = screen.getByTestId("score-a-potential");
    expect(potential).toHaveTextContent("+12 this hand");
    expect(screen.queryByTestId("score-b-potential")).not.toBeInTheDocument();
  });

  it("shows each team's potential independently", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={100}
        teamBScore={200}
        teamATricks={2}
        teamBTricks={1}
        teamAHandPotential={12}
        teamBHandPotential={64}
      />,
    );

    expect(screen.getByTestId("score-a-potential")).toHaveTextContent("+12 this hand");
    expect(screen.getByTestId("score-b-potential")).toHaveTextContent("+64 this hand");
  });

  it("omits potential lines when props are not passed at all (default zero)", () => {
    render(
      <ScorePanel
        viewerTeam="teamA"
        teamAScore={50}
        teamBScore={50}
        teamATricks={0}
        teamBTricks={0}
      />,
    );

    expect(screen.queryByTestId("score-a-potential")).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-b-potential")).not.toBeInTheDocument();
  });
});
