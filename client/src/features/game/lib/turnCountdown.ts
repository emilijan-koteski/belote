import { useEffect, useState } from "react";

import { MOTION } from "@/shared/lib/motion";

/**
 * Subscribes to the per-second countdown derived from `turnExpiresAt`. Returns
 * `0` when `turnExpiresAt` is null or already past. Pulled out so [PlayerSeat]
 * can render the seconds outside the ring without forcing a second source of
 * truth — both consumers tick on the same `MOTION.COUNTDOWN_TICK` cadence.
 */
export function useTurnCountdown(turnExpiresAt: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!turnExpiresAt) {
      setSecondsLeft(0);
      return;
    }

    function computeRemaining() {
      const expiryMs = new Date(turnExpiresAt!).getTime();
      return Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
    }

    setSecondsLeft(computeRemaining());

    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, MOTION.COUNTDOWN_TICK);

    return () => clearInterval(interval);
  }, [turnExpiresAt]);

  return secondsLeft;
}

// Urgency threshold expressed as a fraction of `totalDuration`. When ≤1/8 of
// the turn timer remains, the ring + label flip from lime to red. The flip is
// independent of team identity (Gold/Silver carry that channel separately).
// Shared so ButtonTimerRing (and any future countdown widget) can stay in
// lockstep instead of redeclaring 0.125 as a magic literal.
export const URGENT_FRACTION = 0.125;

/**
 * Whether the countdown should read as urgent (≤1/8 of the total duration
 * remains, including 0). Shared so [PlayerSeat] colors the external label
 * the same way the ring does.
 */
export function isCountdownUrgent(secondsLeft: number, totalDuration: number): boolean {
  if (totalDuration <= 0) return false;
  const progress = Math.min(1, Math.max(0, secondsLeft / totalDuration));
  return progress <= URGENT_FRACTION;
}
