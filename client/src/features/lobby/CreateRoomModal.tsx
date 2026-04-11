import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { FetchError } from "@/shared/api/fetchClient";
import { createRoom } from "@/shared/api/rooms";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useLobbyStore } from "@/shared/stores/lobbyStore";

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomModal({ open, onOpenChange }: CreateRoomModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [variant] = useState("bitola");
  const [matchMode] = useState("1001");
  const [timerStyle, setTimerStyle] = useState("relaxed");

  const variantLabels: Record<string, string> = {
    bitola: t("lobby.createRoomModal.variantBitola"),
  };
  const matchModeLabels: Record<string, string> = {
    "1001": t("lobby.createRoomModal.matchMode1001"),
  };
  const timerStyleLabels: Record<string, string> = {
    relaxed: t("lobby.createRoomModal.timerRelaxed"),
    "per-move": t("lobby.createRoomModal.timerPerMove"),
  };
  const [timerDuration, setTimerDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError(t("lobby.createRoomModal.errors.nameRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const room = await createRoom({
        name: name.trim(),
        variant,
        matchMode,
        timerStyle,
        timerDurationSeconds: timerStyle === "per-move" ? timerDuration : null,
      });
      useLobbyStore.getState().addRoom(room);
      onOpenChange(false);
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "ROOM_NAME_TAKEN") {
          setError(t("lobby.createRoomModal.errors.nameTaken"));
        } else if (err.code === "ROOM_NAME_REQUIRED") {
          setError(t("lobby.createRoomModal.errors.nameRequired"));
        } else {
          setError(err.message);
        }
      } else {
        setError(t("lobby.createRoomModal.errors.unexpected"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setTimerStyle("relaxed");
      setTimerDuration(30);
      setError(null);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("lobby.createRoomModal.title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="room-name" className="mb-1 block text-sm text-text-secondary">
              {t("lobby.createRoomModal.roomName")}
            </label>
            <Input
              id="room-name"
              placeholder={t("lobby.createRoomModal.roomNamePlaceholder")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={!!error}
              data-testid="room-name-input"
            />
            {error && (
              <p className="mt-1 text-xs text-destructive" data-testid="room-name-error">
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              {t("lobby.createRoomModal.variant")}
            </label>
            <Select value={variant} disabled>
              <SelectTrigger className="w-full" data-testid="variant-select">
                <SelectValue>{variantLabels[variant]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bitola">{t("lobby.createRoomModal.variantBitola")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              {t("lobby.createRoomModal.matchMode")}
            </label>
            <Select value={matchMode} disabled>
              <SelectTrigger className="w-full" data-testid="match-mode-select">
                <SelectValue>{matchModeLabels[matchMode]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1001">{t("lobby.createRoomModal.matchMode1001")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              {t("lobby.createRoomModal.timerStyle")}
            </label>
            <Select
              value={timerStyle}
              onValueChange={(val) => {
                if (val) setTimerStyle(val);
              }}
            >
              <SelectTrigger className="w-full" data-testid="timer-style-select">
                <SelectValue>{timerStyleLabels[timerStyle]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relaxed">{t("lobby.createRoomModal.timerRelaxed")}</SelectItem>
                <SelectItem value="per-move">{t("lobby.createRoomModal.timerPerMove")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timerStyle === "per-move" && (
            <div>
              <label htmlFor="timer-duration" className="mb-1 block text-sm text-text-secondary">
                {t("lobby.createRoomModal.timerDuration")}
              </label>
              <Input
                id="timer-duration"
                type="number"
                min={10}
                max={120}
                value={timerDuration}
                onChange={(e) => setTimerDuration(Number(e.target.value))}
                data-testid="timer-duration-input"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              data-testid="cancel-button"
            >
              {t("lobby.createRoomModal.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              data-testid="create-room-button"
            >
              {t("lobby.createRoomModal.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
