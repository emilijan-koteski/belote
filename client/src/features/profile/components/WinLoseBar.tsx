type WinLoseBarProps = {
  /** Win share 0–100; the remainder renders as the loss segment. */
  winPct: number;
};

/**
 * Two-segment ratio bar: solid felt-green for the win share reads as "filled",
 * while the loss share is a soft translucent red — it indicates the remainder
 * without clashing with the green. Together they fill the track.
 */
export function WinLoseBar({ winPct }: WinLoseBarProps) {
  const win = Math.max(0, Math.min(100, winPct));
  return (
    <div
      className="flex h-1.5 overflow-hidden rounded-full"
      style={{ background: "var(--surface-3)" }}
    >
      <span className="block h-full" style={{ width: `${win}%`, background: "var(--accent)" }} />
      <span
        className="block h-full"
        style={{ width: `${100 - win}%`, background: "rgba(139,42,31,0.18)" }}
      />
    </div>
  );
}
