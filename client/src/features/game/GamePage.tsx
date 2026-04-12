import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { useWebSocket } from "@/shared/hooks/useWebSocket";
import { useWsDispatch } from "@/shared/hooks/useWsDispatch";
import { useAuthStore } from "@/shared/stores/authStore";
import { useGameStore } from "@/shared/stores/gameStore";
import { ACTION_PLAY_CARD } from "@/shared/types/wsEvents";

import { HandCards } from "./components/HandCards";
import { PlayerSeat } from "./components/PlayerSeat";
import { TrickArea } from "./components/TrickArea";

function compassOffset(seat: number, myPlayerSeat: number): number {
  return (seat - myPlayerSeat + 4) % 4;
}

function teamColor(seat: number): "red" | "blue" {
  return seat % 2 === 0 ? "red" : "blue";
}

const SEAT_POSITIONS: Record<number, string> = {
  0: "bottom-24 left-1/2 -translate-x-1/2",  // South (self) - above hand cards
  1: "left-4 top-1/2 -translate-y-1/2",       // West
  2: "top-4 left-1/2 -translate-x-1/2",       // North
  3: "right-4 top-1/2 -translate-y-1/2",      // East
};

export function GamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roomId: _roomIdParam } = useParams<{ roomId: string }>();

  const dispatch = useWsDispatch();
  const { sendMessage } = useWebSocket({ onMessage: dispatch });

  const user = useAuthStore((s) => s.user);
  const gameState = useGameStore((s) => s.gameState);
  const myPlayerSeat = useGameStore((s) => s.myPlayerSeat);
  const setMyPlayerSeat = useGameStore((s) => s.setMyPlayerSeat);
  const clearGame = useGameStore((s) => s.clearGame);

  const [chatOpen, setChatOpen] = useState(false);

  // Derive myPlayerSeat on first game state
  useEffect(() => {
    if (gameState && user && myPlayerSeat === null) {
      const myPlayer = gameState.players.find((p) => p.userId === user.id);
      if (myPlayer !== undefined) {
        setMyPlayerSeat(myPlayer.seat);
      }
    }
  }, [gameState, user, myPlayerSeat, setMyPlayerSeat]);

  // Navigate to lobby on match end
  useEffect(() => {
    if (gameState?.phase === "match_end") {
      const timer = setTimeout(() => {
        clearGame();
        navigate("/lobby");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, clearGame, navigate]);

  // Browser back-button interception — push sentinel entry only once
  const historyPushedRef = useRef(false);
  useEffect(() => {
    if (!gameState) return;

    const handlePopState = () => {
      const leave = window.confirm(t("game.leaveConfirm"));
      if (leave) {
        clearGame();
        navigate("/lobby");
      } else {
        window.history.pushState(null, "", window.location.href);
      }
    };

    if (!historyPushedRef.current) {
      window.history.pushState(null, "", window.location.href);
      historyPushedRef.current = true;
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [gameState, clearGame, navigate, t]);

  // Loading state
  if (!gameState || myPlayerSeat === null) {
    return (
      <div
        className="h-screen w-screen overflow-hidden bg-background flex items-center justify-center"
        data-testid="game-page"
      >
        <span className="text-text-secondary font-body text-lg">{t("game.loading")}</span>
      </div>
    );
  }

  // Compute playable card IDs
  const isMyTurn =
    gameState.activePlayerSeat === myPlayerSeat && gameState.phase === "playing";
  const myPlayer = gameState.players.find((p) => p.seat === myPlayerSeat);
  const myHand = myPlayer?.hand ?? [];
  const playableCardIds = isMyTurn
    ? myHand.map((card) => `${card.rank}${card.suit}`)
    : [];

  const handlePlayCard = (cardId: string) => {
    sendMessage(ACTION_PLAY_CARD, { cardId });
  };

  return (
    <div
      className="h-screen w-screen overflow-hidden relative bg-background"
      data-testid="game-page"
    >
      {/* Score placeholder - top left */}
      <div className="absolute top-4 left-4 text-text-secondary font-display text-sm">
        <span className="text-team-red">{gameState.teamScores[0]}</span>
        <span className="text-text-secondary mx-1">:</span>
        <span className="text-team-blue">{gameState.teamScores[1]}</span>
      </div>

      {/* Trump indicator placeholder - top right */}
      <div className="absolute top-4 right-16">
        {gameState.trumpSuit && (
          <span className="text-text-secondary font-body text-sm">
            {t("game.trump", { suit: gameState.trumpSuit })}
          </span>
        )}
      </div>

      {/* Player seats at compass positions */}
      {gameState.players.map((player) => {
        const compass = compassOffset(player.seat, myPlayerSeat);
        const isSelf = player.seat === myPlayerSeat;
        const isActive = gameState.activePlayerSeat === player.seat;

        return (
          <div
            key={player.seat}
            className={`absolute ${SEAT_POSITIONS[compass]}`}
            data-testid={`player-seat-${compass}`}
          >
            <PlayerSeat
              player={player}
              isSelf={isSelf}
              isActive={isActive}
              teamColor={teamColor(player.seat)}
              cardCount={isSelf ? undefined : player.hand.length}
            />
          </div>
        );
      })}

      {/* Trick area - center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <TrickArea
          trick={gameState.currentTrick}
          winnerSeat={gameState.trickWinnerSeat}
          myPlayerSeat={myPlayerSeat}
        />
      </div>

      {/* Hand cards - bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <HandCards
          hand={myHand}
          isMyTurn={isMyTurn}
          playableCardIds={playableCardIds}
          onPlayCard={handlePlayCard}
        />
      </div>

      {/* Chat sidebar toggle — hidden when sidebar is open */}
      {!chatOpen && (
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-surface-elevated border border-border rounded-l-lg p-2 text-text-secondary hover:text-text-primary"
          onClick={() => setChatOpen(true)}
          aria-label={t("game.chat.title")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat sidebar */}
      {chatOpen && (
        <aside className="absolute right-0 top-0 h-full w-64 bg-surface border-l border-border p-4 flex flex-col gap-2 z-20">
          <div className="flex items-center justify-between">
            <h2 className="font-body text-sm font-semibold text-text-primary">
              {t("game.chat.title")}
            </h2>
            <button
              className="text-text-secondary hover:text-text-primary"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              &times;
            </button>
          </div>
          <p className="font-body text-xs text-text-secondary">
            {t("game.chat.placeholder")}
          </p>
        </aside>
      )}
    </div>
  );
}
