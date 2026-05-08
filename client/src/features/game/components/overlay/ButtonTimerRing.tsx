import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { MOTION } from "@/shared/lib/motion";

import { URGENT_FRACTION } from "../TimerRing";

interface ButtonTimerRingProps {
  /**
   * Either a wall-clock expiry (`turnExpiresAt` ISO string) **or** a
   * client-side countdown duration in seconds. Server-driven prompts use
   * `turnExpiresAt + totalDuration` so the ring stays in sync across clients;
   * client-side reveals (e.g. score continue) just pass `duration` instead.
   */
  turnExpiresAt?: string | null;
  /** Total ring duration in seconds — drives the dasharray sweep. */
  totalDuration: number;
  /**
   * When set without `turnExpiresAt`, the ring counts down purely client-side
   * from `totalDuration` to 0. Useful for non-server-bound timers.
   */
  clientCountdown?: boolean;
  /**
   * Callback fired the moment the ring reaches 0. Used by reveals that wrap
   * a Continue button — when the timer expires we auto-fire the action so an
   * AFK player doesn't get stuck on the reveal screen.
   */
  onExpire?: () => void;
  /** Corner radius of the wrapped button (in px). Default 8 (matches
   *  ClassicButton). */
  radius?: number;
  /** Reduced-motion hint — when true, skip the SVG rendering entirely. */
  hideRing?: boolean;
  children: ReactNode;
}

/**
 * Wraps a button with an SVG rounded-rect outline countdown that traces the
 * button's border, sweeping clockwise from the top.
 *
 * Two channels:
 *   • lime  → plenty of time
 *   • red   → ≤1/8 remaining (urgent — same threshold as PlayerSeat ring)
 *
 * The wrapper measures the wrapped button via ResizeObserver so the sweep
 * traces the actual button shape regardless of label width / padding.
 */
export function ButtonTimerRing({
  turnExpiresAt,
  totalDuration,
  clientCountdown = false,
  onExpire,
  radius = 8,
  hideRing = false,
  children,
}: ButtonTimerRingProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Two countdown sources — server expiry (stays in sync across clients) or
  // a client-only seconds counter.
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (turnExpiresAt) {
      const ms = new Date(turnExpiresAt).getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / 1000));
    }
    return clientCountdown ? totalDuration : totalDuration;
  });

  useEffect(() => {
    if (turnExpiresAt) {
      const tick = () => {
        const ms = new Date(turnExpiresAt).getTime() - Date.now();
        const remaining = Math.max(0, Math.ceil(ms / 1000));
        setSecondsLeft(remaining);
        return remaining;
      };
      tick();
      const id = setInterval(() => {
        const remaining = tick();
        if (remaining <= 0) clearInterval(id);
      }, MOTION.COUNTDOWN_TICK);
      return () => clearInterval(id);
    }
    if (clientCountdown) {
      setSecondsLeft(totalDuration);
      const id = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 0) {
            clearInterval(id);
            return 0;
          }
          return s - 1;
        });
      }, MOTION.COUNTDOWN_TICK);
      return () => clearInterval(id);
    }
  }, [turnExpiresAt, totalDuration, clientCountdown]);

  // Fire onExpire exactly once when secondsLeft hits 0.
  const expireFiredRef = useRef(false);
  useEffect(() => {
    if (secondsLeft <= 0 && !expireFiredRef.current && (turnExpiresAt || clientCountdown)) {
      expireFiredRef.current = true;
      onExpire?.();
    }
    if (secondsLeft > 0) expireFiredRef.current = false;
  }, [secondsLeft, onExpire, turnExpiresAt, clientCountdown]);

  // Re-measure the wrapped button so the SVG rect always matches the button's
  // actual painted size (the scene is also CSS-scaled, but offsetWidth gives
  // un-scaled px which is what stroke-dasharray needs).
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const pct = totalDuration > 0 ? Math.max(0, secondsLeft) / totalDuration : 0;
  const isUrgent = totalDuration > 0 && pct <= URGENT_FRACTION;
  // Cream / red palette to match the AutoCloseRing on info-toast X buttons
  // (the avatar's lime/red ring stays the primary turn signal — dialogs use
  // this softer pair so two countdown channels don't compete for attention).
  const stroke = isUrgent ? "var(--turn-urgent, #ef4444)" : "#d4d0c4";
  const pad = 4;
  const strokeW = 1.75;
  const w = size.w + pad * 2;
  const h = size.h + pad * 2;
  // Approximate rounded-rect perimeter — good enough for a visually consistent
  // dasharray, no need to be analytically perfect.
  const perim = 2 * (w + h) - 8 * radius + 2 * Math.PI * radius;

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      data-testid="button-timer-ring"
      data-urgent={isUrgent ? "true" : "false"}
    >
      {children}
      {!hideRing && size.w > 0 && (
        <svg
          width={w}
          height={h}
          aria-hidden
          style={{
            position: "absolute",
            top: -pad,
            left: -pad,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <rect
            x={strokeW / 2}
            y={strokeW / 2}
            width={w - strokeW}
            height={h - strokeW}
            rx={radius + pad - strokeW / 2}
            ry={radius + pad - strokeW / 2}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={strokeW}
          />
          <rect
            x={strokeW / 2}
            y={strokeW / 2}
            width={w - strokeW}
            height={h - strokeW}
            rx={radius + pad - strokeW / 2}
            ry={radius + pad - strokeW / 2}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={perim}
            strokeDashoffset={perim * (1 - pct)}
            style={{
              transition: `stroke-dashoffset ${MOTION.COUNTDOWN_TICK}ms linear, stroke ${MOTION.RING_COLOR_FLIP_FAST}ms ease-out`,
            }}
          />
        </svg>
      )}
    </div>
  );
}
