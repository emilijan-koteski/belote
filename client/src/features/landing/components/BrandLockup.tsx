import { cn } from "@/shared/lib/utils";

// Logo tile (the shared /beljot-logo.svg, same asset the app TopBar uses) +
// "Beljot" wordmark. The wordmark uses `text-ink`, so it auto-flips to light
// inside a `.felt-surface` and stays dark on parchment.

type BrandLockupProps = {
  size?: number;
  wordmarkSize?: number;
  className?: string;
};

export function BrandLockup({ size = 34, wordmarkSize = 22, className }: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/beljot-logo.svg"
        alt=""
        aria-hidden="true"
        className="shrink-0"
        style={{ width: size, height: size }}
      />
      <span
        className="font-display text-ink font-semibold tracking-[-0.3px]"
        style={{ fontSize: wordmarkSize }}
      >
        Beljot
      </span>
    </div>
  );
}
