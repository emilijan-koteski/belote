import { useCallback } from "react";

import { ChatDock } from "@/features/chat/ChatDock";
import { useAuthStore } from "@/shared/stores/authStore";
import { useRoomStore } from "@/shared/stores/roomStore";

/**
 * Room's chat dock — same shell as {@link LobbyChatDock}, scoped to the room
 * channel so messages are room-isolated and don't leak into the global lobby.
 *
 * Owns the sender-name coloring: usernames read gold (teammate) / silver
 * (opponent) relative to the viewer's seat, and cream-brass (`--accent`) when
 * either side is unseated (no perspective). The shared {@link ChatDock} stays
 * channel-agnostic — it just renders whatever color this resolver returns.
 */
export function RoomChatDock({ roomId }: { roomId: number }) {
  const me = useAuthStore((s) => s.user);
  const players = useRoomStore((s) => s.players);
  const viewerSeat =
    me?.id != null ? (players.find((p) => p.userId === me.id)?.seat ?? null) : null;

  const resolveNameColor = useCallback(
    (userId: number): string | undefined => {
      const senderSeat = players.find((p) => p.userId === userId)?.seat ?? null;
      // Neutral = felt-green, matching the neutral (undetermined) avatar —
      // clearly apart from team-a gold and team-b silver.
      if (viewerSeat === null || senderSeat === null) return "var(--accent)";
      return viewerSeat % 2 === senderSeat % 2 ? "var(--team-a)" : "var(--team-b)";
    },
    [players, viewerSeat],
  );

  return <ChatDock variant="room" roomId={roomId} resolveNameColor={resolveNameColor} />;
}
