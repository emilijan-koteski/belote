import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";

// The landing's single primary action — a felt-green/lime CTA rendered as a
// router <Link> (so it can sit inside anchors without nesting a <button>).
// Colour + glow come from tokens (`--accent`, `--accent-glow`), so inside a
// `.felt-surface` it auto-themes to lime with a lime glow.

type LandingCtaProps = {
  to: string;
  children: ReactNode;
  size?: "md" | "lg";
  testId?: string;
  className?: string;
};

export function LandingCta({ to, children, size = "md", testId, className }: LandingCtaProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        "bg-accent text-accent-ink inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
        "transition-[transform,box-shadow,background-color] hover:-translate-y-px hover:bg-accent-deep",
        "shadow-[0_14px_34px_-14px_var(--accent-glow)] hover:shadow-[0_18px_40px_-16px_var(--accent-glow)]",
        "focus-visible:ring-accent/50 outline-none focus-visible:ring-3",
        size === "lg" ? "px-8 py-4 text-[17px]" : "px-6 py-3.5 text-[15px]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
