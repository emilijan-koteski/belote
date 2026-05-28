// Single shared 30-second tick. RelativeTime components subscribe via
// `useSyncExternalStore` so the whole tree re-evaluates "5m ago" → "6m ago"
// from one timer — not one timer per displayed timestamp.

const TICK_INTERVAL_MS = 30_000;

let tick = 0;
const subscribers = new Set<() => void>();
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function ensureRunning() {
  if (intervalHandle !== null) return;
  if (typeof window === "undefined") return; // server / SSR / tests with no DOM
  intervalHandle = setInterval(() => {
    tick = (tick + 1) | 0; // wrap rather than overflow
    for (const cb of subscribers) cb();
  }, TICK_INTERVAL_MS);
}

export function subscribeTimeTick(cb: () => void): () => void {
  subscribers.add(cb);
  ensureRunning();
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
}

export function getTimeTick(): number {
  return tick;
}
