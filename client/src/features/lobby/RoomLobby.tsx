import { UserX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  useKickPlayerMutation,
  useLeaveRoomMutation,
  useSelectSeatMutation,
  useStartGameMutation,
  useSwapSeatsMutation,
} from "@/shared/hooks/mutations/useRooms";
import { useRoomDetailQuery } from "@/shared/hooks/queries/useRooms";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { MOTION } from "@/shared/lib/motion";
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

// Cardinal positions used for the diamond/cross seat layout. Keyed by visual
// position (south = bottom = viewer slot, north = top = partner, east/west =
// opponents). The mapping seat-index → cardinal-position is computed per
// render based on `viewerSeat` to keep the viewer at the bottom.
type CardinalPosition = "south" | "east" | "north" | "west";

const COMPASS_ORDER: readonly CardinalPosition[] = ["south", "east", "north", "west"] as const;

const SEAT_INDEXES = [0, 1, 2, 3] as const;

// CSS Grid area name per cardinal position. Matches the `grid-template-areas`
// declared inline on the wrapping grid below.
const GRID_AREA: Record<CardinalPosition, string> = {
  south: "south",
  east: "east",
  north: "north",
  west: "west",
};

// Compute the visual cardinal position of a seat given the rotation anchor.
// Anchor 0 → seat 0 at south, 1 east, 2 north, 3 west — matches the GamePage
// `compassOffset` convention so partners always land opposite each other.
function cardinalForSeat(seatIndex: number, anchorSeat: number): CardinalPosition {
  const offset = (seatIndex - anchorSeat + 4) % 4;
  // COMPASS_ORDER has exactly 4 entries and offset is in [0,3], so this is
  // always defined — coerce for `noUncheckedIndexedAccess`.
  return COMPASS_ORDER[offset] as CardinalPosition;
}

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

  // Mutations
  const selectSeatMutation = useSelectSeatMutation();
  const startGameMutation = useStartGameMutation();
  const leaveRoomMutation = useLeaveRoomMutation();
  const kickPlayerMutation = useKickPlayerMutation();
  const swapSeatsMutation = useSwapSeatsMutation();

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

  // Viewer's current seat (or null). Drives the diamond rotation: when the
  // viewer is seated, their tile rotates to the south slot; pre-seat, the
  // default rotation puts seat 0 at south. Mirrors GamePage's `compassOffset`
  // so partners always land opposite each other.
  const viewerSeat = useMemo<number | null>(() => {
    if (currentUser === null) return null;
    const me = storePlayers.find((p) => p.userId === currentUser.id);
    return me?.seat ?? null;
  }, [storePlayers, currentUser]);

  const isViewerSeated = viewerSeat !== null;

  // `prefers-reduced-motion: reduce` snaps the rotation and shows the "your
  // seat" micro-label immediately. Live via the shared useReducedMotion hook
  // (D68 / D122) so OS-level toggles propagate on the next render.
  const prefersReducedMotion = useReducedMotion();

  // Fade in the "your seat" label ~300ms after the viewer takes a seat —
  // roughly when the rotation transition completes. Reduced-motion users get
  // it immediately. Reset whenever the viewer leaves their seat so a
  // subsequent re-seating triggers the fade again.
  const [showSelfLabel, setShowSelfLabel] = useState(false);
  useEffect(() => {
    if (!isViewerSeated) {
      setShowSelfLabel(false);
      return;
    }
    if (prefersReducedMotion) {
      setShowSelfLabel(true);
      return;
    }
    const timer = setTimeout(() => setShowSelfLabel(true), MOTION.ROOM_SELF_LABEL_DELAY);
    return () => clearTimeout(timer);
  }, [isViewerSeated, viewerSeat, prefersReducedMotion]);

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

    // Click the source again, an empty seat, or any non-other-seated seat
    // cancels swap mode without firing the API.
    const targetPlayer = getPlayerAtSeat(players, targetSeat);
    const isCurrentUser =
      targetPlayer !== undefined && currentUser !== null && targetPlayer.userId === currentUser.id;
    if (
      targetSeat === swapSourceSeat ||
      targetPlayer === undefined ||
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

  const anchorSeat = viewerSeat ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div data-testid="room-lobby">
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

          {/* Team legend — visible only in the mobile 2x2 stack (<sm), where
              column-1 = Team A and column-2 = Team B. The diamond layout (sm:+)
              hides this because team identity reads from each tile's colored
              border instead of left/right column position. */}
          <div className="mb-4 grid grid-cols-2 gap-6 sm:hidden">
            <p className="text-center text-sm font-semibold text-team-a" data-team="teamA">
              {t("team.a")}
            </p>
            <p className="text-center text-sm font-semibold text-team-b" data-team="teamB">
              {t("team.b")}
            </p>
          </div>

          {/* Diamond seat layout (sm:+) / 2x2 stack fallback (<sm).
              `data-testid="player-seat-{N}"` stays the server-canonical seat
              index; `data-testid="seat-position-{south|north|east|west}"` is
              the visual cardinal slot computed from the viewer's rotation. */}
          <div
            className="mb-8 grid gap-6 grid-cols-2 sm:grid-cols-[1fr_1fr_1fr] sm:[grid-template-areas:'._north_.''west_._east''._south_.']"
            data-testid="seats-grid"
          >
            {SEAT_INDEXES.map((seatIndex) => {
              const player = getPlayerAtSeat(players, seatIndex);
              const team = getTeamForSeat(seatIndex);
              const cardinal = cardinalForSeat(seatIndex, anchorSeat);
              const isCurrentUser =
                player !== undefined && currentUser !== null && player.userId === currentUser.id;
              const isSeatOwner = player !== undefined && player.userId === room.ownerId;
              const isWaiting = room.status === "waiting";
              const ownerCanKick = isOwner && isWaiting && player !== undefined && !isSeatOwner;
              const isSwapSource = swapSourceSeat === seatIndex;
              const inSwapMode = swapSourceSeat !== null;
              // Owner can drive the click into either select-seat (default) or swap-mode.
              const ownerCanInitiateSwap =
                isOwner && isWaiting && player !== undefined && !isCurrentUser && !inSwapMode;
              const isClickable =
                player === undefined || isCurrentUser || ownerCanInitiateSwap || inSwapMode;
              // Disable the affected tile while its mutation is in flight so a
              // double-click can't fire duplicate requests. Identify the
              // affected tile via the mutation's variables (the only seat the
              // user clicks should reflect pending state — not every seat).
              const kickPendingForThisSeat =
                kickPlayerMutation.isPending &&
                player !== undefined &&
                kickPlayerMutation.variables?.userId === player.userId;
              const swapPendingForThisSeat =
                swapSeatsMutation.isPending &&
                (swapSeatsMutation.variables?.seatA === seatIndex ||
                  swapSeatsMutation.variables?.seatB === seatIndex);
              const isPendingForThisSeat = kickPendingForThisSeat || swapPendingForThisSeat;

              const teamBorderClass = team === "teamA" ? "border-team-a" : "border-team-b";
              const showYourSeatLabel = isCurrentUser && cardinal === "south" && showSelfLabel;

              return (
                <div
                  key={seatIndex}
                  className="group relative motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
                  style={{ gridArea: GRID_AREA[cardinal] }}
                  data-testid={`seat-position-${cardinal}`}
                  data-team={team}
                >
                  <button
                    type="button"
                    className={`flex min-h-24 w-full flex-col items-center justify-center rounded-xl border-2 p-6 transition-colors ${
                      player !== undefined
                        ? `bg-surface ${teamBorderClass} ${isCurrentUser ? "ring-1 ring-accent" : ""} ${
                            isSwapSource ? "ring-2 ring-accent" : ""
                          } ${
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
                      if (isClickable) {
                        handleSelectSeat(seatIndex);
                      }
                    }}
                    disabled={!isClickable || isPendingForThisSeat}
                    data-testid={`player-seat-${seatIndex}`}
                  >
                    {player !== undefined ? (
                      <div className="text-center">
                        <span className="font-semibold text-text-primary">{player.username}</span>
                        <div className="mt-1 flex items-center justify-center gap-2">
                          {isCurrentUser && (
                            <span className="text-xs text-accent">
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
                      <span className="text-text-secondary">{t("lobby.roomLobby.seatEmpty")}</span>
                    )}
                  </button>
                  {showYourSeatLabel && (
                    <p
                      className="mt-2 text-center text-xs font-medium text-accent motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                      data-testid="seat-self-label"
                    >
                      {t("lobby.roomLobby.yourSeat")}
                    </p>
                  )}
                  {ownerCanKick && (
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-md p-1 text-text-secondary opacity-0 transition-opacity hover:bg-surface-elevated hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={t("lobby.roomLobby.kickIconLabel", {
                        username: player.username,
                      })}
                      data-testid={`kick-player-${seatIndex}`}
                      disabled={kickPlayerMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        // If we're in swap-mode, cancel swap and proceed to kick dialog.
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
                </div>
              );
            })}
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
        {/* Right column: room-scoped chat for seated + unseated members.
            Stacks below the lobby on small screens, sits to the right on md+. */}
        <ChatPanel channel="room" roomId={room.id} className="min-h-100" />
      </div>

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
