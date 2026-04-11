import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import type { Room } from "@/shared/types/apiTypes";

interface RoomCardProps {
  room: Room;
}

const variantKeys: Record<string, string> = {
  bitola: "lobby.roomList.variantBitola",
};

const matchModeKeys: Record<string, string> = {
  "1001": "lobby.roomList.matchMode1001",
};

export function RoomCard({ room }: RoomCardProps) {
  const { t } = useTranslation();

  const variantLabel = t(variantKeys[room.variant] ?? room.variant);
  const matchModeLabel = t(matchModeKeys[room.matchMode] ?? room.matchMode);
  const timerLabel =
    room.timerStyle === "relaxed"
      ? t("lobby.roomList.timerRelaxed")
      : t("lobby.roomList.timerPerMove", { seconds: room.timerDurationSeconds ?? "?" });

  return (
    <div
      className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
      data-testid="room-card"
    >
      <div>
        <h3 className="font-semibold text-text-primary">{room.name}</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {variantLabel} &middot; {matchModeLabel} &middot;{" "}
          {t("lobby.roomList.players", { current: room.playerCount, max: 4 })} &middot;{" "}
          {timerLabel}
        </p>
      </div>
      <Button size="sm" data-testid="room-card-join">
        {t("lobby.roomList.join")}
      </Button>
    </div>
  );
}
