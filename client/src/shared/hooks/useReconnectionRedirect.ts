import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { useGameStore } from "@/shared/stores/gameStore";

/**
 * Redirects to the game page when game state is received while not on the game page.
 * Handles the case where a disconnected player refreshes their browser and lands on
 * the lobby — the server sends event:game_state on WS reconnect, and this hook
 * navigates them back to the active game.
 */
export function useReconnectionRedirect(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const gameState = useGameStore((s) => s.gameState);

  useEffect(() => {
    if (
      gameState &&
      gameState.roomId &&
      gameState.phase !== "match_end" &&
      !location.pathname.startsWith("/game/")
    ) {
      navigate(`/game/${gameState.roomId}`, { replace: true });
    }
  }, [gameState, location.pathname, navigate]);
}
