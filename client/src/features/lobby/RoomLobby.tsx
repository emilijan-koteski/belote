import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import { useLeaveRoomMutation, useSelectSeatMutation, useStartGameMutation } from "@/shared/hooks/mutations/useRooms";
import { useRoomDetailQuery } from "@/shared/hooks/queries/useRooms";
import { useAuthStore } from "@/shared/stores/authStore";
import { useRoomLobbyStore } from "@/shared/stores/roomLobbyStore";
import type { RoomPlayer } from "@/shared/types/apiTypes";

const variantKeys: Record<string, string> = {
  bitola: "lobby.roomList.variantBitola",
};

const matchModeKeys: Record<string, string> = {
  "1001": "lobby.roomList.matchMode1001",
};

// Seat layout: left column = Red (0, 2), right column = Blue (1, 3)
const SEAT_LAYOUT = [
  [0, 1],
  [2, 3],
] as const;

function getTeamForSeat(seat: number): "red" | "blue" {
  return seat % 2 === 0 ? "red" : "blue";
}

function getPlayerAtSeat(players: RoomPlayer[], seatIndex: number): RoomPlayer | undefined {
  return players.find((p) => p.seat === seatIndex);
}

export function RoomLobby() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  // TanStack Query for initial REST fetch
  const roomQuery = useRoomDetailQuery(id ? Number(id) : undefined);

  // Zustand store for real-time WS updates (source of truth for rendering)
  const storeRoom = useRoomLobbyStore((s) => s.room);
  const storePlayers = useRoomLobbyStore((s) => s.players);
  const gameStarted = useRoomLobbyStore((s) => s.gameStarted);

  const hasLeftRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // Mutations
  const selectSeatMutation = useSelectSeatMutation();
  const startGameMutation = useStartGameMutation();
  const leaveRoomMutation = useLeaveRoomMutation();

  // Seed roomLobbyStore from query data
  useEffect(() => {
    if (roomQuery.data) {
      const store = useRoomLobbyStore.getState();
      store.setRoom(roomQuery.data.room);
      store.setPlayers(roomQuery.data.players);
      store.setCurrentRoomId(roomQuery.data.room.id);
      const userId = useAuthStore.getState().user?.id;
      if (userId && roomQuery.data.players.some((p) => p.userId === userId)) {
        hasJoinedRef.current = true;
      }
    }
  }, [roomQuery.data]);

  // Handle game_started from WebSocket — navigate all players to the game page
  useEffect(() => {
    if (gameStarted && id) {
      hasLeftRef.current = true; // Prevent cleanup leave on navigation
      navigate(`/game/${id}`);
    }
  }, [gameStarted, id, navigate]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      useRoomLobbyStore.getState().reset();
    };
  }, []);

  // Leave room on unmount if player joined and hasn't explicitly left
  useEffect(() => {
    return () => {
      if (id && hasJoinedRef.current && !hasLeftRef.current) {
        leaveRoomMutation.mutate(Number(id));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCopyLink = async () => {
    if (!storeRoom) return;
    try {
      await navigator.clipboard.writeText(storeRoom.code);
      toast.success(t("lobby.roomLobby.copyLinkSuccess"));
    } catch {
      toast.error(t("lobby.roomLobby.copyLinkFailed", { code: storeRoom.code }));
    }
  };

  const handleLeaveRoom = async () => {
    hasLeftRef.current = true;
    try {
      await leaveRoomMutation.mutateAsync(Number(id));
    } catch {
      // Even on error, navigate back
    }
    navigate("/lobby");
  };

  const handleSelectSeat = async (seatIndex: number) => {
    if (!storeRoom) return;
    try {
      const data = await selectSeatMutation.mutateAsync({ roomId: storeRoom.id, seat: seatIndex });
      // Update players from response (in case WS hasn't arrived yet)
      useRoomLobbyStore.getState().setPlayers(data.players);
      if (data.gameStarted) {
        hasLeftRef.current = true;
        navigate(`/game/${storeRoom.id}`);
        return;
      }
    } catch (err) {
      if (err instanceof FetchError && err.code === "SEAT_TAKEN") {
        toast.error(t("lobby.roomLobby.seatTaken"));
      } else {
        toast.error(t("lobby.roomLobby.errors.seatFailed"));
      }
    }
  };

  const handleStartGame = async () => {
    if (!storeRoom || startGameMutation.isPending) return;
    try {
      await startGameMutation.mutateAsync(storeRoom.id);
      hasLeftRef.current = true; // Prevent cleanup leave on navigation
      navigate(`/game/${storeRoom.id}`);
    } catch (err) {
      if (err instanceof FetchError && err.code === "NOT_ROOM_OWNER") {
        toast.error(t("lobby.roomLobby.errors.notOwner"));
      } else if (err instanceof FetchError && err.code === "NOT_ALL_SEATED") {
        toast.error(t("lobby.roomLobby.errors.notAllSeated"));
      } else {
        toast.error(t("lobby.roomLobby.errors.startFailed"));
      }
    }
  };

  // Use query loading state for initial load
  if (roomQuery.isPending) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8" data-testid="room-lobby-loading">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-surface" />
        <div className="grid grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    );
  }

  if (roomQuery.isError || (!storeRoom && !roomQuery.data)) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8 text-center" data-testid="room-lobby-error">
        <p className="mb-4 text-text-secondary">{t("lobby.roomLobby.notFound")}</p>
        <Button variant="ghost" onClick={() => navigate("/lobby")} data-testid="back-to-lobby">
          {t("lobby.roomLobby.notFoundAction")}
        </Button>
      </div>
    );
  }

  // Render from store (source of truth after initial seed), fall back to query data
  // during the brief window before the seeding effect runs
  const room = storeRoom ?? roomQuery.data!.room;
  const players = storePlayers.length > 0 ? storePlayers : roomQuery.data!.players;

  const variantLabel = t(variantKeys[room.variant] ?? room.variant);
  const matchModeLabel = t(matchModeKeys[room.matchMode] ?? room.matchMode);
  const timerLabel =
    room.timerStyle === "relaxed"
      ? t("lobby.roomList.timerRelaxed")
      : t("lobby.roomList.timerPerMove", { seconds: room.timerDurationSeconds ?? "?" });

  const isOwner = currentUser !== null && currentUser.id === room.ownerId;
  const seatedCount = players.filter((p) => p.seat !== null).length;
  const allSeated = seatedCount === 4;

  const ownerPlayer = players.find((p) => p.userId === room.ownerId);
  const ownerUsername = ownerPlayer?.username ?? t("lobby.roomLobby.seatOwner");

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

      {/* Team labels */}
      <div className="mb-4 grid grid-cols-2 gap-6">
        <p className="text-center text-sm font-semibold text-team-red">
          {t("lobby.roomLobby.teamRed")}
        </p>
        <p className="text-center text-sm font-semibold text-team-blue">
          {t("lobby.roomLobby.teamBlue")}
        </p>
      </div>

      {/* Player seats grid — 2 rows x 2 columns */}
      <div className="mb-8 grid grid-cols-2 gap-6">
        {SEAT_LAYOUT.map((row) =>
          row.map((seatIndex) => {
            const player = getPlayerAtSeat(players, seatIndex);
            const team = getTeamForSeat(seatIndex);
            const isCurrentUser =
              player !== undefined && currentUser !== null && player.userId === currentUser.id;
            const isSeatOwner = player !== undefined && player.userId === room.ownerId;
            const isClickable = player === undefined || isCurrentUser;

            const teamBorderClass = team === "red" ? "border-team-red" : "border-team-blue";

            return (
              <button
                key={seatIndex}
                type="button"
                className={`flex min-h-24 flex-col items-center justify-center rounded-xl border-2 p-6 transition-colors ${
                  player !== undefined
                    ? `bg-surface ${teamBorderClass} ${isCurrentUser ? "ring-1 ring-accent" : ""} ${
                        isClickable ? "cursor-pointer hover:bg-surface-elevated" : "cursor-default"
                      }`
                    : `border-dashed ${teamBorderClass} bg-surface/50 cursor-pointer hover:bg-surface/80`
                }`}
                onClick={() => {
                  if (isClickable) {
                    handleSelectSeat(seatIndex);
                  }
                }}
                disabled={!isClickable}
                data-testid={`player-seat-${seatIndex}`}
              >
                {player !== undefined ? (
                  <div className="text-center">
                    <span className="font-semibold text-text-primary">{player.username}</span>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      {isCurrentUser && (
                        <span className="text-xs text-accent">{t("lobby.roomLobby.seatYou")}</span>
                      )}
                      {isSeatOwner && (
                        <span className="text-xs text-text-secondary">
                          {t("lobby.roomLobby.seatOwner")}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-text-secondary">{t("lobby.roomLobby.seatEmpty")}</span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {/* Room config bar */}
      <div className="mb-6">
        <p className="text-sm text-text-secondary">
          {variantLabel} &middot; {matchModeLabel} &middot; {timerLabel}
        </p>
      </div>

      {/* Start Game / Waiting message */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          {room.isQuickPlay ? (
            <p className="text-sm text-text-secondary" data-testid="auto-start-message">
              {allSeated
                ? t("lobby.roomLobby.autoStarting")
                : t("lobby.roomLobby.autoStartMessage")}
            </p>
          ) : isOwner ? (
            <Button
              onClick={handleStartGame}
              disabled={!allSeated || startGameMutation.isPending}
              className={allSeated && !startGameMutation.isPending ? "" : "opacity-40 cursor-not-allowed"}
              title={allSeated ? undefined : t("lobby.roomLobby.startGameDisabled")}
              data-testid="start-game"
            >
              {startGameMutation.isPending ? t("lobby.roomLobby.gameStarting") : t("lobby.roomLobby.startGame")}
            </Button>
          ) : allSeated ? (
            <p className="text-sm text-text-secondary" data-testid="waiting-for-start">
              {t("lobby.roomLobby.waitingForOwner", { owner: ownerUsername })}
            </p>
          ) : null}
        </div>
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
