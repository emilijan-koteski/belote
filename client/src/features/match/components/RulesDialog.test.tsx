import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n/i18n";

import { RulesDialog } from "./RulesDialog";

beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("RulesDialog (in-game)", () => {
  it("renders nothing when closed", () => {
    render(<RulesDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId("rules-dialog")).not.toBeInTheDocument();
  });

  it("renders the full rules reference with a chapter index", () => {
    render(<RulesDialog open onOpenChange={() => {}} />);

    expect(screen.getByTestId("rules-dialog")).toBeInTheDocument();
    expect(screen.getByText("Beljot rules")).toBeInTheDocument();
    // Chapter index entries for all six chapters.
    expect(screen.getByTestId("rules-toc-goal")).toHaveTextContent("The goal");
    expect(screen.getByTestId("rules-toc-scoring")).toHaveTextContent("Scoring");
    // Content: a chapter heading, a card value, and a declaration.
    expect(
      screen.getByRole("heading", { name: "Trump plays by its own rules" }),
    ).toBeInTheDocument();
    const carreJ = screen.getByTestId("rules-meld-carreJ");
    expect(within(carreJ).getByText("Carré of Jacks")).toBeInTheDocument();
    expect(within(carreJ).getByText("+200")).toBeInTheDocument();
  });

  it("does not render a language toggle", () => {
    render(<RulesDialog open onOpenChange={() => {}} />);
    const dialog = screen.getByTestId("rules-dialog");
    // The design's per-dialog en/mk switch is intentionally gone — language is
    // set in game settings.
    expect(within(dialog).queryByRole("button", { name: /^mk$/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^en$/i })).not.toBeInTheDocument();
  });

  it("closes via the footer button", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<RulesDialog open onOpenChange={onOpenChange} />);
    await user.click(screen.getByTestId("rules-dialog-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("jumps to a chapter from the index", async () => {
    const user = userEvent.setup();
    render(<RulesDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByTestId("rules-toc-melds"));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("renders Macedonian content when that locale is active", async () => {
    render(<RulesDialog open onOpenChange={() => {}} />);
    await act(async () => {
      await i18n.changeLanguage("mk");
    });
    expect(screen.getByText("Правила на Бељот")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Адутот игра по свои правила" }),
    ).toBeInTheDocument();
  });
});
