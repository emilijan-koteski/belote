import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { useWebSocket } from "@/shared/hooks/useWebSocket";
import { useWsDispatch } from "@/shared/hooks/useWsDispatch";
import { useAuthStore } from "@/shared/stores/authStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { Suit } from "@/shared/types/gameTypes";
import {
  ACTION_ANNOUNCE_BELOT,
  ACTION_DECLARE,
  ACTION_DECLINE_BELOT,
  ACTION_PASS_TRUMP,
  ACTION_PICK_TRUMP,
  ACTION_PLAY_CARD,
  ACTION_SKIP_DECLARE,
} from "@/shared/types/wsEvents";

import { BelotPrompt } from "./components/BelotPrompt";
import { DealAnimation } from "./components/DealAnimation";
import { DeclarationPrompt } from "./components/DeclarationPrompt";
import { DeclarationReveal } from "./components/DeclarationReveal";
import { HandCards } from "./components/HandCards";
import { PlayerSeat } from "./components/PlayerSeat";
import { ReshuffleAnimation } from "./components/ReshuffleAnimation";
import { TrickArea } from "./components/TrickArea";
import { TrumpIndicator } from "./components/TrumpIndicator";
import { TrumpPrompt } from "./components/TrumpPrompt";

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
  const lastError = useGameStore((s) => s.lastError);
  const setLastError = useGameStore((s) => s.setLastError);
  const declarationReveal = useGameStore((s) => s.declarationReveal);
  const setDeclarationReveal = useGameStore((s) => s.setDeclarationReveal);

  const [chatOpen, setChatOpen] = useState(false);
  const [showReshuffle, setShowReshuffle] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Track previous phase to detect bidding→dealing transition (reshuffle)
  const prevPhaseRef = useRef<string | null>(null);

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

  // Detect reshuffle: bidding → dealing transition within same match
  const currentPhase = gameState?.phase;
  useEffect(() => {
    if (currentPhase) {
      if (prevPhaseRef.current === "bidding" && currentPhase === "dealing") {
        setShowReshuffle(true);
      }
      prevPhaseRef.current = currentPhase;
    }
  }, [currentPhase]);

  // Error toast display — uses same mapping as useWsDispatch error routing
  useEffect(() => {
    if (!lastError) return;
    const ERROR_I18N: Record<string, string> = {
      "error:wrong_phase": "game.errors.wrongPhase",
      "error:not_your_turn": "game.errors.notYourTurn",
      "error:invalid_action": "game.errors.invalidAction",
      "error:illegal_play": "game.errors.illegalPlay",
    };
    const i18nKey = ERROR_I18N[lastError];
    setLastError(null);
    if (!i18nKey) return; // Unknown error type — don't show toast or start timer
    setErrorToast(t(i18nKey));
    const timer = setTimeout(() => setErrorToast(null), 3000);
    return () => clearTimeout(timer);
  }, [lastError, setLastError, t]);

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

  // --- Action handlers ---
  const handlePlayCard = useCallback((cardId: string) => {
    sendMessage(ACTION_PLAY_CARD, { cardId });
  }, [sendMessage]);

  const handlePickTrump = useCallback((suit?: Suit) => {
    sendMessage(ACTION_PICK_TRUMP, suit ? { suit } : {});
  }, [sendMessage]);

  const handlePassTrump = useCallback(() => {
    sendMessage(ACTION_PASS_TRUMP, {});
  }, [sendMessage]);

  const handleDeclare = useCallback(() => {
    sendMessage(ACTION_DECLARE, {});
  }, [sendMessage]);

  const handleSkipDeclare = useCallback(() => {
    sendMessage(ACTION_SKIP_DECLARE, {});
  }, [sendMessage]);

  const handleAnnounceBelot = useCallback(() => {
    sendMessage(ACTION_ANNOUNCE_BELOT, {});
  }, [sendMessage]);

  const handleDeclineBelot = useCallback(() => {
    sendMessage(ACTION_DECLINE_BELOT, {});
  }, [sendMessage]);

  const handleReshuffleComplete = useCallback(() => {
    setShowReshuffle(false);
  }, []);

  const handleDeclarationRevealComplete = useCallback(() => {
    setDeclarationReveal(null);
  }, [setDeclarationReveal]);

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

  // Compute playable card IDs — block during prompts
  const isMyTurn =
    gameState.activePlayerSeat === myPlayerSeat &&
    gameState.phase === "playing" &&
    !gameState.awaitingDeclaration &&
    gameState.pendingBelotSeat !== myPlayerSeat;
  const myPlayer = gameState.players.find((p) => p.seat === myPlayerSeat);
  const myHand = myPlayer?.hand ?? [];
  const playableCardIds = isMyTurn
    ? myHand.map((card) => `${card.rank}${card.suit}`)
    : [];

  // Bidding state
  const isBiddingPhase = gameState.phase === "bidding";
  const isActiveBidder = isBiddingPhase && gameState.activePlayerSeat === myPlayerSeat;

  // Declaration state
  const showDeclarationPrompt =
    gameState.awaitingDeclaration === true &&
    gameState.activePlayerSeat === myPlayerSeat;

  // Belot state
  const showBelotPrompt =
    gameState.pendingBelotSeat === myPlayerSeat;

  // Deal animation state
  const isDealingPhase = gameState.phase === "dealing";

  return (
    <div
      className="h-screen w-screen overflow-hidden relative bg-background"
      data-testid="game-page"
    >
      {/* Score panel - top left */}
      <div className="absolute top-4 left-4 text-text-secondary font-display text-sm z-10">
        <span className="text-team-red">{gameState.teamScores[0]}</span>
        <span className="text-text-secondary mx-1">:</span>
        <span className="text-team-blue">{gameState.teamScores[1]}</span>
      </div>

      {/* Trump indicator - top right, visible only during play and later (AC 4.4.5) */}
      <div className="absolute top-4 right-16 z-10">
        {gameState.trumpSuit &&
          gameState.phase !== "dealing" &&
          gameState.phase !== "bidding" && (
          <TrumpIndicator trumpSuit={gameState.trumpSuit} />
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

      {/* Deal animation overlay */}
      {isDealingPhase && (
        <DealAnimation trumpCandidate={gameState.trumpCandidate} />
      )}

      {/* Reshuffle animation overlay */}
      {showReshuffle && (
        <ReshuffleAnimation onComplete={handleReshuffleComplete} />
      )}

      {/* Trump bidding prompt overlay */}
      {isBiddingPhase && (
        <TrumpPrompt
          trumpCandidate={gameState.trumpCandidate}
          biddingRound={gameState.biddingRound}
          isActiveBidder={isActiveBidder}
          onPick={handlePickTrump}
          onPass={handlePassTrump}
        />
      )}

      {/* Declaration prompt overlay */}
      {showDeclarationPrompt && myPlayer && (
        <DeclarationPrompt
          declarations={myPlayer.declarations}
          onDeclare={handleDeclare}
          onSkip={handleSkipDeclare}
        />
      )}

      {/* Belot prompt overlay */}
      {showBelotPrompt && (
        <BelotPrompt
          onAnnounce={handleAnnounceBelot}
          onDecline={handleDeclineBelot}
        />
      )}

      {/* Declaration resolution reveal */}
      {declarationReveal && (
        <DeclarationReveal
          payload={declarationReveal}
          onComplete={handleDeclarationRevealComplete}
        />
      )}

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

      {/* Error toast */}
      {errorToast && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-destructive/90 text-text-primary font-body text-sm px-4 py-2 rounded-lg"
          role="alert"
          data-testid="error-toast"
        >
          {errorToast}
        </div>
      )}
    </div>
  );
}
