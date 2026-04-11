import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CreateRoomModal } from "@/features/lobby/CreateRoomModal";

export function LobbyPage() {
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Left: Play Options */}
        <div className="flex flex-col gap-4">
          <button
            className="rounded-xl bg-accent-glow p-6 text-left transition-colors hover:opacity-90"
            data-testid="quick-play-card"
          >
            <h3 className="font-display text-lg font-semibold text-text-primary">
              {t("lobby.quickPlay")}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">{t("lobby.quickPlayDesc")}</p>
          </button>

          <button
            className="rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:bg-surface/80"
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
