import { useEffect, useState } from "react";

interface TimerRingProps {
  turnExpiresAt: string | null;
  totalDuration: number; // total timer duration in seconds (for ring progress)
}

export function TimerRing({ turnExpiresAt, totalDuration }: TimerRingProps) {
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

  // SVG ring calculations
  const size = 48;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalDuration > 0 ? Math.min(1, Math.max(0, secondsLeft / totalDuration)) : 0;
  const dashOffset = circumference * (1 - progress);

  const strokeColor = isExpired
    ? "var(--color-destructive)"
    : isWarning
      ? "var(--color-warning)"
      : "var(--color-text-secondary)";

  const pulseClass = isWarning && !isExpired
    ? "motion-safe:animate-pulse"
    : "";

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none ${pulseClass}`}
      data-testid="timer-ring"
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <svg
        width={size}
        height={size}
        className="motion-safe:transition-all motion-safe:duration-1000 motion-reduce:transition-none"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span
        className="absolute text-xs font-body font-semibold"
        style={{ color: strokeColor }}
        data-testid="timer-seconds"
      >
        {secondsLeft}
      </span>
    </div>
  );
}
