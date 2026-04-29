import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { useWsConnectionState, useWsSendMessage } from "@/shared/providers/WebSocketContext";
import { useChatStore } from "@/shared/stores/chatStore";
import type { ChatMessageRequest } from "@/shared/types/wsEvents";
import { ACTION_CHAT_MESSAGE } from "@/shared/types/wsEvents";

const MAX_MESSAGE_LENGTH = 500;
// Slash command for clearing chat locally. Match exactly (case-insensitive) so
// "/cc hello" stays a normal message — guards against accidental data loss.
const CLEAR_COMMAND = "/cc";

type ChatChannel = "global" | "match" | "room";

interface ChatPanelProps {
  className?: string;
  channel?: ChatChannel;
  matchId?: number;
  roomId?: number;
}

export function ChatPanel({ className, channel = "global", matchId, roomId }: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const sendMessage = useWsSendMessage();
  const connectionState = useWsConnectionState();
  const messages = useChatStore((s) => {
    if (channel === "match") return s.matchMessages;
    if (channel === "room") return s.roomMessages;
    return s.globalMessages;
  });
  const hasSentInChannel = useChatStore((s) => {
    if (channel === "match") return s.hasSentMatch;
    if (channel === "room") return s.hasSentRoom;
    return s.hasSentGlobal;
  });
  const markSent = useChatStore((s) => {
    if (channel === "match") return s.markSentMatch;
    if (channel === "room") return s.markSentRoom;
    return s.markSentGlobal;
  });
  const clearChannel = useChatStore((s) => {
    if (channel === "match") return s.clearMatch;
    if (channel === "room") return s.clearRoom;
    return s.clearGlobal;
  });

  const [draft, setDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Clear messages + draft, then return focus to the input. The clear button
  // disables itself (messages.length === 0) immediately after, so without this
  // handoff keyboard users land on <body>.
  function clearChannelAndRefocus() {
    clearChannel();
    setDraft("");
    inputRef.current?.focus();
  }

  const isConnected = connectionState === "connected";
  const titleKey =
    channel === "match" ? "game.chat.title" : channel === "room" ? "room.chat.title" : "chat.title";
  // Show the inviting "Say hi…" / channel-specific placeholder until the
  // local user sends their first message, then switch to a terser "Message…"
  // continuation. The flag is a latched store field, so it survives
  // ring-buffer eviction (the user's opener scrolling out of a busy lobby)
  // and panel unmount/remount within the same channel session. It resets
  // when the channel is cleared — e.g. leaving a room or ending a match —
  // so the next room/match starts with the invitation again.
  const initialPlaceholderKey =
    channel === "match"
      ? "game.chat.placeholder"
      : channel === "room"
        ? "room.chat.placeholder"
        : "chat.placeholder";
  const placeholderKey = hasSentInChannel ? "chat.placeholderAfterFirst" : initialPlaceholderKey;

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleSubmit() {
    const text = draft.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;

    // Local /cc clear — works regardless of WS state since it only mutates
    // client-side store. Sending a network message would be wasteful here.
    if (text.toLowerCase() === CLEAR_COMMAND) {
      clearChannelAndRefocus();
      return;
    }

    if (!isConnected) return;

    let payload: ChatMessageRequest;
    if (channel === "match") {
      // Server roomIDs are positive integers (PostgreSQL auto-increment from
      // 1). Reject 0, negatives, NaN, Infinity, and non-integers so a caller
      // bug doesn't waste frames on a guaranteed silent-drop path.
      if (typeof matchId !== "number" || !Number.isInteger(matchId) || matchId <= 0) return;
      payload = { channel: "match", matchId, text };
    } else if (channel === "room") {
      if (typeof roomId !== "number" || !Number.isInteger(roomId) || roomId <= 0) return;
      payload = { channel: "room", roomId, text };
    } else {
      payload = { channel: "global", text };
    }
    sendMessage(ACTION_CHAT_MESSAGE, payload);
    markSent();
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const tooLong = draft.length > MAX_MESSAGE_LENGTH;
  const sendDisabled = !isConnected || !draft.trim() || tooLong;

  return (
    <div
      className={cn("flex flex-col rounded-lg border border-border bg-surface", className)}
      data-testid="chat-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-semibold text-text-primary">{t(titleKey)}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clearChannelAndRefocus}
          disabled={messages.length === 0}
          aria-label={t("chat.clearAriaLabel")}
          title={t("chat.clearTooltip")}
          className="h-7 w-7 shrink-0"
          data-testid="chat-clear-button"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="chat-message-list">
        {messages.length === 0 ? (
          <p className="text-sm text-text-secondary" data-testid="chat-empty">
            {t("chat.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((msg) => (
              <li
                key={`${msg.userId}-${msg.timestamp}`}
                className="text-sm"
                data-testid="chat-message-row"
              >
                <span className="font-semibold text-text-primary">{msg.username}</span>{" "}
                <span className="text-text-secondary">
                  {new Date(msg.timestamp).toLocaleTimeString(i18n.language, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="mt-0.5 break-words text-text-primary">{msg.message}</div>
              </li>
            ))}
          </ul>
        )}
        {/* listEndRef lives outside the conditional list so the auto-scroll
            effect can attach it on initial mount and the 0→1 transition. */}
        <div ref={listEndRef} />
      </div>

      <div className="flex gap-2 border-t border-border px-4 py-3">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? t(placeholderKey) : t("chat.placeholderDisabled")}
          disabled={!isConnected}
          maxLength={MAX_MESSAGE_LENGTH + 1}
          aria-invalid={tooLong}
          data-testid="chat-input"
        />
        <Button onClick={handleSubmit} disabled={sendDisabled} data-testid="chat-send-button">
          {t("chat.send")}
        </Button>
      </div>
      {tooLong && (
        <p className="px-4 pb-3 text-xs text-destructive" data-testid="chat-too-long">
          {t("chat.tooLong")}
        </p>
      )}
    </div>
  );
}
