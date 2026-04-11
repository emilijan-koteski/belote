import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { CreateRoomModal } from "@/features/lobby/CreateRoomModal";
import { RoomList } from "@/features/lobby/RoomList";
import { FetchError } from "@/shared/api/fetchClient";
import { getRooms, joinRoom } from "@/shared/api/rooms";
import { Button } from "@/shared/components/ui/button";
import { useLobbyStore } from "@/shared/stores/lobbyStore";

export function LobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeView, setActiveView] = useState<"options" | "browse">("options");
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleBrowseRooms() {
    if (useLobbyStore.getState().isLoading) return;
    setActiveView("browse");
    setFetchError(null);
    useLobbyStore.getState().setRooms([]);
    useLobbyStore.getState().setSearchQuery("");
    useLobbyStore.getState().setLoading(true);
    try {
      const rooms = await getRooms("waiting");
      useLobbyStore.getState().setRooms(rooms);
    } catch (err) {
      if (err instanceof FetchError) {
        setFetchError(err.message);
      } else {
        setFetchError(t("lobby.createRoomModal.errors.unexpected"));
      }
    } finally {
      useLobbyStore.getState().setLoading(false);
    }
  }

  function handleBackToOptions() {
    setActiveView("options");
    setFetchError(null);
    useLobbyStore.getState().setSearchQuery("");
    useLobbyStore.getState().setRooms([]);
  }

  async function handleJoinRoom(roomId: number) {
    try {
      await joinRoom(roomId);
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
          {activeView === "options" && (
            <>
              <button
                className="rounded-xl bg-accent-glow p-6 text-left transition-colors hover:opacity-90"
                data-testid="quick-play-card"
              >
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {t("lobby.quickPlay")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {t("lobby.quickPlayDesc")}
                </p>
              </button>

              <button
                className="rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:bg-surface/80"
                onClick={handleBrowseRooms}
                data-testid="browse-rooms-card"
              >
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {t("lobby.browseRooms")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {t("lobby.browseRoomsDesc")}
                </p>
              </button>

              <button
                className="rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:bg-surface/80"
                onClick={() => setShowCreateModal(true)}
                data-testid="create-room-card"
              >
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {t("lobby.createRoom")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {t("lobby.createRoomDesc")}
                </p>
              </button>
            </>
          )}

          {activeView === "browse" && (
            <>
              <Button
                variant="ghost"
                onClick={handleBackToOptions}
                data-testid="back-to-options"
              >
                &larr; {t("lobby.roomList.backToOptions")}
              </Button>

              {fetchError && (
                <p className="text-sm text-destructive" data-testid="room-fetch-error">
                  {fetchError}
                </p>
              )}

              <RoomList onJoinRoom={handleJoinRoom} />
            </>
          )}
        </div>

        {/* Right: Leaderboard placeholder */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="text-text-secondary">{t("lobby.leaderboardPlaceholder")}</p>
        </div>
      </div>

      <CreateRoomModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}
