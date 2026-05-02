import { useTranslation } from "react-i18next";

import { useRoomDetailQuery } from "@/shared/hooks/queries/useRooms";
import type { RoomPlayer } from "@/shared/types/apiTypes";
import type { TeamString } from "@/shared/types/gameTypes";

interface RoomDetailPreviewProps {
  roomId: number;
}

const SEAT_LAYOUT = [
  [0, 1],
  [2, 3],
] as const;

function getTeamForSeat(seat: number): TeamString {
  return seat % 2 === 0 ? "teamA" : "teamB";
}

function getPlayerAtSeat(players: RoomPlayer[], seatIndex: number): RoomPlayer | undefined {
  return players.find((p) => p.seat === seatIndex);
}

export function RoomDetailPreview({ roomId }: RoomDetailPreviewProps) {
  const { t } = useTranslation();
  const { data, isPending } = useRoomDetailQuery(roomId);
  const players = data?.players ?? [];

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 p-3" data-testid="room-detail-preview">
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
      {/* Team labels — neutral view (no participation context). */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        <p className="text-center text-xs font-semibold text-team-a">{t("team.a")}</p>
        <p className="text-center text-xs font-semibold text-team-b">{t("team.b")}</p>
      </div>

      {/* Compact 2x2 seat grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {SEAT_LAYOUT.map((row) =>
          row.map((seatIndex) => {
            const player = getPlayerAtSeat(players, seatIndex);
            const team = getTeamForSeat(seatIndex);
            const teamBorderClass = team === "teamA" ? "border-team-a" : "border-team-b";
            const teamTextClass = team === "teamA" ? "text-team-a" : "text-team-b";

            return (
              <div
                key={seatIndex}
                className={`flex h-10 items-center justify-center rounded-lg border ${
                  player !== undefined
                    ? `bg-surface ${teamBorderClass}`
                    : `border-dashed ${teamBorderClass} bg-surface/50`
                }`}
                data-testid={`room-detail-seat-${seatIndex}`}
                data-team={team}
              >
                {player !== undefined ? (
                  <span className={`text-sm font-medium ${teamTextClass}`}>{player.username}</span>
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
