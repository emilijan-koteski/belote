import { Check, Clock, Copy, Crown, Trophy, Users, UserX, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ChatPanel } from "@/features/chat/ChatPanel";
import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  useKickPlayerMutation,
  useLeaveRoomMutation,
  useLeaveSeatMutation,
  useSelectSeatMutation,
  useStartGameMutation,
  useSwapSeatsMutation,
  useTransferOwnershipMutation,
} from "@/shared/hooks/mutations/useRooms";
import { useRoomDetailQuery } from "@/shared/hooks/queries/useRooms";
import { useWsConnectionState } from "@/shared/providers/WebSocketContext";
import { useAuthStore } from "@/shared/stores/authStore";
import { useChatStore } from "@/shared/stores/chatStore";
import { useRoomLobbyStore } from "@/shared/stores/roomLobbyStore";
import type { RoomPlayer } from "@/shared/types/apiTypes";
import type { TeamString } from "@/shared/types/gameTypes";

const variantKeys: Record<string, string> = {
  bitola: "lobby.roomList.variantBitola",
};

const matchModeKeys: Record<string, string> = {
  "1001": "lobby.roomList.matchMode1001",
};

// Cardinal positions for the diamond seat layout. In the waiting room seat
// indices map 1:1 to fixed cardinal positions (no viewer-relative rotation).
// This is intentionally different from the in-game table where the viewer
// rotates to the bottom: in the lobby the player has no hand to anchor, and
// rotating after a click made seat selection feel unpredictable ("I clicked
// the top tile but landed at the bottom"). Fixed positions match the click
// target.
type CardinalPosition = "south" | "east" | "north" | "west";

const SEAT_INDEXES = [0, 1, 2, 3] as const;

const SEAT_TO_CARDINAL: Record<number, CardinalPosition> = {
  0: "south",
  1: "east",
  2: "north",
  3: "west",
};

const GRID_AREA: Record<CardinalPosition, string> = {
  south: "south",
  east: "east",
  north: "north",
  west: "west",
};

