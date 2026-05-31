import * as React from "react";

/**
 * ♥ ♠ ♦ ♣ row divider — the in-game DNA dropped onto parchment. Suit glyphs
 * are forced to a serif font with the U+FE0E variation selector so they
 * render as text not emoji (which renders ~1.3× larger and breaks the row).
 *
 * Promoted from features/auth/components/AuthCard.tsx so non-auth callers
 * (Create Room, future surfaces) can use the same divider without an auth
 * import.
 */
export function SuitRule() {
  const glyphStyle: React.CSSProperties = {
    fontFamily: "var(--font-suit)",
    fontSize: 17,
    lineHeight: 1,
    display: "inline-block",
  };
  return (
    <div className="mt-1 mb-4 flex items-center gap-3.5" aria-hidden="true">
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
