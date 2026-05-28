import { Check } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Auth-page composable primitives — parchment card chrome that mirrors the
// design's <AuthCard>, <SuitRule>, <Field>, <AltLink>, <Checkbox> on the
// Lobby Style System. Colocated here because they're only used on /login
// and /register; promote to shared/ if a third consumer ever shows up.
// ─────────────────────────────────────────────────────────────────────────

type AuthCardProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * 440px parchment card with the design's signature top brass hairline,
 * micro-caps eyebrow, Space Grotesk display title, ink-dim subtitle and
 * suit-pip divider before the form content.
 */
export function AuthCard({ eyebrow, title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div
      className="bg-surface relative w-full max-w-[500px] rounded-[22px] border border-border px-10 pt-10 pb-8 shadow-[0_18px_44px_-28px_rgba(14,58,36,0.32),0_2px_0_rgba(255,255,255,0.6)_inset]"
      data-testid="auth-card"
    >
      {/* Top brass hairline accent */}
      <div
        aria-hidden="true"
        className="absolute -top-px right-7 left-7 h-0.5 bg-[linear-gradient(90deg,transparent,var(--brass)_50%,transparent)] opacity-70"
      />

      <div className="text-brass-deep mb-3 font-mono text-[11.5px] font-semibold tracking-[2.4px] uppercase">
        {eyebrow}
      </div>

      <h1 className="font-display text-ink m-0 text-[34px] leading-[1.1] font-bold tracking-[-0.8px]">
        {title}
      </h1>

      <p className="text-ink-dim mt-2.5 mb-5.5 max-w-[380px] text-[14.5px] leading-[1.55]">
        {subtitle}
      </p>

      <SuitRule />

      {children}

      {footer && <div className="mt-5.5">{footer}</div>}
    </div>
  );
}

/**
 * ♥ ♠ ♦ ♣ row divider — the in-game DNA dropped onto parchment. Suit glyphs
 * are forced to a serif font with the U+FE0E variation selector so they
 * render as text not emoji (which renders ~1.3× larger and breaks the row).
 */
export function SuitRule() {
  const glyphStyle: React.CSSProperties = {
    fontFamily: '"Times New Roman", "DejaVu Serif", serif',
    fontSize: 17,
    lineHeight: 1,
    display: "inline-block",
  };
  return (
    <div className="mt-1 mb-4.5 flex items-center gap-3.5" aria-hidden="true">
      <div className="bg-border h-px flex-1" />
      <div className="flex items-center gap-2.5 tracking-[1px]">
        <span style={{ ...glyphStyle, color: "var(--danger)" }}>{"♥︎"}</span>
        <span style={{ ...glyphStyle, color: "var(--ink)" }}>{"♠︎"}</span>
        <span style={{ ...glyphStyle, color: "var(--danger)" }}>{"♦︎"}</span>
        <span style={{ ...glyphStyle, color: "var(--ink)" }}>{"♣︎"}</span>
      </div>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  errorTestId?: string;
  children: React.ReactNode;
};

/**
 * Brass-deep micro-caps label + optional right-aligned hint slot + the
 * input + an inline error message. The label flips to `--danger` when the
 * field carries an error.
 */
export function Field({ label, htmlFor, hint, error, errorTestId, children }: FieldProps) {
  const hasError = Boolean(error);
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={htmlFor}
          className={cn(
            "font-mono text-[11px] font-semibold tracking-[1.8px] uppercase transition-colors",
            hasError ? "text-destructive" : "text-brass-deep",
          )}
        >
          {label}
        </label>
        {hint && (
          <span className="text-ink-mute text-[11.5px] font-medium tracking-[0.5px] normal-case">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-destructive text-xs leading-[1.4] font-medium" data-testid={errorTestId}>
          {error}
        </p>
      )}
    </div>
  );
}

type AltLinkProps = {
  prompt: string;
  cta: string;
  to: string;
  testId?: string;
};

/**
 * Bottom prompt + accent link to the alternate auth page
 * ("New to Beljot? Create an account" / "Already have an account? Log in").
 */
export function AltLink({ prompt, cta, to, testId }: AltLinkProps) {
  return (
    <div className="text-ink-dim text-center text-[13.5px]">
      {prompt}{" "}
      <Link
        to={to}
        className="text-accent border-accent/30 inline-block border-b pb-px font-semibold hover:underline"
        data-testid={testId}
      >
        {cta}
      </Link>
    </div>
  );
}

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  invalid?: boolean;
  testId?: string;
  children: React.ReactNode;
};

/**
 * Custom check control matching the design's parchment treatment — square
 * surface-2 box with brass border, fills to accent on check, white check
 * glyph inside. Wraps the entire row so clicking the label text also toggles.
 */
export function Checkbox({ checked, onChange, invalid, testId, children }: CheckboxProps) {
  return (
    <label
      className={cn(
        "text-ink-dim flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.5]",
      )}
    >
      {/* The real input sits transparently over the visual box so user-event
          can interact with it, and label-click ↔ input toggle works natively. */}
      <span className="relative mt-px inline-block size-[18px] shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={invalid || undefined}
          data-testid={testId}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 inline-flex items-center justify-center rounded-[5px] border transition-colors",
            checked
              ? "bg-accent border-accent text-accent-ink"
              : invalid
                ? "bg-surface-elevated border-destructive"
                : "bg-surface-elevated border-border-2",
          )}
        >
          {checked && <Check className="size-3" strokeWidth={3} />}
        </span>
      </span>
      <span>{children}</span>
    </label>
  );
}