function getTeamForSeat(seatIndex: number): TeamString {
  return seatIndex % 2 === 0 ? "teamA" : "teamB";
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

  // WebSocket connection state — used to refetch after reconnection
  const wsState = useWsConnectionState();
  const prevWsStateRef = useRef(wsState);

  // Zustand store for real-time WS updates (source of truth for rendering)
  const storeRoom = useRoomLobbyStore((s) => s.room);
  const storePlayers = useRoomLobbyStore((s) => s.players);
  const gameStarted = useRoomLobbyStore((s) => s.gameStarted);
  const kickedFromRoomId = useRoomLobbyStore((s) => s.kickedFromRoomId);

  const hasLeftRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // Owner-only transient UI state — kept local instead of pushed into a store
  // because nothing outside RoomLobby cares about it.
  const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);
  const [kickConfirm, setKickConfirm] = useState<{
    seat: number;
    userId: number;
    username: string;
  } | null>(null);
  const [transferConfirm, setTransferConfirm] = useState<{
    userId: number;
    username: string;
  } | null>(null);

  // Mutations
  const selectSeatMutation = useSelectSeatMutation();
  const startGameMutation = useStartGameMutation();
  const leaveRoomMutation = useLeaveRoomMutation();
  const kickPlayerMutation = useKickPlayerMutation();
  const swapSeatsMutation = useSwapSeatsMutation();
  const leaveSeatMutation = useLeaveSeatMutation();
  const transferOwnershipMutation = useTransferOwnershipMutation();

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

  // Refetch room state after WebSocket reconnects to catch events missed during disconnect
  useEffect(() => {
    const prev = prevWsStateRef.current;
    prevWsStateRef.current = wsState;
    if (wsState === "connected" && prev !== "connected") {
      roomQuery.refetch();
    }
  }, [wsState, roomQuery]);

  // Handle game_started from WebSocket — navigate all players to the game page.
  // Pass `fromRoom: true` so GamePage's splash gate triggers (deliberate beat
  // masking the room→game transition).
  useEffect(() => {
    if (gameStarted && id) {
      hasLeftRef.current = true; // Prevent cleanup leave on navigation
      navigate(`/game/${id}`, { state: { fromRoom: true } });
    }
  }, [gameStarted, id, navigate]);

  // Closed-room auto-redirect — once a match ends (or the room is cancelled)
  // the row flips to a terminal status but the URL still resolves. Without
  // this guard, deep-linking to a finished room rendered the seat grid and
  // "waiting for owner to start" copy as if the room were live. We surface a
  // "Room is closed" message for a beat, then navigate to /lobby. Note that
  // "playing" is *not* terminal — the room is live and existing in-room logic
  // (kick gating, gameStarted handler) already covers that path.
  const currentRoomStatus = storeRoom?.status ?? roomQuery.data?.room.status ?? null;
  const isRoomClosed =
    currentRoomStatus === "completed" ||
    currentRoomStatus === "cancelled" ||
    currentRoomStatus === "finished";
  useEffect(() => {
    if (!isRoomClosed || gameStarted) return;
    hasLeftRef.current = true; // Don't fire the cleanup-leave on the way out
    const timer = setTimeout(() => {
      navigate("/lobby", { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [isRoomClosed, gameStarted, navigate]);

  // Handle system:room_kicked — toast + redirect kicked user back to /lobby.
  // Suppress the unmount auto-leave: the server has already removed us, so
  // the cleanup `/leave` would 404; setting hasLeftRef before navigate keeps
  // the cleanup quiet.
  useEffect(() => {
    if (kickedFromRoomId !== null && id && kickedFromRoomId === Number(id)) {
      hasLeftRef.current = true;
      toast.error(t("lobby.roomLobby.kickedToast", { name: storeRoom?.name ?? "" }));
      useRoomLobbyStore.getState().setKickedFromRoom(null);
      navigate("/lobby");
    }
  }, [kickedFromRoomId, id, navigate, storeRoom?.name, t]);

  // Clear swap-mode whenever the room exits "waiting" status — owner controls
  // disappear in the same render, so a stale source-seat must not survive.
  useEffect(() => {
    if (storeRoom && storeRoom.status !== "waiting") {
      setSwapSourceSeat(null);
    }
  }, [storeRoom]);

  // Clear swap-mode if the source player vacates their seat (left the room or
  // moved seats while we were deciding) — otherwise the next click would fire
  // a swap with an empty source seat and trip SEAT_NOT_OCCUPIED.
  useEffect(() => {
    if (swapSourceSeat !== null && getPlayerAtSeat(storePlayers, swapSourceSeat) === undefined) {
      setSwapSourceSeat(null);
    }
  }, [storePlayers, swapSourceSeat]);

  // Reset stores on unmount AND on :id change — React Router keeps RoomLobby
  // mounted across /rooms/:id navigations, so a []-dep cleanup would let
  // room-A chat leak into room-B's UI. Keying the cleanup on `id` fires it
  // both when the route param changes and when the component unmounts.
  useEffect(() => {
    return () => {
      useRoomLobbyStore.getState().reset();
      useChatStore.getState().clearRoom();
    };
  }, [id]);

  // Leave room on unmount if player joined and hasn't explicitly left
  useEffect(() => {
    return () => {
      if (id && hasJoinedRef.current && !hasLeftRef.current) {
        leaveRoomMutation.mutate(Number(id));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // `justCopied` flips the copy-code button into a transient success state
  // (check icon + "Copied!" inline) so the user gets immediate confirmation
  // without relying on the toast alone — the toast is easy to miss when the
  // user's eyes are on the button they just clicked.
  const [justCopied, setJustCopied] = useState(false);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  const handleCopyLink = async () => {
    if (!storeRoom) return;
    try {
      await navigator.clipboard.writeText(storeRoom.code);
      toast.success(t("lobby.roomLobby.copyLinkSuccess"));
      setJustCopied(true);
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = setTimeout(() => setJustCopied(false), 2000);
    } catch {
      toast.error(t("lobby.roomLobby.copyLinkFailed", { code: storeRoom.code }));
    }
  };

  const handleLeaveRoom = async () => {
    hasLeftRef.current = true;
    try {
      await leaveRoomMutation.mutateAsync(Number(id));
    } catch (err) {
      // Story 8.5-1 AC3: server returns 409 GAME_ALREADY_STARTED when the
      // room transitioned to "playing" between the user clicking leave and
      // the leave tx running. Surface a toast and abort the navigation —
      // the client should stay in the room (the auto-start UI flow takes
      // over from here).
      if (err instanceof FetchError && err.code === "GAME_ALREADY_STARTED") {
        hasLeftRef.current = false;
        toast.error(t("room.errors.alreadyStarted"));
        return;
      }
      // Other errors: still navigate back (preserves prior UX).
    }
    navigate("/lobby");
  };

  const handleSelectSeat = async (seatIndex: number) => {
    if (!storeRoom) return;
    // If the owner is in swap-mode, route the click to the swap target handler
    // instead of the regular seat-select path.
    if (swapSourceSeat !== null) {
      handleSwapTarget(seatIndex);
      return;
    }
    try {
      const data = await selectSeatMutation.mutateAsync({ roomId: storeRoom.id, seat: seatIndex });
      // Update players from response (in case WS hasn't arrived yet)
      useRoomLobbyStore.getState().setPlayers(data.players);
      if (data.gameStarted) {
        hasLeftRef.current = true;
        navigate(`/game/${storeRoom.id}`, { state: { fromRoom: true } });
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

  const handleSwapTarget = async (targetSeat: number) => {
    if (!storeRoom || swapSourceSeat === null) return;

    // Click the source again, the current user's own seat, or any click while
    // a swap is already pending cancels swap mode without firing the API.
    // Empty target seats are valid — they trigger a move-to-empty server-side.
    const targetPlayer = getPlayerAtSeat(players, targetSeat);
    const isCurrentUser =
      targetPlayer !== undefined && currentUser !== null && targetPlayer.userId === currentUser.id;
    if (
      targetSeat === swapSourceSeat ||
      isCurrentUser ||
      swapSeatsMutation.isPending
    ) {
      setSwapSourceSeat(null);
      return;
    }

    const seatA = swapSourceSeat;
    setSwapSourceSeat(null);
    try {
      await swapSeatsMutation.mutateAsync({
        roomId: storeRoom.id,
        seatA,
        seatB: targetSeat,
      });
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "NOT_ROOM_OWNER") {
          toast.error(t("lobby.roomLobby.errors.notOwnerAction"));
        } else if (err.code === "ROOM_NOT_WAITING") {
          toast.error(t("lobby.roomLobby.errors.roomStarted"));
        } else if (err.code === "SEAT_NOT_OCCUPIED") {
          toast.error(t("lobby.roomLobby.errors.seatNotOccupied"));
        } else {
          toast.error(t("lobby.roomLobby.errors.swapFailed"));
        }
      } else {
        toast.error(t("lobby.roomLobby.errors.swapFailed"));
      }
    }
  };

  const handleLeaveSeat = async () => {
    if (!storeRoom || leaveSeatMutation.isPending) return;
    try {
      const data = await leaveSeatMutation.mutateAsync({ roomId: storeRoom.id });
      useRoomLobbyStore.getState().setPlayers(data.players);
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "QUICK_PLAY_LEAVE_SEAT_BLOCKED") {
          toast.error(t("lobby.roomLobby.errors.leaveSeatQuickPlay"));
        } else if (err.code === "OWNER_CANNOT_LEAVE_SEAT") {
          toast.error(t("lobby.roomLobby.errors.leaveSeatOwner"));
        } else if (err.code === "ROOM_NOT_WAITING") {
          toast.error(t("lobby.roomLobby.errors.roomStarted"));
        } else {
          toast.error(t("lobby.roomLobby.errors.leaveSeatFailed"));
        }
      } else {
        toast.error(t("lobby.roomLobby.errors.leaveSeatFailed"));
      }
    }
  };

  const handleTransferConfirm = async () => {
    if (!storeRoom || !transferConfirm) return;
    const target = transferConfirm;
    setTransferConfirm(null);
    try {
      await transferOwnershipMutation.mutateAsync({
        roomId: storeRoom.id,
        userId: target.userId,
      });
      // Server WS broadcast (system:room_owner_changed) converges store state.
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "NOT_ROOM_OWNER") {
          toast.error(t("lobby.roomLobby.errors.notOwnerAction"));
        } else if (err.code === "ROOM_NOT_WAITING") {
          toast.error(t("lobby.roomLobby.errors.roomStarted"));
        } else if (err.code === "CANNOT_PROMOTE_UNSEATED") {
          toast.error(t("lobby.roomLobby.errors.promoteUnseated"));
        } else if (err.code === "NOT_IN_ROOM") {
          toast.error(t("lobby.roomLobby.errors.promoteNotInRoom"));
        } else {
          toast.error(t("lobby.roomLobby.errors.transferFailed"));
        }
      } else {
        toast.error(t("lobby.roomLobby.errors.transferFailed"));
      }
    }
  };

  const handleKickConfirm = async () => {
    if (!storeRoom || !kickConfirm) return;
    const target = kickConfirm;
    setKickConfirm(null);
    try {
      await kickPlayerMutation.mutateAsync({
        roomId: storeRoom.id,
        userId: target.userId,
      });
      // Server WS broadcast (system:player_left) converges store state — no
      // optimistic update.
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "NOT_ROOM_OWNER") {
          toast.error(t("lobby.roomLobby.errors.notOwnerAction"));
        } else if (err.code === "ROOM_NOT_WAITING") {
          toast.error(t("lobby.roomLobby.errors.roomStarted"));
        } else {
          toast.error(t("lobby.roomLobby.errors.kickFailed"));
        }
      } else {
        toast.error(t("lobby.roomLobby.errors.kickFailed"));
      }
    }
  };

  const handleStartGame = async () => {
    if (!storeRoom || startGameMutation.isPending) return;
    try {
      await startGameMutation.mutateAsync(storeRoom.id);
      hasLeftRef.current = true; // Prevent cleanup leave on navigation
      navigate(`/game/${storeRoom.id}`, { state: { fromRoom: true } });
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

  if (isRoomClosed && !gameStarted) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8 text-center" data-testid="room-lobby-closed">
        <p className="mb-2 text-text-primary font-display text-lg">
          {t("lobby.roomLobby.roomClosed")}
        </p>
        <p className="text-text-secondary text-sm animate-pulse">
          {t("lobby.roomLobby.returningToLobby")}
        </p>
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
  const isRelaxed = room.timerStyle === "relaxed";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div data-testid="room-lobby">
          {/* Header — back button on the left, copy-link on the right.
              Title sits in the info card below where it gets proper context. */}
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" onClick={handleLeaveRoom} data-testid="back-to-lobby">
              &larr; {t("lobby.roomLobby.backToLobby")}
            </Button>
            <button
              type="button"
              onClick={handleCopyLink}
              data-testid="copy-link"
              aria-label={t("lobby.roomLobby.copyLinkAriaLabel", { code: room.code })}
              title={t("lobby.roomLobby.copyLinkAriaLabel", { code: room.code })}
              className={`group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                justCopied
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-border bg-surface text-text-primary hover:border-accent/50 hover:bg-surface-elevated"
              }`}
            >
              <span className="text-xs uppercase tracking-wider text-text-secondary group-hover:text-text-primary">
                {t("lobby.roomLobby.codeLabel")}
              </span>
              <span className="font-mono font-semibold tracking-widest" data-testid="room-code">
                {room.code}
              </span>
              {justCopied ? (
                <span className="inline-flex items-center gap-1" data-testid="copy-link-copied">
                  <Check className="h-4 w-4" />
                  <span className="text-xs font-medium">{t("lobby.roomLobby.copied")}</span>
                </span>
              ) : (
                <Copy className="h-4 w-4 text-text-secondary transition-colors group-hover:text-accent" />
              )}
            </button>
          </div>

          {/* Room info card — title + game-mode badges + owner + seated count.
              Replaces the single line of metadata that used to sit under the
              seat grid; surfacing Quick Play / Relaxed / variant up here makes
              the room's flavor obvious before the player commits to a seat. */}
          <div
            className="mb-6 rounded-xl border border-border bg-surface p-5"
            data-testid="room-info-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1
                className="font-display text-2xl font-semibold text-text-primary"
                data-testid="room-info-name"
              >
                {room.name}
              </h1>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 outline-none transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={t("lobby.roomLobby.inRoomList.ariaLabel")}
                    data-testid="in-room-count"
                  >
                    <Users className="h-4 w-4" />
                    <span>{t("lobby.roomLobby.inRoomCount", { count: players.length })}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-48 bg-surface-elevated"
                    data-testid="in-room-list"
                  >
                    <div className="px-1.5 py-1 text-xs font-medium text-text-secondary">
                      {t("lobby.roomLobby.inRoomList.title")}
                    </div>
                    {players.length === 0 ? (
                      <p className="px-1.5 py-1 text-xs text-text-secondary">
                        {t("lobby.roomLobby.inRoomList.empty")}
                      </p>
                    ) : (
                      <ul className="flex flex-col">
                        {players.map((p) => {
                          const isYou = currentUser?.id === p.userId;
                          const isRoomOwner = p.userId === room.ownerId;
                          const isWaiting = room.status === "waiting";
                          const ownerCanActOnRow =
                            isOwner && isWaiting && !isRoomOwner && !isYou;
                          // Owner-only actions land in the dropdown so the
                          // owner can also reach unseated members (the diamond
                          // tiles only render seated players). Promote is
                          // restricted to seated targets — see
                          // ErrCannotPromoteUnseated.
                          const ownerCanKickRow = ownerCanActOnRow;
                          const ownerCanPromoteRow =
                            ownerCanActOnRow && p.seat !== null;
                          const seatLabel =
                            p.seat !== null
                              ? t("lobby.roomLobby.inRoomList.seated", { seat: p.seat + 1 })
                              : t("lobby.roomLobby.inRoomList.notSeated");
                          return (
                            <li
                              key={p.userId}
                              className="flex items-center justify-between gap-2 px-1.5 py-1 text-sm"
                              data-testid={`in-room-list-item-${p.userId}`}
                            >
                              <span className="flex items-center gap-1.5 text-text-primary">
                                {isRoomOwner && (
                                  <Crown className="h-3 w-3 text-warning" aria-hidden />
                                )}
                                <span className="truncate">{p.username}</span>
                                {isYou && (
                                  <span className="text-xs font-medium text-success">
                                    ({t("lobby.roomLobby.seatYou")})
                                  </span>
                                )}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span
                                  className={`text-xs ${
                                    p.seat !== null ? "text-success" : "text-text-secondary"
                                  }`}
                                >
                                  {seatLabel}
                                </span>
                                {ownerCanPromoteRow && (
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-text-secondary transition-colors hover:bg-surface hover:text-warning disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={t("lobby.roomLobby.promoteIconLabel", {
                                      username: p.username,
                                    })}
                                    title={t("lobby.roomLobby.promoteIconLabel", {
                                      username: p.username,
                                    })}
                                    data-testid={`promote-player-${p.userId}`}
                                    disabled={transferOwnershipMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTransferConfirm({
                                        userId: p.userId,
                                        username: p.username,
                                      });
                                    }}
                                  >
                                    <Crown className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {ownerCanKickRow && (
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-text-secondary transition-colors hover:bg-surface hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={t("lobby.roomLobby.kickIconLabel", {
                                      username: p.username,
                                    })}
                                    title={t("lobby.roomLobby.kickIconLabel", {
                                      username: p.username,
                                    })}
                                    data-testid={`kick-list-${p.userId}`}
                                    disabled={kickPlayerMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSwapSourceSeat(null);
                                      setKickConfirm({
                                        seat: p.seat ?? -1,
                                        userId: p.userId,
                                        username: p.username,
                                      });
                                    }}
                                  >
                                    <UserX className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span data-testid="seated-count">
                  {t("lobby.roomLobby.seatedCount", { current: seatedCount, max: 4 })}
                </span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="room-info-badges">
              <span
                className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-1 text-xs font-medium text-text-primary"
                data-testid="badge-variant"
              >
                <Trophy className="h-3 w-3 text-accent" />
                {variantLabel}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-1 text-xs font-medium text-text-primary"
                data-testid="badge-match-mode"
              >
                {matchModeLabel}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                  isRelaxed ? "bg-success/15 text-success" : "bg-surface-elevated text-text-primary"
                }`}
                data-testid="badge-timer"
              >
                <Clock className="h-3 w-3" />
                {timerLabel}
              </span>
              {room.isQuickPlay && (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-accent-glow px-2 py-1 text-xs font-medium text-accent"
                  data-testid="badge-quick-play"
                >
                  <Zap className="h-3 w-3" />
                  {t("lobby.quickPlay")}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1 text-sm text-text-secondary">
              <Crown className="h-4 w-4 text-warning" />
              <span data-testid="room-info-owner">
                {t("lobby.roomLobby.ownerLine", { owner: ownerUsername })}
              </span>
            </div>
          </div>

          {/* Team legend — sits above the seat layout in every breakpoint so
              players know which colored lane = which team before they pick. */}
          <div className="mb-3 flex items-center justify-center gap-6 text-sm font-semibold">
            <span className="inline-flex items-center gap-2 text-team-a" data-team="teamA">
              <span aria-hidden className="h-2 w-6 rounded bg-team-a" />
              {t("team.a")}
            </span>
            <span className="inline-flex items-center gap-2 text-team-b" data-team="teamB">
              <span aria-hidden className="h-2 w-6 rounded bg-team-b" />
              {t("team.b")}
            </span>
          </div>

          {/* Diamond seat layout. Seats are pinned to fixed cardinal positions
              (seat 0 → south, 1 → east, 2 → north, 3 → west) — the lobby does
              NOT rotate to put the viewer at the bottom. The in-game table
              rotates separately on /game/:id. The vertical pair (seats 0+2) is
              Team A, the horizontal pair (1+3) is Team B; faint team-color
              connector lines tie each pair together so partnership reads at a
              glance. */}
          <div className="relative" data-testid="seats-grid">
            {/* Partner connectors — vertical for Team A, horizontal for Team B.
                Sit behind the seat tiles via z-index. Hidden on the <sm
                stacked layout where row/column position already conveys
                partnership. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden sm:block">
              <div className="absolute left-1/2 top-[12%] h-[76%] w-0.5 -translate-x-1/2 bg-team-a/30" />
              <div className="absolute top-1/2 left-[12%] h-0.5 w-[76%] -translate-y-1/2 bg-team-b/30" />
            </div>

            <div className="relative z-10 mb-8 grid gap-6 grid-cols-2 sm:grid-cols-[1fr_1fr_1fr] sm:[grid-template-areas:'._north_.''west_._east''._south_.']">
              {SEAT_INDEXES.map((seatIndex) => {
                const player = getPlayerAtSeat(players, seatIndex);
                const team = getTeamForSeat(seatIndex);
                const cardinal = SEAT_TO_CARDINAL[seatIndex] as CardinalPosition;
                const isCurrentUser =
                  player !== undefined && currentUser !== null && player.userId === currentUser.id;
                const isSeatOwner = player !== undefined && player.userId === room.ownerId;
                const isWaiting = room.status === "waiting";
                const ownerCanKick = isOwner && isWaiting && player !== undefined && !isSeatOwner;
                const isSwapSource = swapSourceSeat === seatIndex;
                const inSwapMode = swapSourceSeat !== null;
                const ownerCanInitiateSwap =
                  isOwner && isWaiting && player !== undefined && !isCurrentUser && !inSwapMode;
                // Self-unseat is only offered in non-quick-play rooms, while waiting,
                // and never for the room owner (owners exit via leave-room — see
                // backend ErrOwnerCannotLeaveSeat). Hidden during swap mode so a
                // self-click stays a swap-cancel gesture, not an accidental unseat.
                const canLeaveOwnSeat =
                  isCurrentUser && isWaiting && !room.isQuickPlay && !isSeatOwner && !inSwapMode;
                const isClickable =
                  player === undefined || isCurrentUser || ownerCanInitiateSwap || inSwapMode;
                const kickPendingForThisSeat =
                  kickPlayerMutation.isPending &&
                  player !== undefined &&
                  kickPlayerMutation.variables?.userId === player.userId;
                const swapPendingForThisSeat =
                  swapSeatsMutation.isPending &&
                  (swapSeatsMutation.variables?.seatA === seatIndex ||
                    swapSeatsMutation.variables?.seatB === seatIndex);
                const leaveSeatPendingForThisSeat =
                  leaveSeatMutation.isPending && isCurrentUser;
                const isPendingForThisSeat =
                  kickPendingForThisSeat || swapPendingForThisSeat || leaveSeatPendingForThisSeat;

                const teamBorderClass = team === "teamA" ? "border-team-a" : "border-team-b";
                const teamTintClass = team === "teamA" ? "bg-team-a/5" : "bg-team-b/5";

                return (
                  <div
                    key={seatIndex}
                    className="group relative"
                    style={{ gridArea: GRID_AREA[cardinal] }}
                    data-testid={`seat-position-${cardinal}`}
                    data-team={team}
                  >
                    <button
                      type="button"
                      className={`flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 p-5 transition-all ${
                        player !== undefined
                          ? `${teamTintClass} ${teamBorderClass} ${
                              isCurrentUser ? "ring-2 ring-accent shadow-lg shadow-accent/20" : ""
                            } ${isSwapSource ? "ring-2 ring-accent" : ""} ${
                              isClickable
                                ? "cursor-pointer hover:bg-surface-elevated"
                                : "cursor-default"
                            }`
                          : `border-dashed ${teamBorderClass} bg-surface/50 cursor-pointer hover:bg-surface/80`
                      } ${isPendingForThisSeat ? "opacity-60 pointer-events-none" : ""}`}
                      onClick={() => {
                        if (inSwapMode) {
                          handleSwapTarget(seatIndex);
                          return;
                        }
                        if (ownerCanInitiateSwap) {
                          setSwapSourceSeat(seatIndex);
                          return;
                        }
                        if (canLeaveOwnSeat) {
                          handleLeaveSeat();
                          return;
                        }
                        if (isClickable) {
                          handleSelectSeat(seatIndex);
                        }
                      }}
                      disabled={!isClickable || isPendingForThisSeat}
                      data-testid={`player-seat-${seatIndex}`}
                    >
                      {player !== undefined ? (
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isSeatOwner && (
                              <Crown
                                className="h-4 w-4 text-warning"
                                aria-label={t("lobby.roomLobby.seatOwner")}
                                data-testid={`owner-crown-${seatIndex}`}
                              />
                            )}
                            <span className="font-semibold text-text-primary">
                              {player.username}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-center gap-2">
                            {isCurrentUser && (
                              <span className="rounded bg-accent-glow px-2 py-0.5 text-xs font-medium text-accent">
                                {t("lobby.roomLobby.seatYou")}
                              </span>
                            )}
                            {isSeatOwner && (
                              <span className="text-xs text-text-secondary">
                                {t("lobby.roomLobby.seatOwner")}
                              </span>
                            )}
                          </div>
                          {isSwapSource && (
                            <p className="mt-2 text-xs text-text-secondary">
                              {t("lobby.roomLobby.swapMode.enter")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-secondary">
                          {t("lobby.roomLobby.seatEmpty")}
                        </span>
                      )}
                    </button>
                    {ownerCanKick && (
                      <button
                        type="button"
                        className="absolute top-1 right-1 rounded-md p-1 text-text-secondary opacity-0 transition-opacity hover:bg-surface-elevated hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t("lobby.roomLobby.kickIconLabel", {
                          username: player.username,
                        })}
                        title={t("lobby.roomLobby.kickIconLabel", {
                          username: player.username,
                        })}
                        data-testid={`kick-player-${seatIndex}`}
                        disabled={kickPlayerMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapSourceSeat(null);
                          setKickConfirm({
                            seat: seatIndex,
                            userId: player.userId,
                            username: player.username,
                          });
                        }}
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                    {/* Promote-to-owner is only meaningful for seated, non-self,
                        non-owner targets — same gate as the seat-tile kick icon
                        (player is by definition seated when rendered in the
                        diamond, and ownerCanKick already excludes self/owner). */}
                    {ownerCanKick && player !== undefined && (
                      <button
                        type="button"
                        className="absolute top-1 left-1 rounded-md p-1 text-text-secondary opacity-0 transition-opacity hover:bg-surface-elevated hover:text-warning group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t("lobby.roomLobby.promoteIconLabel", {
                          username: player.username,
                        })}
                        title={t("lobby.roomLobby.promoteIconLabel", {
                          username: player.username,
                        })}
                        data-testid={`promote-seat-${seatIndex}`}
                        disabled={transferOwnershipMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapSourceSeat(null);
                          setTransferConfirm({
                            userId: player.userId,
                            username: player.username,
                          });
                        }}
                      >
                        <Crown className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start Game / Waiting message + Leave */}
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
                  className={
                    allSeated && !startGameMutation.isPending ? "" : "opacity-40 cursor-not-allowed"
                  }
                  title={allSeated ? undefined : t("lobby.roomLobby.startGameDisabled")}
                  data-testid="start-game"
                >
                  {startGameMutation.isPending
                    ? t("lobby.roomLobby.gameStarting")
                    : t("lobby.roomLobby.startGame")}
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
        {/* Right column: room-scoped chat for seated + unseated members. */}
        <ChatPanel channel="room" roomId={room.id} className="min-h-100" />
      </div>

      {/* Owner transfer-ownership confirmation dialog */}
      <Dialog
        open={transferConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setTransferConfirm(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("lobby.roomLobby.transferConfirm.title")}</DialogTitle>
            <DialogDescription>
              {t("lobby.roomLobby.transferConfirm.body", {
                username: transferConfirm?.username ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferConfirm(null)}
              data-testid="transfer-cancel"
            >
              {t("lobby.roomLobby.transferConfirm.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleTransferConfirm}
              disabled={transferOwnershipMutation.isPending}
              data-testid="transfer-confirm"
            >
              {t("lobby.roomLobby.transferConfirm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner kick confirmation dialog */}
      <Dialog
        open={kickConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setKickConfirm(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("lobby.roomLobby.kickConfirm.title")}</DialogTitle>
            <DialogDescription>
              {t("lobby.roomLobby.kickConfirm.body", {
                username: kickConfirm?.username ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKickConfirm(null)}
              data-testid="kick-cancel"
            >
              {t("lobby.roomLobby.kickConfirm.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleKickConfirm}
              disabled={kickPlayerMutation.isPending}
              data-testid="kick-confirm"
            >
              {t("lobby.roomLobby.kickConfirm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
