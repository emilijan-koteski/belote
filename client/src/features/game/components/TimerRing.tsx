import { useEffect, useState } from "react";

interface TimerRingProps {
  turnExpiresAt: string | null;
  totalDuration: number; // total timer duration in seconds (for ring progress)
  size?: "seat" | "button";
}

const SIZE_CONFIG = {
  seat: { px: 48, strokeWidth: 3, labelClass: "text-xs" },
  button: { px: 36, strokeWidth: 2, labelClass: "text-[10px]" },
} as const;

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
    }, 1000);

    return () => clearInterval(interval);
  }, [turnExpiresAt]);

  if (!turnExpiresAt) {
    return null;
  }

  const isWarning = secondsLeft <= 10;
  const isExpired = secondsLeft <= 0;

  const { px, strokeWidth, labelClass } = SIZE_CONFIG[size];
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalDuration > 0 ? Math.min(1, Math.max(0, secondsLeft / totalDuration)) : 0;
  const dashOffset = circumference * (1 - progress);

  const strokeColor = isExpired
    ? "var(--color-destructive)"
    : isWarning
      ? "var(--color-warning)"
      : "var(--color-text-secondary)";

  const pulseClass = isWarning && !isExpired ? "motion-safe:animate-pulse" : "";

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none ${pulseClass}`}
      data-testid="timer-ring"
      data-size={size}
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
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Progress ring */}
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
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span
        className={`absolute font-body font-semibold ${labelClass}`}
        style={{ color: strokeColor }}
        data-testid="timer-seconds"
      >
        {secondsLeft}
      </span>
    </div>
  );
}
