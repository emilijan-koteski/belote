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

type ChatChannel = "global" | "match";

interface ChatPanelProps {
  className?: string;
  channel?: ChatChannel;
  matchId?: number;
}

export function ChatPanel({ className, channel = "global", matchId }: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const sendMessage = useWsSendMessage();
  const connectionState = useWsConnectionState();
  const messages = useChatStore((s) => (channel === "match" ? s.matchMessages : s.globalMessages));

  const [draft, setDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const isConnected = connectionState === "connected";
  const titleKey = channel === "match" ? "game.chat.title" : "chat.title";
  const placeholderKey = channel === "match" ? "game.chat.placeholder" : "chat.placeholder";

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleSubmit() {
    const text = draft.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || !isConnected) return;

    let payload: ChatMessageRequest;
    if (channel === "match") {
      // Server roomIDs are positive integers (PostgreSQL auto-increment from
      // 1). Reject 0, negatives, NaN, Infinity, and non-integers so a caller
      // bug doesn't waste frames on a guaranteed silent-drop path.
      if (typeof matchId !== "number" || !Number.isInteger(matchId) || matchId <= 0) return;
      payload = { channel: "match", matchId, text };
    } else {
      payload = { channel: "global", text };
    }
    sendMessage(ACTION_CHAT_MESSAGE, payload);
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
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-semibold text-text-primary">{t(titleKey)}</h3>
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
