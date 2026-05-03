import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrollIntoView; stub it so any component that
// auto-scrolls (e.g., ChatPanel) does not crash in tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// jsdom does not ship a ResizeObserver — components that measure their own
// box (e.g. ButtonTimerRing tracing the wrapped action button) crash on
// `new ResizeObserver(...)` without this stub. The stub never fires; that's
// fine because the components fall back to a 0×0 measurement and skip the
// SVG draw, which is the same code path they take before the first layout
// effect commits in production.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
