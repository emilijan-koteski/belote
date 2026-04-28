import { Smile } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { EMOTE_IDS, type EmoteID } from "@/shared/types/wsEvents";

const EMOTE_GLYPHS: Record<EmoteID, string> = {
  thumbs_up: "👍",
  clap: "👏",
  laugh: "😂",
  thinking: "🤔",
  facepalm: "🤦",
  heart: "❤️",
};

// snake_case wire ID → camelCase i18n leaf for `game.emote.names.*`.
const EMOTE_I18N_KEYS: Record<EmoteID, string> = {
  thumbs_up: "thumbsUp",
  clap: "clap",
  laugh: "laugh",
  thinking: "thinking",
  facepalm: "facepalm",
  heart: "heart",
};

const COOLDOWN_MS = 3000;

interface EmotePickerButtonProps {
  onSend: (emote: EmoteID) => void;
  disabled?: boolean;
}

export function EmotePickerButton({ onSend, disabled = false }: EmotePickerButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number>(0);
  // `now` re-renders the picker exactly when the cooldown expires so disabled
  // tiles re-enable instantly without forcing parents to re-render every tick.
  const [now, setNow] = useState<number>(Date.now());
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const cooldownRemaining = Math.max(0, COOLDOWN_MS - (now - lastSentAt));

  // Single timer keyed on lastSentAt — fires once at the cooldown end so the
  // disabled tiles flip back to enabled. No per-tile timer storms.
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const handle = window.setTimeout(() => {
      setNow(Date.now());
    }, cooldownRemaining);
    return () => window.clearTimeout(handle);
  }, [lastSentAt, cooldownRemaining]);

  // Close on outside click + Escape. Mirrors the lightweight popover pattern;
  // useFocusTrap is intentionally NOT used — outside click dismissal would be
  // swallowed by a focus trap (see Dev Notes anti-patterns).
  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        // Restore focus to the toggle so keyboard users land back on it.
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  // When the picker opens, focus the first tile so keyboard users can navigate
  // the grid with arrow keys immediately (AC #1). Mouse users are unaffected
  // because the focus-visible ring only renders for keyboard activation.
  useEffect(() => {
    if (isOpen) {
      tileRefs.current[0]?.focus();
    }
  }, [isOpen]);

  // Roving-tabindex-style arrow navigation across the 3x2 tile grid.
  // Layout (zero-indexed):  0 1 2
  //                         3 4 5
  // Right/Left wrap horizontally; Up/Down move between rows (and wrap).
  const handleGridKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const focused = document.activeElement;
    const currentIdx = tileRefs.current.findIndex((ref) => ref === focused);
    if (currentIdx === -1) return;
    let nextIdx: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIdx = (currentIdx + 1) % EMOTE_IDS.length;
        break;
      case "ArrowLeft":
        nextIdx = (currentIdx + EMOTE_IDS.length - 1) % EMOTE_IDS.length;
        break;
      case "ArrowDown":
      case "ArrowUp":
        nextIdx = (currentIdx + 3) % EMOTE_IDS.length;
        break;
    }
    if (nextIdx !== null) {
      event.preventDefault();
      tileRefs.current[nextIdx]?.focus();
    }
  }, []);

  const handleTileClick = useCallback(
    (emote: EmoteID) => {
      const remaining = COOLDOWN_MS - (Date.now() - lastSentAt);
      if (remaining > 0) return; // defence in depth — tiles already disabled
      setLastSentAt(Date.now());
      setNow(Date.now());
      onSend(emote);
      setIsOpen(false);
    },
    [lastSentAt, onSend],
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label={t("game.emote.button")}
        aria-pressed={isOpen}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
        data-testid="emote-toggle"
      >
        <Smile className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="group"
          aria-label={t("game.emote.picker.title")}
          className="absolute right-0 top-12 z-30 w-44 rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur"
          data-testid="emote-picker"
        >
          <div className="grid grid-cols-3 gap-1" onKeyDown={handleGridKeyDown}>
            {EMOTE_IDS.map((id, idx) => {
              const tileDisabled = cooldownRemaining > 0;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tileRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => handleTileClick(id)}
                  disabled={tileDisabled}
                  aria-disabled={tileDisabled}
                  aria-label={t(`game.emote.names.${EMOTE_I18N_KEYS[id]}`)}
                  data-testid={`emote-tile-${id}`}
                  className="aspect-square rounded-md text-2xl leading-none transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span aria-hidden="true">{EMOTE_GLYPHS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
