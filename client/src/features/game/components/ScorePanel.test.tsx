import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "game.score.red": "Red",
        "game.score.blue": "Blue",
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
  it("renders team scores with correct labels", () => {
    render(<ScorePanel redScore={450} blueScore={320} redTricks={3} blueTricks={2} />);

    expect(screen.getByTestId("score-panel")).toBeInTheDocument();
    expect(screen.getByTestId("score-red")).toHaveTextContent("450");
    expect(screen.getByTestId("score-blue")).toHaveTextContent("320");
    expect(screen.getByTestId("score-label-red")).toHaveTextContent("Red");
    expect(screen.getByTestId("score-label-blue")).toHaveTextContent("Blue");
  });

  it("renders trick count", () => {
    render(<ScorePanel redScore={0} blueScore={0} redTricks={5} blueTricks={3} />);

    expect(screen.getByTestId("score-tricks")).toHaveTextContent("Tricks: 5 - 3");
  });

  it("has aria-live polite for accessibility", () => {
    render(<ScorePanel redScore={0} blueScore={0} redTricks={0} blueTricks={0} />);

    expect(screen.getByTestId("score-panel")).toHaveAttribute("aria-live", "polite");
  });

  it("applies transition classes for counter animation on score elements", () => {
    render(<ScorePanel redScore={100} blueScore={200} redTricks={0} blueTricks={0} />);

    const redScore = screen.getByTestId("score-red");
    expect(redScore.className).toContain("motion-safe:transition-all");
    expect(redScore.className).toContain("motion-safe:duration-300");
  });

  it("shows float-up bonus when lastTrickBonus prop is provided", () => {
    render(
      <ScorePanel
        redScore={100}
        blueScore={200}
        redTricks={4}
        blueTricks={4}
        lastTrickBonus={10}
        lastTrickTeam={0}
      />,
    );

    expect(screen.getByTestId("score-bonus")).toHaveTextContent("+10");
  });

  it("hides both potential lines when hand potentials are zero", () => {
    render(
      <ScorePanel
        redScore={100}
        blueScore={200}
        redTricks={0}
        blueTricks={0}
        redHandPotential={0}
        blueHandPotential={0}
      />,
    );

    expect(screen.queryByTestId("score-red-potential")).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-blue-potential")).not.toBeInTheDocument();
  });

  it("shows red potential line with summed hand points + declarations", () => {
    render(
      <ScorePanel
        redScore={100}
        blueScore={200}
        redTricks={2}
        blueTricks={1}
        redHandPotential={12}
        blueHandPotential={0}
      />,
    );

    const potential = screen.getByTestId("score-red-potential");
    expect(potential).toHaveTextContent("+12 this hand");
    expect(screen.queryByTestId("score-blue-potential")).not.toBeInTheDocument();
  });

  it("shows each team's potential independently", () => {
    render(
      <ScorePanel
        redScore={100}
        blueScore={200}
        redTricks={2}
        blueTricks={1}
        redHandPotential={12}
        blueHandPotential={64}
      />,
    );

    expect(screen.getByTestId("score-red-potential")).toHaveTextContent("+12 this hand");
    expect(screen.getByTestId("score-blue-potential")).toHaveTextContent("+64 this hand");
  });

  it("omits potential lines when props are not passed at all (default zero)", () => {
    render(<ScorePanel redScore={50} blueScore={50} redTricks={0} blueTricks={0} />);

    expect(screen.queryByTestId("score-red-potential")).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-blue-potential")).not.toBeInTheDocument();
  });
});
