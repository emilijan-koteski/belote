import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import type { PlayerState, Rank, Suit } from "@/shared/types/gameTypes";

import { seatTeam, teamColors } from "../lib/tableTheme";
import { AutoCloseRing } from "./overlay/AutoCloseRing";
import { PlayingCard } from "./PlayingCard";

interface TrumpRevealProps {
  /** Seat index of the player who took the trump. */
  playerSeat: number;
  /** Local viewer's seat, used to derive viewer-relative team color. When
   *  null (race during initial mount), the toast renders with a brass glow
   *  fallback. */
  myPlayerSeat: number | null;
  cardId: string;
  players: readonly PlayerState[];
  onComplete: () => void;
}

const SUIT_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};

function parseCardId(id: string) {
  return { rank: id[0] as Rank, suit: id[1] as Suit };
}

/**
 * "Trump taken" announcement toast. Centred over the table, glows in the
 * caller's team color (Gold for "Us", Silver for "Them"), and auto-closes
 * after 8 s — early dismissal via the X-with-countdown-ring. Min possible
 * turn timer is 10 s, so 8 s leaves the next player a 2 s buffer to react.
 */
export function TrumpReveal({
  playerSeat,
  myPlayerSeat,
  cardId,
  players,
  onComplete,
}: TrumpRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useReducedMotion();

  // Hold onComplete in a ref so the AutoCloseRing's callback identity stays
  // stable — preventing the inner countdown from resetting if the parent
  // re-renders mid-reveal (e.g. on a stale gameState push).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleClose = () => {
    if (!visible) return;
    setVisible(false);
    onCompleteRef.current();
  };

  // Defence in depth: WS dispatch already drops payloads with cardId.length < 2,
  // but parseCardId would silently produce undefined suit/rank if reached with
  // a short string (e.g. via tests or future code paths) — guard at the boundary.
  if (!visible || cardId.length < 2) {
    return null;
  }

  const picker = players.find((p) => p.seat === playerSeat);
  const card = parseCardId(cardId);
  const suitName = t(`game.suits.${suitNameKey(card.suit)}`, {
    defaultValue: SUIT_NAME[card.suit],
  });

  // Viewer-relative team color for the glow + the Us/Them chip. When the
  // viewer's seat hasn't resolved yet we fall back to brass so the toast still
  // reads on dark felt.
  const team = myPlayerSeat !== null ? seatTeam(playerSeat, myPlayerSeat) : null;
  const teamGradient = team ? teamColors(team) : null;
  const glowColor = teamGradient ? teamGradient[0] : "var(--brass, #c9a876)";
  const teamLabel = team ? t(team === "gold" ? "team.us" : "team.them") : null;

  const titleName = picker?.username
    ? t("game.trumpReveal.title", { name: picker.username })
    : t("game.trumpReveal.unknownPlayer");

  return (
    <div
      className={`absolute inset-0 z-50 pointer-events-none ${
        prefersReducedMotion
          ? ""
          : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
      }`}
      data-testid="trump-reveal"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex items-center gap-4 rounded-2xl px-5 py-4"
        style={{
          background: "linear-gradient(180deg, rgba(30,60,40,0.98) 0%, rgba(14,40,24,0.98) 100%)",
          border: "1px solid rgba(201,168,118,0.55)",
          boxShadow: `0 12px 32px rgba(0,0,0,0.55), 0 0 0 2px ${glowColor}88, 0 0 24px ${glowColor}77, inset 0 1px 0 rgba(201,168,118,0.22)`,
          color: "var(--ink-light, #f5f2e8)",
          fontFamily: "system-ui, sans-serif",
        }}
        data-team={team ?? undefined}
      >
        {/* Card on the left */}
        <PlayingCard card={card} state="default" size="md" withTransition={false} />

        {/* Main copy */}
        <div className="flex flex-col gap-1 min-w-50">
          <div
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--brass, #c9a876)", fontFamily: "Georgia, serif" }}
          >
            {t("game.trumpReveal.eyebrow", { defaultValue: "Trump taken" })}
          </div>
          <div
            className="font-semibold leading-tight"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 18,
              letterSpacing: 0.2,
            }}
            data-testid="trump-reveal-title"
            data-seat={playerSeat}
          >
            <span className="capitalize">
              {titleName} · {suitName}
            </span>
          </div>
          {team && teamLabel && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                style={{
                  background: `${glowColor}22`,
                  border: `1px solid ${glowColor}88`,
                  color: glowColor,
                }}
              >
                <span
                  aria-hidden
                  className="rounded-full"
                  style={{ width: 5, height: 5, background: glowColor }}
                />
                {teamLabel}
              </span>
              <span className="text-xs opacity-70">
                {t("game.trumpReveal.subtitle", { defaultValue: "trump for this hand" })}
              </span>
            </div>
          )}
        </div>

        {/* X button with countdown ring */}
        <AutoCloseRing
          duration={prefersReducedMotion ? 1.5 : 8}
          onClose={handleClose}
          ariaLabel={t("game.trumpReveal.dismiss", { defaultValue: "Dismiss" })}
          testId="trump-reveal-close"
        />
      </div>
    </div>
  );
}

function suitNameKey(suit: Suit): "spades" | "hearts" | "diamonds" | "clubs" {
  switch (suit) {
    case "S":
      return "spades";
    case "H":
      return "hearts";
    case "D":
      return "diamonds";
    case "C":
      return "clubs";
  }
}
