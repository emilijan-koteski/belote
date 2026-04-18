import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrollIntoView; stub it so any component that
// auto-scrolls (e.g., ChatPanel) does not crash in tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
