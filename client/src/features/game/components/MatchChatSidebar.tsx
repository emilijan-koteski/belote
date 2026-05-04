import { ChevronRight, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MOTION } from "@/shared/lib/motion";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";

import { seatTeam, teamColors } from "../lib/tableTheme";
import { GameChatBody } from "./GameChatBody";

const UNREAD_BADGE_CAP = 99;
const PEEK_MAX_CHARS = 90;
// Peek bubble auto-dismisses on the same 2s timeout as in-table emote
// bubbles so the floating preview doesn't linger and obscure the table.
// Each new arrival resets the timer so the latest message always gets its
// full visible window.
const PEEK_AUTO_DISMISS_MS = MOTION.CHAT_PEEK;

interface MatchChatSidebarProps {
  /** Open/closed flag — lifted to parent so the surrounding HUD (e.g. the
   *  emote button) can react to chat state. */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bottom-right chat FAB (closed) → right-edge collapsible rail (open).
 *
 * Two close paths converge on the same `match-chat-toggle` test id so existing
 * tests + keyboard users continue to work:
 *   • Closed → an icon FAB at `bottom-4 right-4` with the unread badge.
 *   • Open  → a chevron-right control inside the panel header.
 *
 * When closed and the unread count is non-zero, a "peek" bubble floats above
 * the FAB showing the last sender (gold/silver-tinted by viewer-relative team)
 * + a truncated preview of their message. The bubble dismisses naturally when
 * the user opens the sidebar — there's no separate timer because it's already
 * decay-driven by the unread → 0 transition on open.
 */
export function MatchChatSidebar({ isOpen, onOpenChange }: MatchChatSidebarProps) {
  const { t } = useTranslation();
  const roomId = useGameStore((s) => s.roomId);
  const players = useGameStore((s) => s.gameState?.players);
  const myPlayerSeat = useGameStore((s) => s.myPlayerSeat);

  const totalReceived = useChatStore((s) => s.matchMessagesReceivedTotal);
  const matchMessages = useChatStore((s) => s.matchMessages);

  const [unread, setUnread] = useState(0);
  // `peekVisible` controls only the floating preview bubble — the unread
  // badge stays up until the user opens the chat. Decoupling them lets the
  // bubble auto-fade after 2s while the badge keeps signalling backlog.
  const [peekVisible, setPeekVisible] = useState(false);
  const prevTotalRef = useRef(totalReceived);

  useEffect(() => {
    const prev = prevTotalRef.current;
    if (totalReceived < prev) {
      setUnread(0);
      setPeekVisible(false);
      prevTotalRef.current = totalReceived;
      return;
    }
    if (totalReceived > prev && !isOpen) {
      setUnread((u) => u + (totalReceived - prev));
      setPeekVisible(true);
    }
    prevTotalRef.current = totalReceived;
  }, [totalReceived, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setPeekVisible(false);
    }
  }, [isOpen]);

  // Auto-dismiss the peek bubble 2s after it appears. Reschedules on every
  // new arrival because `totalReceived` changes — so the latest message
  // always gets its own 2s window rather than inheriting the prior one's
  // remaining time.
  useEffect(() => {
    if (!peekVisible) return;
    const handle = window.setTimeout(() => setPeekVisible(false), PEEK_AUTO_DISMISS_MS);
    return () => window.clearTimeout(handle);
  }, [peekVisible, totalReceived]);

  const peek = useMemo(() => {
    if (matchMessages.length === 0 || myPlayerSeat === null || !players) return null;
    const last = matchMessages[matchMessages.length - 1];
    if (!last) return null;
    const senderPlayer = players.find((p) => p.userId === last.userId);
    const senderTeam = senderPlayer ? seatTeam(senderPlayer.seat, myPlayerSeat) : null;
    const senderColor = senderTeam ? teamColors(senderTeam)[0] : "var(--brass, #c9a876)";
    const truncated =
      last.message.length > PEEK_MAX_CHARS
        ? `${last.message.slice(0, PEEK_MAX_CHARS - 1)}…`
        : last.message;
    return { sender: last.username, text: truncated, color: senderColor };
  }, [matchMessages, players, myPlayerSeat]);

  if (roomId === null || roomId <= 0) return null;

  const unreadLabel = unread > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(unread);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
        {peek && peekVisible && (
          <div
            className="rounded-xl px-3 py-2 max-w-60"
            style={{
              background: "var(--panel-deeper, rgba(18,32,22,0.94))",
              border: "1px solid rgba(180,220,200,0.1)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
            data-testid="match-chat-peek"
          >
            <div
              className="font-body text-[10px] font-bold tracking-wide"
              style={{ color: peek.color }}
            >
              {peek.sender}
            </div>
            <div
              className="font-body text-xs leading-snug mt-0.5"
              style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.85 }}
            >
              {peek.text}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={t("game.chat.toggleOpen")}
          aria-pressed={false}
          data-testid="match-chat-toggle"
          className="relative inline-flex h-14 w-14 items-center justify-center rounded-full transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brass)"
          style={{
            background: "var(--panel-deeper, rgba(18,32,22,0.94))",
            border: `1px solid ${unread > 0 ? "var(--brass, #c9a876)" : "rgba(180,220,200,0.18)"}`,
            color: "var(--ink-light, #f5f2e8)",
            boxShadow:
              unread > 0
                ? "0 0 0 3px rgba(201,168,118,0.18), 0 8px 24px rgba(0,0,0,0.5)"
                : "0 6px 18px rgba(0,0,0,0.4)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
              style={{
                background: "var(--brass, #c9a876)",
                color: "var(--brass-ink, #2a1a08)",
                border: "2px solid var(--panel-deeper, #121f17)",
                boxShadow: "0 0 12px rgba(201,168,118,0.6)",
              }}
              data-testid="match-chat-toggle-unread"
            >
              {unreadLabel}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <aside
      className="fixed top-0 right-0 z-30 flex h-full max-w-[90vw] flex-col overflow-hidden"
      style={{
        width: 260,
        background: "var(--panel-deeper, rgba(18,32,22,0.94))",
        borderLeft: "1px solid rgba(180,220,200,0.1)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      data-testid="match-chat-sidebar"
    >
      <header
        className="flex items-center justify-between gap-2"
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(180,220,200,0.1)",
        }}
      >
        <div
          className="font-body text-xs font-semibold uppercase"
          style={{
            color: "var(--ink-light, #f5f2e8)",
            letterSpacing: 1.5,
            opacity: 0.8,
          }}
        >
          {t("game.chat.title")}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("game.chat.toggleClose")}
          aria-pressed={true}
          data-testid="match-chat-toggle"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brass)"
          style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.7 }}
          title={t("game.chat.toggleClose")}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      <GameChatBody />
    </aside>
  );
}
