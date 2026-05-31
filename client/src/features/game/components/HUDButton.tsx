import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

export type HUDButtonVariant = "default" | "danger";

interface HUDButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional icon rendered to the left of the label. */
  icon?: ReactNode;
  /** When provided, the button widens to fit `icon + label`. Without it the
   * button stays a 36 px square (icon-only). */
  label?: ReactNode;
  /** `default` is the brass-bordered felt panel; `danger` swaps the border +
   * text to a soft red for destructive actions (Surrender). */
  variant?: HUDButtonVariant;
}

/**
 * Shared button style used across the in-game HUD: Pause, Surrender, Rules,
 * Settings. Glass-frosted `--panel-hud` background with a brass border so the
 * cluster reads as a single instrument tray rather than four loose chrome
 * pieces.
 */
export const HUDButton = forwardRef<HTMLButtonElement, HUDButtonProps>(function HUDButton(
  { icon, label, variant = "default", className = "", style, type = "button", ...rest },
  ref,
) {
  const isLabeled = label !== undefined && label !== null;

  // Inline styles drive the felt + brass chrome so the button reads correctly
  // regardless of where the consumer mounts it (inside or outside the
  // `.game-table` scope, e.g. inside Radix portals for confirm dialogs).
  const baseStyle: React.CSSProperties = {
    background: "var(--panel-hud, rgba(18,32,22,0.85))",
    border:
      variant === "danger" ? "1px solid rgba(255,120,120,0.3)" : "1px solid rgba(201,168,118,0.4)",
    color: variant === "danger" ? "#ff7676" : "var(--ink-light, #f5f2e8)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    padding: isLabeled ? "0 14px" : 0,
    gap: 8,
    fontFamily: "var(--font-body)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.3,
    ...style,
  };

  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:not-disabled:brightness-110 ${className}`}
      style={baseStyle}
      {...rest}
    >
      {icon}
      {isLabeled ? <span>{label}</span> : null}
    </button>
  );
});
