import "@/shared/i18n/i18n";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGameStore } from "@/shared/stores/gameStore";
import { EMOTE_IDS } from "@/shared/types/wsEvents";

import { EmotePickerButton } from "./EmotePickerButton";

describe("EmotePickerButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Advance fake `performance.now()` past 0 so the spec's
    // `lastEmoteSentAt: 0` "no emote sent" sentinel is distinguishable from
    // a real stamp. With sinon fake-timers, `performance.now()` measures
    // elapsed fake-ms (not absolute time), so it starts at 0 unconditionally.
    vi.advanceTimersByTime(100_000);
    // Cooldown lives on gameStore (lifted out of local useState in AC8) so
    // the store must be reset between tests to avoid cross-test bleed.
    useGameStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the toggle button hidden initially", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);
    expect(screen.getByTestId("emote-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("emote-picker")).not.toBeInTheDocument();
  });

  it("opens the picker grid on toggle click", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);

    fireEvent.click(screen.getByTestId("emote-toggle"));

    expect(screen.getByTestId("emote-picker")).toBeInTheDocument();
    // All six tiles render in the deterministic order defined by EMOTE_IDS.
    for (const id of EMOTE_IDS) {
      expect(screen.getByTestId(`emote-tile-${id}`)).toBeInTheDocument();
    }
  });

  it("renders tiles in the same order as EMOTE_IDS", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);
    fireEvent.click(screen.getByTestId("emote-toggle"));

    const tiles = screen
      .getByTestId("emote-picker")
      .querySelectorAll("[data-testid^='emote-tile-']");
    const renderedOrder = Array.from(tiles).map((el) =>
      (el.getAttribute("data-testid") ?? "").replace("emote-tile-", ""),
    );
    expect(renderedOrder).toEqual([...EMOTE_IDS]);
  });

  it("calls onSend with the clicked emote id and closes the picker", () => {
    const onSend = vi.fn();
    render(<EmotePickerButton onSend={onSend} />);

    fireEvent.click(screen.getByTestId("emote-toggle"));
    fireEvent.click(screen.getByTestId("emote-tile-clap"));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("clap");
    // Picker closes immediately after send (no waiting for server echo).
    expect(screen.queryByTestId("emote-picker")).not.toBeInTheDocument();
  });

  it("does not fire onSend a second time within the 3 s cooldown", () => {
    const onSend = vi.fn();
    render(<EmotePickerButton onSend={onSend} />);

    fireEvent.click(screen.getByTestId("emote-toggle"));
    fireEvent.click(screen.getByTestId("emote-tile-thumbs_up"));
    expect(onSend).toHaveBeenCalledTimes(1);

    // Re-open picker — tiles should be disabled while cooldown is active.
    fireEvent.click(screen.getByTestId("emote-toggle"));
    const laughTile = screen.getByTestId("emote-tile-laugh");
    expect(laughTile).toBeDisabled();
    fireEvent.click(laughTile);

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("re-enables tiles after the 3 s cooldown elapses", () => {
    const onSend = vi.fn();
    render(<EmotePickerButton onSend={onSend} />);

    fireEvent.click(screen.getByTestId("emote-toggle"));
    fireEvent.click(screen.getByTestId("emote-tile-thumbs_up"));
    expect(onSend).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3001);
    });

    fireEvent.click(screen.getByTestId("emote-toggle"));
    const laughTile = screen.getByTestId("emote-tile-laugh");
    expect(laughTile).not.toBeDisabled();
    fireEvent.click(laughTile);

    expect(onSend).toHaveBeenCalledTimes(2);
    expect(onSend).toHaveBeenLastCalledWith("laugh");
  });

  it("closes on Escape key", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);
    fireEvent.click(screen.getByTestId("emote-toggle"));
    expect(screen.getByTestId("emote-picker")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("emote-picker")).not.toBeInTheDocument();
  });

  it("closes on outside mouse click", () => {
    render(
      <div>
        <div data-testid="outside-zone" />
        <EmotePickerButton onSend={vi.fn()} />
      </div>,
    );

    fireEvent.click(screen.getByTestId("emote-toggle"));
    expect(screen.getByTestId("emote-picker")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside-zone"));

    expect(screen.queryByTestId("emote-picker")).not.toBeInTheDocument();
  });

  it("respects the disabled prop on the toggle", () => {
    render(<EmotePickerButton onSend={vi.fn()} disabled />);
    expect(screen.getByTestId("emote-toggle")).toBeDisabled();
  });

  it("focuses the first tile when the picker opens for keyboard users", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);
    fireEvent.click(screen.getByTestId("emote-toggle"));

    expect(document.activeElement).toBe(screen.getByTestId(`emote-tile-${EMOTE_IDS[0]}`));
  });

  it("moves focus across the tile grid with arrow keys (AC #1)", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);
    fireEvent.click(screen.getByTestId("emote-toggle"));

    const tiles = EMOTE_IDS.map((id) => screen.getByTestId(`emote-tile-${id}`));

    // Starts on tile 0 (auto-focused on open).
    expect(document.activeElement).toBe(tiles[0]);

    // ArrowRight wraps within the row, then to the next.
    fireEvent.keyDown(tiles[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tiles[1]);

    // ArrowDown moves vertically (idx + 3, with wrap).
    fireEvent.keyDown(tiles[1]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(tiles[4]);

    // ArrowLeft wraps backward.
    fireEvent.keyDown(tiles[4]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tiles[3]);

    // ArrowUp moves vertically (idx + 3 mod 6 = 0 from 3).
    fireEvent.keyDown(tiles[3]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(tiles[0]);
  });

  it("uses role=group on the popover, not role=dialog (non-modal)", () => {
    render(<EmotePickerButton onSend={vi.fn()} />);
    fireEvent.click(screen.getByTestId("emote-toggle"));

    const picker = screen.getByTestId("emote-picker");
    expect(picker).toHaveAttribute("role", "group");
    expect(picker).not.toHaveAttribute("role", "dialog");
  });

  it("preserves cooldown across remount (AC8)", () => {
    const onSend = vi.fn();
    const { unmount } = render(<EmotePickerButton onSend={onSend} />);

    // Send an emote — lastEmoteSentAt is stamped on the gameStore.
    fireEvent.click(screen.getByTestId("emote-toggle"));
    fireEvent.click(screen.getByTestId("emote-tile-thumbs_up"));
    expect(onSend).toHaveBeenCalledTimes(1);

    // Unmount the picker — phase transition (e.g., playing → match_end)
    // tears down EmotePickerButton in production. Cooldown must survive.
    unmount();

    // Remount before the cooldown elapses.
    render(<EmotePickerButton onSend={onSend} />);
    fireEvent.click(screen.getByTestId("emote-toggle"));
    const laughTile = screen.getByTestId("emote-tile-laugh");
    expect(laughTile).toBeDisabled();
    fireEvent.click(laughTile);

    // Still 1 — the freshly-mounted picker honored the in-store cooldown.
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
