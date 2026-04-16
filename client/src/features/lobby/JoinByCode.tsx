import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useJoinByCodeMutation } from "@/shared/hooks/mutations/useRooms";

export function JoinByCode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const joinByCodeMutation = useJoinByCodeMutation();

  async function handleJoinByCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || joinByCodeMutation.isPending) return;

    try {
      const room = await joinByCodeMutation.mutateAsync(trimmed);
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
          disabled={!code.trim() || joinByCodeMutation.isPending}
          data-testid="join-by-code-button"
        >
          {t("lobby.joinByCode.join")}
        </Button>
      </div>
    </div>
  );
}
