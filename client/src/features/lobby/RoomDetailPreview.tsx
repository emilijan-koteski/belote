import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getRoom } from "@/shared/api/rooms";
import type { RoomPlayer } from "@/shared/types/apiTypes";

interface RoomDetailPreviewProps {
  roomId: number;
}

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

export function RoomDetailPreview({ roomId }: RoomDetailPreviewProps) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let stale = false;

    async function fetchDetail() {
      setIsLoading(true);
      try {
        const data = await getRoom(roomId);
        if (!stale) {
          setPlayers(data.players);
        }
      } catch {
        // Silently handle — the preview just shows empty seats on failure
      } finally {
        if (!stale) {
          setIsLoading(false);
        }
      }
    }

    fetchDetail();
    return () => {
      stale = true;
    };
  }, [roomId]);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-2 p-3"
        data-testid="room-detail-preview"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg border border-border bg-surface"
            data-testid={`room-detail-seat-${i}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="room-detail-preview">
      {/* Team labels */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        <p className="text-center text-xs font-semibold text-team-red">
          {t("lobby.roomDetail.teamRed")}
        </p>
        <p className="text-center text-xs font-semibold text-team-blue">
          {t("lobby.roomDetail.teamBlue")}
        </p>
      </div>

      {/* Compact 2x2 seat grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {SEAT_LAYOUT.map((row) =>
          row.map((seatIndex) => {
            const player = getPlayerAtSeat(players, seatIndex);
            const team = getTeamForSeat(seatIndex);
            const teamBorderClass = team === "red" ? "border-team-red" : "border-team-blue";
            const teamTextClass = team === "red" ? "text-team-red" : "text-team-blue";

            return (
              <div
                key={seatIndex}
                className={`flex h-10 items-center justify-center rounded-lg border ${
                  player !== undefined
                    ? `bg-surface ${teamBorderClass}`
                    : `border-dashed ${teamBorderClass} bg-surface/50`
                }`}
                data-testid={`room-detail-seat-${seatIndex}`}
              >
                {player !== undefined ? (
                  <span className={`text-sm font-medium ${teamTextClass}`}>
                    {player.username}
                  </span>
                ) : (
                  <span className="text-xs text-text-secondary">
                    {t("lobby.roomDetail.emptySlot")}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {/* Unseated players */}
      {players.filter((p) => p.seat === null).length > 0 && (
        <div className="flex flex-wrap gap-2 px-3" data-testid="room-detail-unseated">
          {players
            .filter((p) => p.seat === null)
            .map((p) => (
              <span
                key={p.id}
                className="text-xs text-text-secondary"
                data-testid="room-detail-unseated-player"
              >
                {p.username} — {t("lobby.roomDetail.notSeated")}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
