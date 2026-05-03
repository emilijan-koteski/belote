import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWsConnectionState, useWsSendMessage } from "@/shared/providers/WebSocketContext";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { ChatMessageRequest } from "@/shared/types/wsEvents";
import { ACTION_CHAT_MESSAGE } from "@/shared/types/wsEvents";

import { seatTeam, teamColors } from "../lib/tableTheme";

const MAX_MESSAGE_LENGTH = 500;
const CLEAR_COMMAND = "/cc";

/**
 * Match-chat body + composer styled per the in-game felt design (table.jsx
 * `ChatRail`). Distinct from the lobby/room `ChatPanel` so the lobby keeps its
 * Balatro look while the table reads as a casino-felt sidebar:
 *   • Sender name in viewer-relative team color (gold = Us, silver = Them)
 *   • Speech-bubble shape (rounded with squared top-left corner)
 *   • No clear-chat header (the parent sidebar owns the single header)
 *   • No emote chip row (emotes live in the standalone EmotePickerButton)
 */
export function GameChatBody() {
  const { t, i18n } = useTranslation();
  const sendMessage = useWsSendMessage();
  const connectionState = useWsConnectionState();
  const isConnected = connectionState === "connected";

  const roomId = useGameStore((s) => s.roomId);
  const players = useGameStore((s) => s.gameState?.players);
  const myPlayerSeat = useGameStore((s) => s.myPlayerSeat);

  const messages = useChatStore((s) => s.matchMessages);
  const hasSent = useChatStore((s) => s.hasSentMatch);
  const markSent = useChatStore((s) => s.markSentMatch);
  const clearMatch = useChatStore((s) => s.clearMatch);

  const [draft, setDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Resolve userId → viewer-relative team color so each sender's name renders
  // in their team's gold/silver. Memoised on (players, myPlayerSeat) so a
  // stable seat layout doesn't re-walk the array per row.
  const colorFor = useMemo(() => {
    return (userId: number) => {
      if (myPlayerSeat === null || !players) return "var(--brass, #c9a876)";
      const p = players.find((pl) => pl.userId === userId);
      if (!p) return "var(--brass, #c9a876)";
      return teamColors(seatTeam(p.seat, myPlayerSeat))[0];
    };
  }, [players, myPlayerSeat]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const placeholderKey = hasSent ? "chat.placeholderAfterFirst" : "game.chat.placeholder";

  function handleSubmit() {
    const text = draft.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;
    if (text.toLowerCase() === CLEAR_COMMAND) {
      clearMatch();
      setDraft("");
      inputRef.current?.focus();
      return;
    }
    if (!isConnected) return;
    if (typeof roomId !== "number" || !Number.isInteger(roomId) || roomId <= 0) return;
    const payload: ChatMessageRequest = { channel: "match", matchId: roomId, text };
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
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="game-chat-body">
      <div className="flex-1 overflow-y-auto px-3 py-3" data-testid="chat-message-list">
        {messages.length === 0 ? (
          <p
            className="font-body text-xs"
            style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.5 }}
            data-testid="chat-empty"
          >
            {t("chat.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((msg) => (
              <li
                key={`${msg.userId}-${msg.timestamp}`}
                className="flex flex-col gap-0.5"
                data-testid="chat-message-row"
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-body text-[11px] font-bold tracking-wide"
                    style={{ color: colorFor(msg.userId) }}
                  >
                    {msg.username}
                  </span>
                  <span
                    className="font-body text-[9px] tabular-nums"
                    style={{ color: "var(--ink-light, #f5f2e8)", opacity: 0.4 }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString(i18n.language, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className="font-body break-words"
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.4,
                    color: "var(--ink-light, #f5f2e8)",
                    background: "rgba(255,255,255,0.04)",
                    padding: "6px 10px",
                    borderRadius: 10,
                    borderTopLeftRadius: 4,
                    maxWidth: "95%",
                    width: "fit-content",
                  }}
                >
                  {msg.message}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={listEndRef} />
      </div>

      <div
        className="flex items-center gap-2 px-3 py-3"
        style={{ borderTop: "1px solid rgba(180,220,200,0.1)" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? t(placeholderKey) : t("chat.placeholderDisabled")}
          disabled={!isConnected}
          maxLength={MAX_MESSAGE_LENGTH + 1}
          aria-invalid={tooLong}
          data-testid="chat-input"
          className="font-body min-w-0 flex-1 rounded-[10px] px-2.5 py-2 text-xs outline-none transition-colors placeholder:opacity-50 focus-visible:ring-2 focus-visible:ring-(--brass) disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            color: "var(--ink-light, #f5f2e8)",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(180,220,200,0.1)",
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sendDisabled}
          data-testid="chat-send-button"
          className="font-body shrink-0 rounded-[10px] px-2.5 py-2 text-xs font-semibold transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brass) disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            color: "var(--brass-ink, #2a1a08)",
            background: "var(--brass, #c9a876)",
            border: "1px solid rgba(201,168,118,0.6)",
          }}
        >
          {t("chat.send")}
        </button>
      </div>
      {tooLong && (
        <p
          className="font-body px-3 pb-2 text-[10px]"
          style={{ color: "#ef4444" }}
          data-testid="chat-too-long"
        >
          {t("chat.tooLong")}
        </p>
      )}
    </div>
  );
}
