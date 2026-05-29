import { ChatDock } from "@/features/chat/ChatDock";

/**
 * Lobby's global chat dock — thin wrapper around the shared {@link ChatDock}.
 * Kept as its own export so LobbyPage's import path stays the same after the
 * room flow redesign introduced a room-scoped twin.
 */
export function LobbyChatDock() {
  return <ChatDock variant="global" />;
}
