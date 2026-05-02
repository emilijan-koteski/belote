import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReducedMotion } from "./useReducedMotion";

type ChangeListener = (event: MediaQueryListEvent) => void;

interface MediaQueryListMock {
  matches: boolean;
  media: string;
  onchange: ChangeListener | null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
  __fire: (matches: boolean) => void;
}

function buildMediaQueryListMock(initial: boolean): MediaQueryListMock {
  const listeners = new Set<ChangeListener>();
  const mql: MediaQueryListMock = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: ChangeListener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: ChangeListener) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    __fire: (matches: boolean) => {
      mql.matches = matches;
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
  return mql;
}

let currentMql: MediaQueryListMock | null = null;

beforeEach(() => {
  currentMql = null;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => {
      const mql = buildMediaQueryListMock(false);
      mql.media = query;
      currentMql = mql;
      return mql;
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReducedMotion", () => {
  it("returns false when prefers-reduced-motion does not match", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion matches at mount", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => {
        const mql = buildMediaQueryListMock(true);
        mql.media = query;
        currentMql = mql;
        return mql;
      }),
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("updates when the media query change event fires", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      currentMql?.__fire(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      currentMql?.__fire(false);
    });
    expect(result.current).toBe(false);
  });

  it("removes its listener on unmount", () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(currentMql?.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(currentMql?.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
