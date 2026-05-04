import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import type { PlayerState, Rank, Suit } from "@/shared/types/gameTypes";

import { seatTeam, teamColors } from "../lib/tableTheme";
import { AutoCloseRing } from "./overlay/AutoCloseRing";
import { PlayingCard } from "./PlayingCard";

interface BelotRevealProps {
  playerSeat: number;
  myPlayerSeat: number;
  cardId: string;
  isKing: boolean;
  onComplete: () => void;
  /** Optional player roster — when provided the announcer's name appears in
   *  the eyebrow line. Tests render the reveal without players, in which
   *  case we just show the team chip. */
  players?: readonly PlayerState[];
}

function parseCardId(id: string) {
  return { rank: id[0] as Rank, suit: id[1] as Suit };
}

/**
 * Belot / Re-belot announcement toast — shown to every player once the
 * trump-K-Q holder elects to announce. Mirrors {@link TrumpReveal}: centred
 * over the table, glows in the announcer's viewer-relative team color, auto-
 * closes after 8 s, can be dismissed early via the X-with-countdown-ring.
 */
export function BelotReveal({
  playerSeat,
  myPlayerSeat,
  cardId,
  isKing,
  onComplete,
  players,
}: BelotRevealProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  const prefersReducedMotion = useReducedMotion();

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleClose = () => {
    if (!visible) return;
    setVisible(false);
    onCompleteRef.current();
  };

  if (!visible) {
    return null;
  }

  const team = seatTeam(playerSeat, myPlayerSeat);
  const teamGradient = teamColors(team);
  const glowColor = teamGradient[0];
  const teamLabel = t(team === "gold" ? "team.us" : "team.them");

  const labelKey = isKing ? "game.belot.reveal.rebelot" : "game.belot.reveal.belot";
  const titleKey = isKing ? "game.belot.reveal.titleRebelot" : "game.belot.reveal.titleBelot";
  const announcer = players?.find((p) => p.seat === playerSeat)?.username;
  // Mirror TrumpReveal: full sentence on the title row when we know who
  // announced ("{{name}} announced re-belot"), graceful fallback to the
  // team label when the players roster wasn't passed (test renders).
  const titleText = announcer
    ? t(titleKey, { name: announcer })
    : t(team === "gold" ? "team.us" : "team.them");

  return (
    <div
      className={`absolute inset-0 z-50 pointer-events-none ${
        prefersReducedMotion
          ? ""
          : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
      }`}
      data-testid="belot-reveal"
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
        data-team={team}
      >
        <PlayingCard card={parseCardId(cardId)} state="default" size="md" withTransition={false} />

        <div className="flex flex-col gap-1 min-w-50">
          <div
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--brass, #c9a876)", fontFamily: "Georgia, serif" }}
            data-testid="belot-reveal-label"
          >
            {t(labelKey)}
          </div>
          <div
            className="font-semibold leading-tight"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 18,
              letterSpacing: 0.2,
            }}
            data-testid="belot-reveal-title"
            data-seat={playerSeat}
          >
            {titleText}
          </div>
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
              {t("game.belot.reveal.bonus", { defaultValue: "+20 to your team's score" })}
            </span>
          </div>
        </div>

        <AutoCloseRing
          duration={prefersReducedMotion ? 1.5 : 8}
          onClose={handleClose}
          ariaLabel={t("game.belot.reveal.dismiss", { defaultValue: "Dismiss" })}
          testId="belot-reveal-close"
        />
      </div>
    </div>
  );
}
