import { useTranslation } from "react-i18next";

import { MOTION } from "@/shared/lib/motion";
import type { PlayerState, Suit } from "@/shared/types/gameTypes";

import { type SeatTeam, teamColors, teamLabelKey } from "../lib/tableTheme";
import { isCountdownUrgent, TimerRing, useTurnCountdown } from "./TimerRing";

export type SeatOrientation = "bottom" | "left" | "top" | "right";

interface PlayerSeatProps {
  player: PlayerState | null;
  isSelf: boolean;
  isActive: boolean;
  /**
   * Viewer-relative team identity. The viewer's own team always reads as
   * `gold` regardless of teamA/teamB. See [tableTheme.seatTeam].
   */
  seatTeam: SeatTeam;
  cardCount?: number;
  turnExpiresAt?: string | null;
  timerDuration?: number;
  /** This seat is the dealer for the current hand. */
  isDealer?: boolean;
  /**
   * When this seat is the trump caller, the trump suit. When `null` /
   * `undefined`, no caller chip is rendered. (The chip carries the suit
   * glyph, so the suit must be known.)
   */
  trumpCallerSuit?: Suit | null;
  /**
   * Layout for the seat's children. `bottom`/`top` stack vertically; `left`/
   * `right` flow horizontally so the avatar sits on the screen edge while
   * name + card-back stack flow inward.
   */
  orientation?: SeatOrientation;
}

const SUIT_GLYPH: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const SUIT_NAME: Record<Suit, string> = {
  S: "Spades",
  H: "Hearts",
  D: "Diamonds",
  C: "Clubs",
};

function suitColorHex(suit: Suit): string {
  return suit === "H" || suit === "D" ? "#c62828" : "#1a1a1a";
}

const AVATAR_DISC_PX = 64;
const AVATAR_FRAME_PX = AVATAR_DISC_PX + 16; // 3 px conic frame + 5 px ring lane

const TURN_LIME = "var(--turn-lime, #00e5a0)";
const COLOR_URGENT = "var(--turn-urgent, #ef4444)";
// Hard-coded RGBA so the active glow keeps its alpha — `var()` cannot be
// concatenated with extra hex digits (the CSS parser drops the whole
// declaration on `var(--x, #fff)99`, which had been silently disabling
// the active-seat outer ring).
const TURN_LIME_GLOW = "rgba(0, 229, 160, 0.6)";

/**
 * Status indicator chip — 30 px circle with a thick felt-toned border so it
 * reads against the avatar frame. Used by the dealer + trump-caller stack on
 * each seat.
 */
function StatusChip({
  borderColor,
  textColor,
  glowColor,
  children,
  title,
  testId,
}: {
  borderColor: string;
  textColor: string;
  glowColor?: string;
  children: React.ReactNode;
  title: string;
  testId: string;
}) {
  return (
    <div
      title={title}
      data-testid={testId}
      className="rounded-full flex items-center justify-center"
      style={{
        width: 30,
        height: 30,
        background: "linear-gradient(180deg, #fdfaf0, #f0e8d0)",
        color: textColor,
        border: `2px solid ${borderColor}`,
        boxShadow: glowColor
          ? `0 2px 10px rgba(0,0,0,0.55), 0 0 12px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.6)`
          : "0 2px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.6)",
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

/** Fanned face-down card-back pile shown next to non-self avatars, with a
 *  trailing `×N` count so a glance reveals exactly how many cards the seat
 *  still holds (5 in trump-bidding, 8 once dealing finishes, then drops as
 *  cards are played). */
function CardBackStack({ count, isHorizontal }: { count: number; isHorizontal: boolean }) {
  const visible = Math.min(count, 5);
  if (visible <= 0) return null;
  return (
    <div
      className="flex items-center"
      style={{
        marginLeft: isHorizontal ? 8 : 0,
        marginTop: isHorizontal ? 0 : 4,
      }}
      data-testid="player-seat-card-stack"
    >
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            width: 26,
            height: 38,
            marginLeft: i === 0 ? 0 : -22,
            transform: `rotate(${(i - 2) * 1.5}deg)`,
            background: "linear-gradient(135deg, #2a1a10 0%, #4a2818 50%, #2a1a10 100%)",
            border: "1.5px solid var(--brass, #c9a876)",
            borderRadius: 4,
            boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
          }}
        />
      ))}
      <span
        className="font-body text-[11px] tabular-nums"
        style={{
          marginLeft: 8,
          color: "var(--ink-light, #f5f2e8)",
          opacity: 0.7,
        }}
        data-testid="player-seat-card-count"
        aria-label={`${count} cards remaining`}
      >
        ×{count}
      </span>
    </div>
  );
}

