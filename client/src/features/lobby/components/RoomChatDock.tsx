import { ChatDock } from "@/features/chat/ChatDock";

/**
 * Room's chat dock — same shell as {@link LobbyChatDock}, scoped to the room
 * channel so messages are room-isolated and don't leak into the global lobby.
 */
export function RoomChatDock({ roomId }: { roomId: number }) {
  return <ChatDock variant="room" roomId={roomId} />;
}
