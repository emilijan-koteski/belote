import { useTranslation } from "react-i18next";

import { RoomDetailPreview } from "@/features/lobby/RoomDetailPreview";
import { Button } from "@/shared/components/ui/button";
import type { Room } from "@/shared/types/apiTypes";

interface RoomCardProps {
  room: Room;
  onJoin: (roomId: number) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const variantKeys: Record<string, string> = {
  bitola: "lobby.roomList.variantBitola",
};

const matchModeKeys: Record<string, string> = {
  "1001": "lobby.roomList.matchMode1001",
};

export function RoomCard({ room, onJoin, isExpanded = false, onToggle }: RoomCardProps) {
  const { t } = useTranslation();

  const variantLabel = t(variantKeys[room.variant] ?? room.variant);
  const matchModeLabel = t(matchModeKeys[room.matchMode] ?? room.matchMode);
  const timerLabel =
    room.timerStyle === "relaxed"
      ? t("lobby.roomList.timerRelaxed")
      : t("lobby.roomList.timerPerMove", { seconds: room.timerDurationSeconds ?? "?" });

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-surface"
      data-testid="room-card"
    >
      {/* Card summary — clickable to toggle detail */}
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={onToggle}
        data-testid="room-card-toggle"
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-block text-xs text-text-secondary transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          >
            &#9654;
          </span>
          <div>
            <h3 className="font-semibold text-text-primary">{room.name}</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {variantLabel} &middot; {matchModeLabel} &middot;{" "}
              {t("lobby.roomList.players", { current: room.playerCount, max: 4 })} &middot;{" "}
              {timerLabel}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onJoin(room.id);
          }}
          data-testid="room-card-join"
        >
          {t("lobby.roomList.join")}
        </Button>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border">
          <RoomDetailPreview roomId={room.id} />
        </div>
      )}
    </div>
  );
}
