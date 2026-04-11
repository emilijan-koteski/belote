import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { getRoom, leaveRoom } from "@/shared/api/rooms";
import { Button } from "@/shared/components/ui/button";
import { useAuthStore } from "@/shared/stores/authStore";
import type { Room, RoomPlayer } from "@/shared/types/apiTypes";

const variantKeys: Record<string, string> = {
  bitola: "lobby.roomList.variantBitola",
};

const matchModeKeys: Record<string, string> = {
  "1001": "lobby.roomList.matchMode1001",
};

export function RoomLobby() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLeftRef = useRef(false);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!id) return;

    async function fetchRoom() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getRoom(Number(id));
        setRoom(data.room);
        setPlayers(data.players);
        // Only mark as joined if the current user is in the players list
        const userId = useAuthStore.getState().user?.id;
        if (userId && data.players.some((p) => p.userId === userId)) {
          hasJoinedRef.current = true;
        }
      } catch {
        setError(t("lobby.roomLobby.notFound"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoom();
  }, [id, t]);

  useEffect(() => {
    return () => {
      if (id && hasJoinedRef.current && !hasLeftRef.current) {
        leaveRoom(Number(id)).catch(() => {});
      }
    };
  }, [id]);

  const handleCopyLink = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      toast.success(t("lobby.roomLobby.copyLinkSuccess"));
    } catch {
      toast.error(t("lobby.roomLobby.copyLinkFailed", { code: room.code }));
    }
  };

  const handleLeaveRoom = async () => {
    hasLeftRef.current = true;
    try {
      await leaveRoom(Number(id));
    } catch {
      // Even on error, navigate back
    }
    navigate("/lobby");
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8" data-testid="room-lobby-loading">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-surface" />
        <div className="grid grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8 text-center" data-testid="room-lobby-error">
        <p className="mb-4 text-text-secondary">{error ?? t("lobby.roomLobby.notFound")}</p>
        <Button variant="ghost" onClick={() => navigate("/lobby")} data-testid="back-to-lobby">
          {t("lobby.roomLobby.notFoundAction")}
        </Button>
      </div>
    );
  }

  const variantLabel = t(variantKeys[room.variant] ?? room.variant);
  const matchModeLabel = t(matchModeKeys[room.matchMode] ?? room.matchMode);
  const timerLabel =
    room.timerStyle === "relaxed"
      ? t("lobby.roomList.timerRelaxed")
      : t("lobby.roomList.timerPerMove", { seconds: room.timerDurationSeconds ?? "?" });

  return (
    <div className="mx-auto max-w-2xl px-8 py-8" data-testid="room-lobby">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Button variant="ghost" onClick={handleLeaveRoom} data-testid="back-to-lobby">
          &larr; {t("lobby.roomLobby.backToLobby")}
        </Button>
        <h1 className="font-display text-2xl font-semibold text-text-primary">{room.name}</h1>
        <Button variant="ghost" onClick={handleCopyLink} data-testid="copy-link">
          {t("lobby.roomLobby.copyLink")}
        </Button>
      </div>

      {/* Player seats grid */}
      <div className="mb-8 grid grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((seatIndex) => {
          const player = players[seatIndex];
          const isCurrentUser = player && currentUser && player.userId === currentUser.id;
          const isOwner = player && player.userId === room.ownerId;

          return (
            <div
              key={seatIndex}
              className={`flex min-h-24 flex-col items-center justify-center rounded-xl p-6 ${
                player
                  ? `border border-border bg-surface ${isCurrentUser ? "ring-1 ring-accent" : ""}`
                  : "border border-dashed border-border bg-surface/50"
              }`}
              data-testid={`player-seat-${seatIndex}`}
            >
              {player ? (
                <div className="text-center">
                  <span className="font-semibold text-text-primary">{player.username}</span>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    {isCurrentUser && (
                      <span className="text-xs text-accent">{t("lobby.roomLobby.seatYou")}</span>
                    )}
                    {isOwner && (
                      <span className="text-xs text-text-secondary">
                        {t("lobby.roomLobby.seatOwner")}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-text-secondary">{t("lobby.roomLobby.seatEmpty")}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Room config bar + Leave */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {variantLabel} &middot; {matchModeLabel} &middot; {timerLabel}
        </p>
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={handleLeaveRoom}
          data-testid="leave-room"
        >
          {t("lobby.roomLobby.leaveRoom")}
        </Button>
      </div>
    </div>
  );
}