/**
 * Player seat — the avatar + name pill + status chips + (for opponents) a
 * card-back stack representing the cards they still hold.
 *
 * Three visual channels stack here:
 *  • Team identity — the conic-gradient frame around the avatar disc (Gold
 *    for the viewer's team, Silver for the opposition; viewer-relative).
 *  • Turn signal — the lime ring + countdown number that appear when this
 *    seat is the active player (urgent-red flip handled by [TimerRing]).
 *  • Hand state — dealer (D) + trump-caller (suit) chips, stacked.
 */
export function PlayerSeat({
  player,
  isSelf,
  isActive,
  seatTeam,
  cardCount,
  turnExpiresAt,
  timerDuration,
  isDealer = false,
  trumpCallerSuit = null,
  orientation = "bottom",
}: PlayerSeatProps) {
  const { t } = useTranslation();

  const teamLabel = t(teamLabelKey(seatTeam));
  const teamGradient = teamColors(seatTeam);

  // Hook must run before the empty-seat early return — the seconds drive the
  // external label rendered inside the name pill (next to the team label).
  // Returns 0 when there's no expiry, so an empty/inactive seat costs nothing.
  const secondsLeft = useTurnCountdown(turnExpiresAt ?? null);

  if (!player) {
    return (
      <div
        className="flex flex-col items-center gap-2"
        aria-label={`Empty seat, ${teamLabel}, waiting`}
        data-testid="player-seat-empty"
        data-seat-team={seatTeam}
      >
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: AVATAR_FRAME_PX,
            height: AVATAR_FRAME_PX,
            background: "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(255,255,255,0.18)",
          }}
        >
          <span className="text-text-secondary text-xs font-body">?</span>
        </div>
        <span className="text-text-secondary text-sm font-body">{t("game.seat.waiting")}</span>
      </div>
    );
  }

  const isDisconnected = player.connected === false;
  const isHorizontal = orientation === "left" || orientation === "right";

  const flexDirection: React.CSSProperties["flexDirection"] = isHorizontal
    ? orientation === "right"
      ? "row-reverse"
      : "row"
    : "column";

  const statusLabel = isDisconnected ? "disconnected" : isActive ? "active" : "waiting";
  const displayName = isSelf ? t("game.seat.you") : player.username || `P${player.seat + 1}`;
  const initial = (player.username || "?").charAt(0).toUpperCase();

  const showRing =
    isActive &&
    !isDisconnected &&
    Boolean(turnExpiresAt) &&
    timerDuration !== undefined &&
    timerDuration > 0;

  const secondsUrgent = showRing && isCountdownUrgent(secondsLeft, timerDuration ?? 0);

  const callerChipNode = trumpCallerSuit ? (
    <StatusChip
      borderColor={suitColorHex(trumpCallerSuit)}
      textColor={suitColorHex(trumpCallerSuit)}
      glowColor={`${suitColorHex(trumpCallerSuit)}99`}
      title={`Called ${SUIT_NAME[trumpCallerSuit]}`}
      testId="player-seat-caller-chip"
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{SUIT_GLYPH[trumpCallerSuit]}</span>
    </StatusChip>
  ) : null;

  const dealerChipNode = isDealer ? (
    <StatusChip
      borderColor="#1f2e23"
      textColor="#0e3a24"
      title="Dealer this hand"
      testId="player-seat-dealer-chip"
    >
      <span style={{ fontSize: 16 }}>D</span>
    </StatusChip>
  ) : null;

  return (
    <div
      className="inline-flex items-center gap-2 select-none"
      style={{
        flexDirection,
        opacity: isDisconnected ? 0.5 : 1,
        filter: isDisconnected ? "grayscale(1)" : undefined,
        transform: isSelf ? "scale(1.08)" : undefined,
      }}
      aria-label={`${displayName}, ${teamLabel}, ${statusLabel}`}
      data-testid={`player-seat-${player.seat}`}
      data-seat-team={seatTeam}
      data-active={isActive ? "true" : "false"}
      data-self={isSelf ? "true" : undefined}
    >
      {/* Avatar w/ team-color conic frame + (when active) lime/red countdown ring */}
      <div
        className="relative shrink-0"
        style={{ width: AVATAR_FRAME_PX, height: AVATAR_FRAME_PX }}
      >
        <div
          className="rounded-full"
          style={{
            position: "absolute",
            inset: 0,
            background: `conic-gradient(from 0deg, ${teamGradient[0]}, ${teamGradient[1]}, ${teamGradient[0]})`,
            padding: 3,
            boxShadow:
              isActive && !isDisconnected
                ? `0 0 0 1.5px ${TURN_LIME}, 0 0 18px ${TURN_LIME_GLOW}`
                : "0 2px 8px rgba(0,0,0,0.3)",
            transition: `box-shadow ${MOTION.SEAT_RING_TRANSITION}ms ease`,
          }}
        >
          <div
            className="rounded-full flex items-center justify-center font-display font-semibold"
            style={{
              width: "100%",
              height: "100%",
              background: "var(--avatar-inner, #1f2e23)",
              color: "var(--ink-light, #f5f2e8)",
              fontSize: AVATAR_DISC_PX * 0.5,
            }}
            data-testid="player-seat-avatar"
          >
            {initial}
          </div>
        </div>
        {/* Countdown ring overlay (lime → urgent red ≤1/8). The numeric label
            is suppressed here so the avatar initial stays legible — the
            seconds are rendered in the name pill team-label row instead. */}
        {showRing && (
          <TimerRing
            turnExpiresAt={turnExpiresAt ?? null}
            totalDuration={timerDuration ?? 0}
            hideLabel
          />
        )}
        {/* Stackable status chips: caller occupies the left slot, dealer the
            right (positions kept as before). The caller chip wins the z-order
            so its suit glyph hovers above the dealer chip in the overlap
            region — the suit is the more important piece of information once
            trump has been taken. */}
        {callerChipNode && dealerChipNode && (
          <>
            <div className="absolute" style={{ top: -6, right: -16, zIndex: 2 }}>
              {callerChipNode}
            </div>
            <div className="absolute" style={{ top: -6, right: -6, zIndex: 1 }}>
              {dealerChipNode}
            </div>
          </>
        )}
        {!callerChipNode && dealerChipNode && (
          <div className="absolute" style={{ top: -6, right: -6 }}>
            {dealerChipNode}
          </div>
        )}
        {callerChipNode && !dealerChipNode && (
          <div className="absolute" style={{ top: -6, right: -6 }}>
            {callerChipNode}
          </div>
        )}
      </div>

      {/* Name pill */}
      <div
        className="rounded-lg flex flex-col items-center gap-0.5 px-3 py-1.5"
        style={{
          minWidth: 88,
          background: "var(--panel-dark, rgba(20,45,30,0.85))",
          border:
            isActive && !isDisconnected
              ? `1px solid ${TURN_LIME}`
              : "1px solid rgba(255,255,255,0.08)",
          boxShadow: isActive && !isDisconnected ? "0 0 12px rgba(0, 229, 160, 0.33)" : undefined,
          transition: `border-color ${MOTION.SEAT_RING_TRANSITION}ms ease, box-shadow ${MOTION.SEAT_RING_TRANSITION}ms ease`,
        }}
        data-testid="player-seat-name-pill"
      >
        <span
          className="font-body text-sm font-semibold"
          style={{ color: "var(--ink-light, #f5f2e8)" }}
        >
          {displayName}
        </span>
        <span
          className="font-body text-[10px] tabular-nums flex items-center gap-1.5"
          style={{ color: "rgba(245,242,232,0.6)" }}
        >
          <span
            className="rounded-full"
            style={{
              width: 5,
              height: 5,
              background: teamGradient[0],
            }}
            aria-hidden
          />
          <span style={{ letterSpacing: 0.6, opacity: 0.7 }}>{teamLabel}</span>
          {showRing && (
            <span
              className="font-body font-semibold tabular-nums"
              style={{
                color: secondsUrgent ? COLOR_URGENT : TURN_LIME,
                transition: `color ${MOTION.RING_COLOR_FLIP}ms ease`,
                marginLeft: 4,
              }}
              data-testid="player-seat-timer-seconds"
              aria-label={`${secondsLeft} seconds remaining`}
            >
              {secondsLeft}s
            </span>
          )}
        </span>
      </div>

      {/* Card-back stack — opponents only */}
      {!isSelf && cardCount !== undefined && cardCount > 0 && (
        <CardBackStack count={cardCount} isHorizontal={isHorizontal} />
      )}

      {/* sr-live region for assistive tech — same wording as before so existing
          screen-reader expectations don't drift. */}
      <div aria-live="polite" className="sr-only">
        {isActive ? "It's this player's turn" : ""}
      </div>
    </div>
  );
}
