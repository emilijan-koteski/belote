import { useCallback } from "react";

import { ChatDock } from "@/features/chat/ChatDock";
import { useGameStore } from "@/shared/stores/gameStore";

import { seatTeam, teamColors } from "../lib/tableTheme";

interface GameChatDockProps {
  /** Open/closed flag — lifted to GamePage so the surrounding HUD (rules /
   *  settings / emote cluster) can hide while the dock covers the corner. */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-game (match channel) chat dock — same bottom-right floating shell as the
 * lobby/room {@link ChatDock}, re-skinned to the dark felt theme via the
 * `.chat-dock-game` class that ChatDock attaches for `variant="match"`.
 *
 * Owns the viewer-relative sender coloring (gold = Us, silver = Them) using the
 * game's seat layout + {@link tableTheme} helpers, so ChatDock stays free of any
 * game-store coupling. The open state is controlled by GamePage.
 */
export function GameChatDock({ isOpen, onOpenChange }: GameChatDockProps) {
  const roomId = useGameStore((s) => s.roomId);
  const players = useGameStore((s) => s.gameState?.players);
  const myPlayerSeat = useGameStore((s) => s.myPlayerSeat);

  const resolveNameColor = useCallback(
    (userId: number): string => {
      if (myPlayerSeat === null || !players) return "var(--brass)";
      const player = players.find((p) => p.userId === userId);
      if (!player) return "var(--brass)";
      // Bright team stop (#e8c25a gold / #d8dde4 silver) reads well on felt.
      return teamColors(seatTeam(player.seat, myPlayerSeat))[0];
    },
    [players, myPlayerSeat],
  );

  if (roomId === null || roomId <= 0) return null;

  return (
    <ChatDock
      variant="match"
      roomId={roomId}
      open={isOpen}
      onOpenChange={onOpenChange}
      resolveNameColor={resolveNameColor}
    />
  );
}
