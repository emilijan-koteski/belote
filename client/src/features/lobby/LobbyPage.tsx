import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { CreateRoomModal } from "@/features/lobby/CreateRoomModal";
import { FilterRail } from "@/features/lobby/components/FilterRail";
import type { FilterCounts, LobbyFilter, LobbySort } from "@/features/lobby/components/FilterRail";
import { HeroBlock } from "@/features/lobby/components/HeroBlock";
import { LobbyChatDock } from "@/features/lobby/components/LobbyChatDock";
import { RoomGrid } from "@/features/lobby/components/RoomGrid";
import { Toast } from "@/features/lobby/components/Toast";
import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import { useLobbyStatsQuery } from "@/shared/hooks/queries/useLobbyStats";
import { useRoomsQuery } from "@/shared/hooks/queries/useRooms";
import { useJoinRoomMutation, useQuickPlayMutation } from "@/shared/hooks/mutations/useRooms";
import type { Room } from "@/shared/types/apiTypes";

function filterAndSort(
  rooms: Room[],
  search: string,
  filter: LobbyFilter,
  sort: LobbySort,
): Room[] {
  const q = search.trim().toLowerCase();
  const filtered = rooms.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false;
    if (filter === "open" && r.playerCount >= 4) return false;
    if (filter === "relaxed" && r.timerStyle !== "relaxed") return false;
    if (filter === "timed" && r.timerStyle === "relaxed") return false;
    return true;
  });
  const sorted = [...filtered];
  if (sort === "newest") {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    // "filling" — most-occupied first, breaking ties by newer-first
    sorted.sort(
      (a, b) =>
        b.playerCount - a.playerCount ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return sorted;
}

function deriveCounts(rooms: Room[]): FilterCounts {
  return {
    all: rooms.length,
    open: rooms.filter((r) => r.playerCount < 4).length,
    relaxed: rooms.filter((r) => r.timerStyle === "relaxed").length,
    timed: rooms.filter((r) => r.timerStyle !== "relaxed").length,
  };
}

export function LobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Lobby grid is always-on now — no separate "options" vs "browse" view.
  const roomsQuery = useRoomsQuery("waiting", true);
  const statsQuery = useLobbyStatsQuery();
  const quickPlayMutation = useQuickPlayMutation();
  const joinRoomMutation = useJoinRoomMutation();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LobbyFilter>("all");
  const [sort, setSort] = useState<LobbySort>("filling");
  const [showCreate, setShowCreate] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const rooms = roomsQuery.data ?? [];
  const counts = useMemo(() => deriveCounts(rooms), [rooms]);
  const filtered = useMemo(
    () => filterAndSort(rooms, search, filter, sort),
    [rooms, search, filter, sort],
  );

  async function handleQuickPlay() {
    if (quickPlayMutation.isPending) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await quickPlayMutation.mutateAsync(controller.signal);
      if (result.gameStarted) {
        // `fromRoom: true` triggers GamePage's "Game is starting…" splash so
        // quick-play auto-start has the same deliberate beat as a normal lobby.
        navigate(`/game/${result.room.id}`, { state: { fromRoom: true } });
      } else {
        navigate(`/rooms/${result.room.id}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const code = err instanceof FetchError ? err.code : null;
      toast.error(
        code === "ALREADY_IN_ROOM"
          ? t("lobby.matchmaking.errors.alreadyInRoom")
          : t("lobby.errors.matchmakingFailed"),
      );
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancelMatchmaking() {
    abortRef.current?.abort();
    quickPlayMutation.reset();
  }

  async function handleJoinRoom(room: Room) {
    setToastMsg(t("lobby.card.joining", { name: room.name }));
    try {
      await joinRoomMutation.mutateAsync(room.id);
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      setToastMsg(null);
      const code = err instanceof FetchError ? err.code : null;
      if (code === "ROOM_FULL") toast.error(t("lobby.errors.roomFull"));
      else if (code === "ALREADY_IN_ROOM") toast.error(t("lobby.errors.alreadyInRoom"));
      else toast.error(t("lobby.errors.joinFailed"));
    }
  }

  // Matchmaking pending state — preserves the existing testid contract.
  if (quickPlayMutation.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div
          className="bg-surface flex flex-col items-center justify-center gap-6 rounded-[var(--radius-lg)] border border-border p-12"
          data-testid="matchmaking-overlay"
        >
          <div className="flex items-center gap-3">
            <span className="bg-accent inline-block h-2.5 w-2.5 rounded-full [animation:pulse-dot_1.6s_ease-in-out_infinite]" />
            <span className="text-ink font-display text-lg font-semibold">
              {t("lobby.matchmaking.title")}
            </span>
          </div>
          <p className="text-ink-dim m-0 text-sm">{t("lobby.matchmaking.subtitle")}</p>
          <Button variant="ghost" onClick={handleCancelMatchmaking} data-testid="matchmaking-cancel">
            {t("lobby.matchmaking.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-7 py-8 pb-32">
      <HeroBlock
        openCount={rooms.length}
        stats={statsQuery.data}
        onQuickPlay={handleQuickPlay}
        onCreateRoom={() => setShowCreate(true)}
      />

      <FilterRail
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
        counts={counts}
      />

      <RoomGrid
        rooms={filtered}
        onJoin={handleJoinRoom}
        hasSearch={search.trim().length > 0}
        onClearSearch={() => setSearch("")}
      />

      <p className="text-ink-mute mt-8 text-center text-xs">
        {t("lobby.footnote", { shown: filtered.length, total: rooms.length })}
      </p>

      <CreateRoomModal open={showCreate} onOpenChange={setShowCreate} />
      <LobbyChatDock />
      <Toast message={toastMsg} onClear={() => setToastMsg(null)} />
    </div>
  );
}
