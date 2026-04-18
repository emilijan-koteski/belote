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

interface ChatPanelProps {
  className?: string;
}

export function ChatPanel({ className }: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const sendMessage = useWsSendMessage();
  const connectionState = useWsConnectionState();
  const messages = useChatStore((s) => s.globalMessages);

  const [draft, setDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const isConnected = connectionState === "connected";

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleSubmit() {
    const text = draft.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || !isConnected) return;

    const payload: ChatMessageRequest = { channel: "global", text };
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
        <h3 className="font-display text-base font-semibold text-text-primary">
          {t("chat.title")}
        </h3>
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
          placeholder={isConnected ? t("chat.placeholder") : t("chat.placeholderDisabled")}
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
