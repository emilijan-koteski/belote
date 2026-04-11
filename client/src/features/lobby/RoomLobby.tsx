import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

export function RoomLobby() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-display text-2xl text-text-primary">
        {t("lobby.title")} — Room #{id}
      </h1>
      <p className="text-text-secondary">{t("lobby.roomLobby.waitingForPlayers")}</p>
    </div>
  );
}
