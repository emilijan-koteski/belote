import { MessageSquare, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { RelativeTime } from "@/shared/components/RelativeTime";
import { cn } from "@/shared/lib/utils";
import { useWsConnectionState, useWsSendMessage } from "@/shared/providers/WebSocketContext";
import { useAuthStore } from "@/shared/stores/authStore";
import { useChatStore } from "@/shared/stores/chatStore";
import type { ChatMessagePayload, ChatMessageRequest } from "@/shared/types/wsEvents";
import { ACTION_CHAT_MESSAGE } from "@/shared/types/wsEvents";

const PEEK_MS = 2000;
const PEEK_MAX_CHARS = 90;
const MAX_MESSAGE_LENGTH = 500;

/**
 * Bottom-right lobby chat. Closed state is a 56px FAB with an unread badge +
 * 2-second "peek" bubble for each new incoming message. Open state is a 340×
 * 480 panel docked to the same corner, with a localized live timestamp on
 * each bubble. Mine vs other bubbles are color-coded for quick scanning.
 *
 * Lifecycle:
 *   - The unread counter increments for every incoming message that isn't
 *     mine while the dock is closed; opening the dock clears it.
 *   - The peek auto-dismisses PEEK_MS after its last arrival; new arrivals
 *     reset the timer so the latest message always gets its full window.
 *   - Pre-existing messages (e.g., received before this component mounted
 *     in the same session) are NOT replayed as peek bubbles — only messages
 *     that arrive while the dock is mounted + closed trigger the peek.
 */
export function LobbyChatDock() {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.globalMessages);
  const markSent = useChatStore((s) => s.markSentGlobal);
  const me = useAuthStore((s) => s.user);
  const sendWs = useWsSendMessage();
  const connectionState = useWsConnectionState();
  const isConnected = connectionState === "connected";

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [peekVisible, setPeekVisible] = useState(false);
  const seenCountRef = useRef(messages.length);

  // Listen for new incoming messages — increment unread + show peek (closed),
  // or clear (open). Skip messages from the local user.
  useEffect(() => {
    if (messages.length <= seenCountRef.current) return;
    const newMsgs = messages.slice(seenCountRef.current);
    seenCountRef.current = messages.length;
    const incomingFromOthers = newMsgs.filter((m) => m.userId !== me?.id);
    if (incomingFromOthers.length === 0) return;
    if (open) return;
    setUnread((u) => u + incomingFromOthers.length);
    setPeekVisible(true);
  }, [messages, me?.id, open]);

  // Auto-dismiss peek after PEEK_MS; resets on every new arrival.
  useEffect(() => {
    if (!peekVisible) return;
    const handle = window.setTimeout(() => setPeekVisible(false), PEEK_MS);
    return () => window.clearTimeout(handle);
  }, [peekVisible, messages.length]);

  // Opening the dock clears unread + hides peek immediately.
  useEffect(() => {
    if (open) {
      setUnread(0);
      setPeekVisible(false);
    }
  }, [open]);

  // Auto-scroll to the bottom when new messages arrive (open state only).
  const listEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages.length]);

  function send() {
    const text = draft.trim();
    if (!text || !isConnected) return;
    const req: ChatMessageRequest = { channel: "global", text: text.slice(0, MAX_MESSAGE_LENGTH) };
    sendWs(ACTION_CHAT_MESSAGE, req);
    markSent();
    setDraft("");
  }

  const peek = useMemo(() => peekPayload(messages, me?.id), [messages, me?.id]);

  // ── Closed state ──────────────────────────────────────────────────────
  if (!open) {
    return (
      <div
        data-testid="lobby-chat-dock"
        className="fixed right-4.5 bottom-4.5 z-40 flex flex-col items-end gap-2.5"
      >
        {peek && peekVisible && (
          <div
            data-testid="lobby-chat-peek"
            className="bg-surface-elevated max-w-[260px] rounded-2xl border border-border px-3 py-2 shadow-[0_10px_28px_-14px_rgba(14,58,36,0.30)] [animation:card-in_.2s_ease_both]"
          >
            <div className="text-brass-deep text-[10px] font-bold uppercase tracking-[0.8px]">
              {peek.username}
            </div>
            <div className="text-ink mt-0.5 text-xs leading-snug">{peek.text}</div>
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          aria-label={t("lobby.chat.openLabel")}
          data-testid="lobby-chat-fab"
          className={cn(
            "bg-surface text-ink relative inline-flex size-14 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5",
            unread > 0
              ? "border border-[var(--brass)] shadow-[0_0_0_3px_var(--brass-soft),0_10px_28px_-10px_rgba(14,58,36,0.35)]"
              : "border border-border-2 shadow-[0_8px_22px_-10px_rgba(14,58,36,0.30)]",
          )}
        >
          <MessageSquare className="size-5.5" strokeWidth={1.8} />
          {unread > 0 && (
            <span
              data-testid="lobby-chat-unread"
              className="bg-[var(--brass)] text-[var(--brass-ink)] absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface px-1.5 text-[11px] font-bold leading-none tabular-nums shadow-[0_0_10px_rgba(201,168,118,0.55)]"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ── Open state ────────────────────────────────────────────────────────
  return (
    <aside
      data-testid="lobby-chat-dock"
      className="bg-surface fixed right-4.5 bottom-4.5 z-40 flex h-[480px] w-[340px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border shadow-[0_24px_60px_-20px_rgba(14,58,36,0.30)] [animation:card-in_.18s_ease_both]"
    >
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
        <MessageSquare className="text-accent size-3.5" />
        <span className="font-display text-ink text-sm font-semibold">
          {t("lobby.chat.title")}
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label={t("lobby.chat.closeLabel")}
          className="text-ink-dim ml-auto p-1"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3"
        data-testid="lobby-chat-list"
      >
        {messages.map((m) => (
          <ChatLine key={`${m.userId}-${m.timestamp}-${m.message}`} m={m} mine={m.userId === me?.id} />
        ))}
        <div ref={listEndRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("lobby.chat.placeholder")}
          maxLength={MAX_MESSAGE_LENGTH}
          data-testid="lobby-chat-input"
          className="bg-surface-elevated text-ink flex-1 rounded-lg border border-border px-2.5 py-2 text-xs outline-none placeholder:text-ink-off"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || !isConnected}
          aria-label={t("lobby.chat.sendLabel")}
          data-testid="lobby-chat-send"
          className="bg-accent text-accent-ink inline-flex size-8.5 items-center justify-center rounded-lg disabled:opacity-50"
        >
          <Send className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}

function peekPayload(messages: ChatMessagePayload[], myId: number | undefined) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.userId === myId) continue;
    const text =
      m.message.length > PEEK_MAX_CHARS
        ? `${m.message.slice(0, PEEK_MAX_CHARS - 1)}…`
        : m.message;
    return { username: m.username, text };
  }
  return null;
}

function ChatLine({ m, mine }: { m: ChatMessagePayload; mine: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
      {!mine && (
        <span className="text-ink-mute pl-0.5 text-[11px]">
          {m.username} · <RelativeTime iso={m.timestamp} variant="compact" />
        </span>
      )}
      <span
        className={cn(
          "max-w-[85%] rounded-2xl border px-2.5 py-1.5 text-xs",
          mine
            ? "bg-accent-soft border-accent/40 text-accent"
            : "bg-surface-elevated border-border text-ink",
        )}
      >
        {m.message}
      </span>
    </div>
  );
}
