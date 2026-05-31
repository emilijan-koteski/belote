import { cn } from "@/shared/lib/utils";

type DurationSliderProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unitLabel: string;
  rangeLabel?: string;
  presets?: number[];
  className?: string;
  testId?: string;
};

const DEFAULT_PRESETS = [15, 30, 60, 120];

/**
 * Discrete range slider for the per-move timer (10-120s, step 5s). The native
 * <input type="range"> sits over the painted track for full a11y + keyboard
 * + screen-reader value reporting. The track and thumb are CSS-painted to
 * match the brass→accent gradient fill from the design.
 */
export function DurationSlider({
  value,
  onChange,
  min = 10,
  max = 120,
  step = 5,
  unitLabel,
  rangeLabel,
  presets = DEFAULT_PRESETS,
  className,
  testId,
}: DurationSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const ticks: { v: number; preset: boolean }[] = [];
  for (let v = min; v <= max; v += 10) {
    ticks.push({ v, preset: presets.includes(v) });
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display text-ink text-[22px] leading-none font-bold tracking-[-0.6px] tabular-nums"
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </span>
          <span className="text-brass-deep font-mono text-[11px] font-semibold uppercase tracking-[1px]">
            {unitLabel}
          </span>
        </div>
        {rangeLabel && (
          <span className="text-ink-mute font-mono text-[10.5px] tracking-[0.4px]">
            {rangeLabel}
          </span>
        )}
      </div>

      <div className="bg-surface-elevated border-border relative rounded-[10px] border px-3 py-3.5">
        <div className="bg-surface-sunken border-border relative h-1.5 overflow-hidden rounded-[3px] border">
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--brass) 0%, var(--accent) 100%)",
            }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-0 bottom-0">
          {ticks.map(({ v, preset }) => {
            const tickPct = ((v - min) / (max - min)) * 100;
            return (
              <span
                key={v}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[1px]",
                  preset ? "bg-brass-deep opacity-70" : "bg-ink-off opacity-45",
                )}
                style={{
                  left: `${tickPct}%`,
                  width: preset ? 2 : 1,
                  height: preset ? 12 : 7,
                }}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          data-testid={testId}
          className="absolute inset-0 size-full cursor-pointer appearance-none bg-transparent outline-none focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--accent-soft)] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-[0_4px_12px_-4px_rgba(25,101,54,0.45),inset_0_0_0_3px_var(--accent)] [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-surface"
        />
      </div>
    </div>
  );
}
