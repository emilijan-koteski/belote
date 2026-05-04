import { useEffect, useState } from "react";

import { MOTION } from "@/shared/lib/motion";

interface TimerRingProps {
  turnExpiresAt: string | null;
  totalDuration: number; // total timer duration in seconds (for ring progress)
  size?: "seat" | "button";
}

const SIZE_CONFIG = {
  // 70px sits inside the avatar's 80px outer frame (avatar 64 + 16 padding)
  // so the countdown traces *just inside* the gold/silver team ring rather
  // than around it. Combined with the active-state outer lime ring on the
  // frame's box-shadow, this gives a 3-band stack: outer lime · gold ·
  // inner lime timer.
  seat: { px: 70, strokeWidth: 2.5, labelClass: "text-xs" },
  button: { px: 36, strokeWidth: 2, labelClass: "text-[10px]" },
} as const;

// Urgency threshold expressed as a fraction of `totalDuration`. When ≤25% of
// the turn timer remains, the ring + label flip from lime to red. The flip is
// independent of team identity (Gold/Silver carry that channel separately).
const URGENT_FRACTION = 0.25;

const COLOR_LIME = "var(--turn-lime, #00e5a0)";
const COLOR_URGENT = "var(--turn-urgent, #ef4444)";

/**
 * SVG countdown ring around the active player's avatar (or wrapped around an
 * action button via `size="button"`).
 *
 * Color channel:
 *  • lime  → plenty of time
 *  • red   → ≤25% of `totalDuration` remains, including 0s (expired)
 *
 * The ring transitions stroke + dashoffset on a 1s linear sweep so the
 * countdown reads continuously rather than ticking. A drop-shadow glow on the
 * progress arc lifts it off the felt without needing a second stroke.
 */
export function TimerRing({ turnExpiresAt, totalDuration, size = "seat" }: TimerRingProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!turnExpiresAt) {
      setSecondsLeft(0);
      return;
    }

    function computeRemaining() {
      const expiryMs = new Date(turnExpiresAt!).getTime();
      const remaining = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      return remaining;
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

  if (!turnExpiresAt) {
    return null;
  }

  const { px, strokeWidth, labelClass } = SIZE_CONFIG[size];
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalDuration > 0 ? Math.min(1, Math.max(0, secondsLeft / totalDuration)) : 0;
  const dashOffset = circumference * (1 - progress);

  // Single threshold: under URGENT_FRACTION of the original duration the ring
  // flips to red. 0s remaining still reads as red because progress = 0.
  const isUrgent = totalDuration > 0 && progress <= URGENT_FRACTION;
  const strokeColor = isUrgent ? COLOR_URGENT : COLOR_LIME;
  // Pulse the ring while urgent so the urgency reads even at a glance. Only
  // applied while the timer hasn't fully expired so a parked 0 doesn't
  // pulsate forever in edge cases.
  const pulseClass = isUrgent && secondsLeft > 0 ? "motion-safe:animate-pulse" : "";

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none ${pulseClass}`}
      data-testid="timer-ring"
      data-size={size}
      data-urgent={isUrgent ? "true" : "false"}
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <svg
        width={px}
        height={px}
        className="motion-safe:transition-all motion-safe:duration-1000 motion-reduce:transition-none"
      >
        {/* Background ring */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring — drop-shadow glow lifts the arc off the felt */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
          style={{
            filter: `drop-shadow(0 0 8px ${strokeColor})`,
            transition: `stroke-dashoffset ${MOTION.COUNTDOWN_TICK}ms linear, stroke ${MOTION.RING_COLOR_FLIP}ms ease`,
          }}
          className="motion-reduce:transition-none"
        />
      </svg>
      <span
        className={`absolute font-body font-semibold tabular-nums ${labelClass}`}
        style={{ color: strokeColor, transition: `color ${MOTION.RING_COLOR_FLIP}ms ease` }}
        data-testid="timer-seconds"
      >
        {secondsLeft}
      </span>
    </div>
  );
}
