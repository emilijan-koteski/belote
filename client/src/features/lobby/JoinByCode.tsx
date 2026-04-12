import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { FetchError } from "@/shared/api/fetchClient";
import { getRoomByCode, joinRoom } from "@/shared/api/rooms";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export function JoinByCode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  async function handleJoinByCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || isJoining) return;

    setIsJoining(true);
    try {
      const { room } = await getRoomByCode(trimmed);
      await joinRoom(room.id);
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "ROOM_NOT_FOUND") {
          toast.error(t("lobby.joinByCode.notFound"));
        } else if (err.code === "ROOM_FULL") {
          toast.error(t("lobby.roomList.errors.roomFull"));
        } else if (err.code === "ALREADY_IN_ROOM") {
          toast.error(t("lobby.roomList.errors.alreadyInRoom"));
        } else {
          toast.error(t("lobby.roomList.errors.joinFailed"));
        }
      } else {
        toast.error(t("lobby.roomList.errors.joinFailed"));
      }
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="join-by-code">
      <p className="text-sm text-text-secondary">{t("lobby.joinByCode.label")}</p>
      <div className="flex gap-2">
        <Input
          placeholder={t("lobby.joinByCode.placeholder")}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoinByCode();
          }}
          maxLength={6}
          data-testid="join-by-code-input"
        />
        <Button
          onClick={handleJoinByCode}
          disabled={!code.trim() || isJoining}
          data-testid="join-by-code-button"
        >
          {t("lobby.joinByCode.join")}
        </Button>
      </div>
    </div>
  );
}
