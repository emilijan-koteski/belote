import { ChevronRight, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChatPanel } from "@/features/chat/ChatPanel";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";

import { seatTeam, teamColors } from "../lib/tableTheme";

const UNREAD_BADGE_CAP = 99;
const PEEK_MAX_CHARS = 90;

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
export function MatchChatSidebar() {
  const { t } = useTranslation();
  const roomId = useGameStore((s) => s.roomId);
  const players = useGameStore((s) => s.gameState?.players);
  const myPlayerSeat = useGameStore((s) => s.myPlayerSeat);

  // Monotonic counter survives ring-buffer eviction (chatStore caps at 200).
  const totalReceived = useChatStore((s) => s.matchMessagesReceivedTotal);
  const matchMessages = useChatStore((s) => s.matchMessages);

  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevTotalRef = useRef(totalReceived);

  useEffect(() => {
    const prev = prevTotalRef.current;
    if (totalReceived < prev) {
      // clearMatch reset the counter — drop any pending unread.
      setUnread(0);
      prevTotalRef.current = totalReceived;
      return;
    }
    if (totalReceived > prev && !isOpen) {
      setUnread((u) => u + (totalReceived - prev));
    }
    prevTotalRef.current = totalReceived;
  }, [totalReceived, isOpen]);

  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  // Resolve the latest match message → { sender, text, senderTeam } for the
  // peek bubble. Sender team is viewer-relative gold/silver, falling back to
  // brass when the userId can't be matched (e.g. system messages, race with
  // gameState load). Memoised on (matchMessages, players, myPlayerSeat) so a
  // stable last-message reference doesn't churn across renders.
  const peek = useMemo(() => {
    if (matchMessages.length === 0 || myPlayerSeat === null || !players) return null;
    const last = matchMessages[matchMessages.length - 1];
    const senderPlayer = players.find((p) => p.userId === last.userId);
    const senderTeam = senderPlayer ? seatTeam(senderPlayer.seat, myPlayerSeat) : null;
    const senderColor = senderTeam ? teamColors(senderTeam)[0] : "var(--brass, #c9a876)";
    const truncated =
      last.message.length > PEEK_MAX_CHARS
        ? `${last.message.slice(0, PEEK_MAX_CHARS - 1)}…`
        : last.message;
    return { sender: last.username, text: truncated, color: senderColor };
  }, [matchMessages, players, myPlayerSeat]);

  // Server roomIDs are positive auto-increment integers; treat 0/-/NaN as
  // "no room" — without this guard a stray send to a non-existent room is
  // silently dropped by the server every time, wasting frames.
  if (roomId === null || roomId <= 0) return null;

  const unreadLabel = unread > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(unread);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
        {peek && unread > 0 && (
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
          onClick={() => setIsOpen(true)}
          aria-label={t("game.chat.toggleOpen")}
          aria-pressed={false}
          data-testid="match-chat-toggle"
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brass)"
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
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
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
      className="fixed top-0 right-0 z-30 flex h-full w-80 max-w-[90vw] flex-col"
      style={{
        background: "var(--panel-deeper, rgba(18,32,22,0.94))",
        borderLeft: "1px solid rgba(180,220,200,0.1)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      data-testid="match-chat-sidebar"
    >
      <header
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(201,168,118,0.18)" }}
      >
        <div
          className="font-body text-xs font-semibold uppercase"
          style={{ color: "var(--ink-light, #f5f2e8)", letterSpacing: 1.5, opacity: 0.85 }}
        >
          {t("game.chat.title")}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label={t("game.chat.toggleClose")}
          aria-pressed={true}
          data-testid="match-chat-toggle"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brass)"
          style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.7 }}
          title={t("game.chat.toggleClose")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatPanel channel="match" matchId={roomId} className="h-full border-0 rounded-none" />
      </div>
    </aside>
  );
}
