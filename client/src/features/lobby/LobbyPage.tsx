import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ChatPanel } from "@/features/chat/ChatPanel";
import { CreateRoomModal } from "@/features/lobby/CreateRoomModal";
import { JoinByCode } from "@/features/lobby/JoinByCode";
import { RoomList } from "@/features/lobby/RoomList";
import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import { useJoinRoomMutation, useQuickPlayMutation } from "@/shared/hooks/mutations/useRooms";
import { useRoomsQuery } from "@/shared/hooks/queries/useRooms";

export function LobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeView, setActiveView] = useState<"options" | "browse">("options");
  const abortRef = useRef<AbortController | null>(null);

  const roomsQuery = useRoomsQuery("waiting", activeView === "browse");
  const quickPlayMutation = useQuickPlayMutation();
  const joinRoomMutation = useJoinRoomMutation();

  async function handleQuickPlay() {
    if (quickPlayMutation.isPending) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const room = await quickPlayMutation.mutateAsync(controller.signal);
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (err instanceof FetchError) {
        if (err.code === "ALREADY_IN_ROOM") {
          toast.error(t("lobby.matchmaking.alreadyInRoom"));
        } else {
          toast.error(t("lobby.matchmaking.failed"));
        }
      } else {
        toast.error(t("lobby.matchmaking.failed"));
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancelMatchmaking() {
    abortRef.current?.abort();
    quickPlayMutation.reset();
  }

  function handleBrowseRooms() {
    setActiveView("browse");
  }

  function handleBackToOptions() {
    setActiveView("options");
  }

  async function handleJoinRoom(roomId: number) {
    try {
      await joinRoomMutation.mutateAsync(roomId);
      navigate(`/rooms/${roomId}`);
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "ROOM_FULL") {
          toast.error(t("lobby.roomList.errors.roomFull"));
        } else if (err.code === "ALREADY_IN_ROOM") {
          toast.error(t("lobby.roomList.errors.alreadyInRoom"));
        } else {
          toast.error(t("lobby.roomList.errors.joinFailed"));
        }
      } else {
        toast.error(t("lobby.roomList.errors.joinFailed"));
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Left: Play Options or Browse view */}
        <div className="flex flex-col gap-4">
          {activeView === "options" && !quickPlayMutation.isPending && (
            <>
              <button
                className="rounded-xl bg-accent-glow p-6 text-left transition-colors hover:opacity-90"
                onClick={handleQuickPlay}
                data-testid="quick-play-card"
              >
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {t("lobby.quickPlay")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{t("lobby.quickPlayDesc")}</p>
              </button>

              <button
                className="rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:bg-surface/80"
                onClick={handleBrowseRooms}
                data-testid="browse-rooms-card"
              >
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {t("lobby.browseRooms")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{t("lobby.browseRoomsDesc")}</p>
              </button>

              <button
                className="rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:bg-surface/80"
                onClick={() => setShowCreateModal(true)}
                data-testid="create-room-card"
              >
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {t("lobby.createRoom")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{t("lobby.createRoomDesc")}</p>
              </button>

              <div className="my-2 border-t border-border" />
              <JoinByCode />
            </>
          )}

          {activeView === "options" && quickPlayMutation.isPending && (
            <div
              className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border bg-surface p-10"
              data-testid="matchmaking-overlay"
            >
              <div className="flex items-center gap-3">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-accent" />
                <span className="text-lg font-semibold text-text-primary">
                  {t("lobby.matchmaking.finding")}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={handleCancelMatchmaking}
                data-testid="matchmaking-cancel"
              >
                {t("lobby.matchmaking.cancel")}
              </Button>
            </div>
          )}

          {activeView === "browse" && (
            <>
              <Button variant="ghost" onClick={handleBackToOptions} data-testid="back-to-options">
                &larr; {t("lobby.roomList.backToOptions")}
              </Button>

              {roomsQuery.isError && (
                <p className="text-sm text-destructive" data-testid="room-fetch-error">
                  {roomsQuery.error instanceof FetchError
                    ? roomsQuery.error.message
                    : t("lobby.createRoomModal.errors.unexpected")}
                </p>
              )}

              <RoomList onJoinRoom={handleJoinRoom} />
            </>
          )}
        </div>

        {/* Right: Leaderboard placeholder above, ChatPanel below */}
        <div className="flex flex-col gap-4 min-h-150">
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="text-text-secondary">{t("lobby.leaderboardPlaceholder")}</p>
          </div>
          <ChatPanel className="flex-1" />
        </div>
      </div>

      <CreateRoomModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}
