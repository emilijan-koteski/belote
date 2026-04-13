import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { TimerRing } from "./TimerRing";

describe("TimerRing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when turnExpiresAt is null", () => {
    const { container } = render(
      <TimerRing turnExpiresAt={null} totalDuration={30} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders countdown from turnExpiresAt", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 25000); // 25 seconds from now

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    expect(screen.getByTestId("timer-ring")).toBeInTheDocument();
    const seconds = screen.getByTestId("timer-seconds");
    expect(Number(seconds.textContent)).toBeGreaterThanOrEqual(24);
    expect(Number(seconds.textContent)).toBeLessThanOrEqual(26);
  });

  it("displays text-secondary color when more than 10 seconds remain", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 20000); // 20 seconds

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const seconds = screen.getByTestId("timer-seconds");
    expect(seconds.style.color).toBe("var(--color-text-secondary)");
  });

  it("transitions to warning state at 10 seconds or less", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 8000); // 8 seconds

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const seconds = screen.getByTestId("timer-seconds");
    expect(seconds.style.color).toBe("var(--color-warning)");

    const ring = screen.getByTestId("timer-ring");
    expect(ring.className).toContain("motion-safe:animate-pulse");
  });

  it("shows destructive color when expired (0 seconds)", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() - 1000); // already expired

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const seconds = screen.getByTestId("timer-seconds");
    expect(seconds.style.color).toBe("var(--color-destructive)");
    expect(seconds.textContent).toBe("0");
  });

  it("decrements countdown over time", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 15000); // 15 seconds

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const seconds = screen.getByTestId("timer-seconds");
    const initialValue = Number(seconds.textContent);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const newValue = Number(seconds.textContent);
    expect(newValue).toBeLessThan(initialValue);
    expect(newValue).toBeGreaterThanOrEqual(initialValue - 4);
  });

  it("has accessible aria-label with seconds remaining", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 20000);

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const ring = screen.getByTestId("timer-ring");
    expect(ring.getAttribute("aria-label")).toMatch(/\d+ seconds remaining/);
  });

  it("does not have pulse class when not in warning state", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 20000); // 20 seconds, well above 10

    render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const ring = screen.getByTestId("timer-ring");
    expect(ring.className).not.toContain("motion-safe:animate-pulse");
  });

  it("uses motion-safe prefix for transitions (reduced-motion safe)", () => {
    const now = new Date();
    const expiry = new Date(now.getTime() + 5000); // warning state

    const { container } = render(
      <TimerRing turnExpiresAt={expiry.toISOString()} totalDuration={30} />
    );

    const svg = container.querySelector("svg");
    const svgClass = svg?.getAttribute("class") ?? "";
    expect(svgClass).toContain("motion-safe:");
    expect(svgClass).toContain("motion-reduce:");
  });
});
