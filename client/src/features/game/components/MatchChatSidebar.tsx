import { MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChatPanel } from "@/features/chat/ChatPanel";
import { Button } from "@/shared/components/ui/button";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";

const UNREAD_BADGE_CAP = 99;

export function MatchChatSidebar() {
  const { t } = useTranslation();
  const roomId = useGameStore((s) => s.roomId);
  // Monotonic counter: still increments after the ring buffer fills and
  // resets to 0 on clearMatch — decouples unread tracking from array length.
  const totalReceived = useChatStore((s) => s.matchMessagesReceivedTotal);

  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevTotalRef = useRef(totalReceived);

  useEffect(() => {
    const prev = prevTotalRef.current;
    // clearMatch resets the counter to 0. Drop any pending unread so the
    // badge doesn't show phantom unread for a cleared history.
    if (totalReceived < prev) {
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

  // roomId is populated from gameState.roomId (PostgreSQL auto-increment, ≥1)
  // — tighten the guard so a stray 0 or negative id never renders a dead
  // sidebar whose every send is silently dropped by the server.
  if (roomId === null || roomId <= 0) return null;

  const unreadLabel = unread > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(unread);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? t("game.chat.toggleClose") : t("game.chat.toggleOpen")}
        aria-pressed={isOpen}
        className="fixed top-16 right-2 z-30 rounded-full shadow-lg"
        data-testid="match-chat-toggle"
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        )}
        {!isOpen && unread > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            data-testid="match-chat-toggle-unread"
          >
            {unreadLabel}
          </span>
        )}
      </Button>

      {isOpen && (
        <aside
          className="fixed top-0 right-0 z-30 flex h-full w-80 max-w-[90vw] flex-col border-l border-border bg-background/95 p-4 shadow-xl backdrop-blur"
          data-testid="match-chat-sidebar"
        >
          <ChatPanel channel="match" matchId={roomId} className="h-full" />
        </aside>
      )}
    </>
  );
}
