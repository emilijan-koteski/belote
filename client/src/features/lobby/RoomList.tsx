import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { RoomCard } from "@/features/lobby/RoomCard";
import { useRoomUpdates } from "@/features/lobby/useRoomUpdates";
import { Input } from "@/shared/components/ui/input";
import { useLobbyStore } from "@/shared/stores/lobbyStore";

interface RoomListProps {
  onJoinRoom: (roomId: number) => void;
}

export function RoomList({ onJoinRoom }: RoomListProps) {
  const { t } = useTranslation();

  // WS room update listener — scoped to browse view lifecycle (WS hub not yet wired)
  useRoomUpdates();
  const rooms = useLobbyStore((s) => s.rooms);
  const isLoading = useLobbyStore((s) => s.isLoading);
  const searchQuery = useLobbyStore((s) => s.searchQuery);
  const setSearchQuery = useLobbyStore((s) => s.setSearchQuery);

  const filteredRooms = useMemo(() => {
    if (!searchQuery) return rooms;
    const query = searchQuery.toLowerCase();
    return rooms.filter(
      (room) => room.name.toLowerCase().includes(query) || room.code.toLowerCase().includes(query),
    );
  }, [rooms, searchQuery]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder={t("lobby.roomList.searchPlaceholder")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="room-list-search"
      />

      {isLoading && (
        <div className="flex flex-col gap-2" data-testid="room-list-loading">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      )}

      {!isLoading && filteredRooms.length === 0 && searchQuery && (
        <p className="text-sm text-text-secondary" data-testid="room-list-empty-search">
          {t("lobby.roomList.emptyNoMatch", { query: searchQuery })}{" "}
          <button
            className="text-accent underline"
            onClick={() => setSearchQuery("")}
            data-testid="room-list-clear-search"
          >
            {t("lobby.roomList.clearSearch")}
          </button>
        </p>
      )}

      {!isLoading && filteredRooms.length === 0 && !searchQuery && (
        <p className="text-sm text-text-secondary" data-testid="room-list-empty">
          {t("lobby.roomList.emptyNoRooms")}
        </p>
      )}

      {!isLoading && filteredRooms.length > 0 && (
        <div className="flex flex-col gap-2">
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={onJoinRoom} />
          ))}
        </div>
      )}
    </div>
  );
}
