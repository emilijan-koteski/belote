import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { useWsSendMessage } from "@/shared/providers/WebSocketContext";
import { useAuthStore } from "@/shared/stores/authStore";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { Suit } from "@/shared/types/gameTypes";
import {
  ACTION_ANNOUNCE_BELOT,
  ACTION_DECLARE,
  ACTION_DECLINE_BELOT,
  ACTION_OWNER_UNPAUSE,
  ACTION_PASS_TRUMP,
  ACTION_PAUSE,
  ACTION_PICK_TRUMP,
  ACTION_PLAY_CARD,
  ACTION_SKIP_DECLARE,
  ACTION_SURRENDER_ACCEPT,
  ACTION_SURRENDER_DECLINE,
  ACTION_SURRENDER_REQUEST,
  ACTION_UNPAUSE,
} from "@/shared/types/wsEvents";

import { BelotPrompt } from "./components/BelotPrompt";
import { BelotReveal } from "./components/BelotReveal";
import { CapotAnimation } from "./components/CapotAnimation";
import { DealAnimation } from "./components/DealAnimation";
import { DealerIndicator } from "./components/DealerIndicator";
import { DeclarationPrompt } from "./components/DeclarationPrompt";
import { DeclarationReveal } from "./components/DeclarationReveal";
import { HandCards } from "./components/HandCards";
import { MatchChatSidebar } from "./components/MatchChatSidebar";
import { MatchResult } from "./components/MatchResult";
import { PauseOverlay } from "./components/PauseOverlay";
import { PlayerSeat } from "./components/PlayerSeat";
import { ReconnectOverlay } from "./components/ReconnectOverlay";
import { ReshuffleAnimation } from "./components/ReshuffleAnimation";
import { ScorePanel } from "./components/ScorePanel";
import { ScoreReveal } from "./components/ScoreReveal";
import { SurrenderButton } from "./components/SurrenderButton";
import { SurrenderOpponentBanner } from "./components/SurrenderOpponentBanner";
import { SurrenderPrompt } from "./components/SurrenderPrompt";
import { TrickArea } from "./components/TrickArea";
import { TrumpIndicator } from "./components/TrumpIndicator";
import { TrumpPrompt } from "./components/TrumpPrompt";
import { TrumpReveal } from "./components/TrumpReveal";
import { detectDeclarations } from "./lib/declarations";
import { legalCardIds } from "./lib/legalCards";

function compassOffset(seat: number, myPlayerSeat: number): number {
  return (seat - myPlayerSeat + 4) % 4;
}

function teamColor(seat: number): "red" | "blue" {
  return seat % 2 === 0 ? "red" : "blue";
}

const SEAT_POSITIONS: Record<number, string> = {
  0: "bottom-24 left-1/2 -translate-x-1/2", // South (self) - above hand cards
  1: "right-4 top-1/2 -translate-y-1/2", // East (next player counter-clockwise)
  2: "top-4 left-1/2 -translate-x-1/2", // North (partner)
  3: "left-4 top-1/2 -translate-y-1/2", // West (third player)
};

export function GamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useParams<{ roomId: string }>();

  const sendMessage = useWsSendMessage();

  const user = useAuthStore((s) => s.user);
  const gameState = useGameStore((s) => s.gameState);
  const myPlayerSeat = useGameStore((s) => s.myPlayerSeat);
  const setMyPlayerSeat = useGameStore((s) => s.setMyPlayerSeat);
  const clearGame = useGameStore((s) => s.clearGame);
  const lastError = useGameStore((s) => s.lastError);
  const setLastError = useGameStore((s) => s.setLastError);
  const declarationReveal = useGameStore((s) => s.declarationReveal);
  const setDeclarationReveal = useGameStore((s) => s.setDeclarationReveal);
  const belotReveal = useGameStore((s) => s.belotReveal);
  const setBelotReveal = useGameStore((s) => s.setBelotReveal);
  const trumpReveal = useGameStore((s) => s.trumpReveal);
  const setTrumpReveal = useGameStore((s) => s.setTrumpReveal);
  const scoreRevealData = useGameStore((s) => s.scoreRevealData);
  const setScoreRevealData = useGameStore((s) => s.setScoreRevealData);
  const matchEndData = useGameStore((s) => s.matchEndData);
  const setMatchEndData = useGameStore((s) => s.setMatchEndData);
  const matchAbandonedData = useGameStore((s) => s.matchAbandonedData);
  const setMatchAbandonedData = useGameStore((s) => s.setMatchAbandonedData);

  const [showReshuffle, setShowReshuffle] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimerRef = useRef<number | null>(null);

  const dismissErrorToast = useCallback(() => {
    if (errorToastTimerRef.current !== null) {
      clearTimeout(errorToastTimerRef.current);
      errorToastTimerRef.current = null;
    }
    setErrorToast(null);
  }, []);

  // Overlay flow state: normal → capot_animation → score_reveal → normal/match_result
  type OverlayPhase = "normal" | "capot_animation" | "score_reveal" | "match_result";
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase>("normal");

  // Match chat history is tied to the GamePage lifecycle — clear it on
  // unmount (navigation away, abandonment, match-end → lobby) so the next
  // match starts with an empty panel. Ephemeral by design (AC #6).
  useEffect(() => {
    return () => {
      useChatStore.getState().clearMatch();
    };
  }, []);

  // Trigger overlay flow when score reveal data arrives
  useEffect(() => {
    if (scoreRevealData !== null && overlayPhase === "normal") {
      if (scoreRevealData.capot) {
        setOverlayPhase("capot_animation");
      } else {
        setOverlayPhase("score_reveal");
      }
    }
  }, [scoreRevealData, overlayPhase]);

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

  // Redirect to lobby on stale match_end state (e.g. page refresh after abandonment
  // when matchAbandonedData/matchEndData are lost from in-memory store)
  useEffect(() => {
    if (
      gameState &&
      gameState.phase === "match_end" &&
      matchEndData === null &&
      matchAbandonedData === null
    ) {
      clearGame();
      navigate("/lobby", { replace: true });
    }
  }, [gameState, matchEndData, matchAbandonedData, clearGame, navigate]);

  // Transition to match result after score reveal is dismissed (if match ended)
  useEffect(() => {
    if (matchEndData !== null && overlayPhase === "normal") {
      setOverlayPhase("match_result");
    }
  }, [matchEndData, overlayPhase]);

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

  // Track whether the most recent client action was a surrender so the next
  // ErrInvalidAction / ErrWrongPhase rejection can route to the
  // surrender-specific i18n strings instead of the generic ones.
  const surrenderActionInFlightRef = useRef(false);

  // Error toast display — uses same mapping as useWsDispatch error routing.
  // Timer is tracked via ref (not effect cleanup) so the 3 s auto-dismiss isn't
  // cancelled by the re-run triggered by setLastError(null).
  useEffect(() => {
    if (!lastError) return;
    const ERROR_I18N: Record<string, string> = {
      "error:wrong_phase": "game.errors.wrongPhase",
      "error:not_your_turn": "game.errors.notYourTurn",
      "error:invalid_action": "game.errors.invalidAction",
      "error:illegal_play": "game.errors.illegalPlay",
      "error:pause_exhausted": "game.errors.pauseExhausted",
      "error:no_active_pause": "game.errors.noActivePause",
      "error:not_room_owner": "game.errors.notRoomOwner",
    };
    const SURRENDER_ERROR_I18N: Record<string, string> = {
      "error:invalid_action": "game.surrender.errors.actionRequired",
      "error:wrong_phase": "game.surrender.errors.wrongPhase",
    };
    const surrenderKey = surrenderActionInFlightRef.current
      ? SURRENDER_ERROR_I18N[lastError]
      : undefined;
    surrenderActionInFlightRef.current = false;
    const i18nKey = surrenderKey ?? ERROR_I18N[lastError];
    setLastError(null);
    if (!i18nKey) return;
    if (errorToastTimerRef.current !== null) {
      clearTimeout(errorToastTimerRef.current);
    }
    setErrorToast(t(i18nKey));
    errorToastTimerRef.current = window.setTimeout(() => {
      setErrorToast(null);
      errorToastTimerRef.current = null;
    }, 3000);
  }, [lastError, setLastError, t]);

  useEffect(() => {
    return () => {
      if (errorToastTimerRef.current !== null) {
        clearTimeout(errorToastTimerRef.current);
      }
    };
  }, []);

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
  const handlePlayCard = useCallback(
    (cardId: string) => {
      sendMessage(ACTION_PLAY_CARD, { cardId });
    },
    [sendMessage],
  );

  const handlePickTrump = useCallback(
    (suit?: Suit) => {
      sendMessage(ACTION_PICK_TRUMP, suit ? { suit } : {});
    },
    [sendMessage],
  );

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

  const handlePause = useCallback(() => {
    sendMessage(ACTION_PAUSE, {});
  }, [sendMessage]);

  const handleUnpause = useCallback(() => {
    sendMessage(ACTION_UNPAUSE, {});
  }, [sendMessage]);

  const handleOwnerUnpause = useCallback(() => {
    sendMessage(ACTION_OWNER_UNPAUSE, {});
  }, [sendMessage]);

  const handleSurrenderRequest = useCallback(() => {
    surrenderActionInFlightRef.current = true;
    sendMessage(ACTION_SURRENDER_REQUEST, {});
  }, [sendMessage]);

  const handleSurrenderAccept = useCallback(() => {
    surrenderActionInFlightRef.current = true;
    sendMessage(ACTION_SURRENDER_ACCEPT, {});
  }, [sendMessage]);

  const handleSurrenderDecline = useCallback(() => {
    surrenderActionInFlightRef.current = true;
    sendMessage(ACTION_SURRENDER_DECLINE, {});
  }, [sendMessage]);

  const handleReshuffleComplete = useCallback(() => {
    setShowReshuffle(false);
  }, []);

  const handleDeclarationRevealComplete = useCallback(() => {
    setDeclarationReveal(null);
  }, [setDeclarationReveal]);

  const handleBelotRevealComplete = useCallback(() => {
    setBelotReveal(null);
  }, [setBelotReveal]);

  const handleTrumpRevealComplete = useCallback(() => {
    setTrumpReveal(null);
  }, [setTrumpReveal]);

  const handleCapotComplete = useCallback(() => {
    setOverlayPhase("score_reveal");
  }, []);

  const handleScoreRevealContinue = useCallback(() => {
    setScoreRevealData(null);
    if (matchEndData !== null) {
      setOverlayPhase("match_result");
    } else {
      setOverlayPhase("normal");
    }
  }, [matchEndData, setScoreRevealData]);

  const handleReturnToLobby = useCallback(() => {
    setMatchEndData(null);
    clearGame();
    navigate("/lobby");
  }, [clearGame, navigate, setMatchEndData]);

  const handleAbandonReturnToLobby = useCallback(() => {
    setMatchAbandonedData(null);
    clearGame();
    navigate("/lobby");
  }, [clearGame, navigate, setMatchAbandonedData]);

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

  // Pause state
  const isRoomOwner = myPlayerSeat !== null && gameState.ownerSeat === myPlayerSeat;
  const isPaused = gameState.phase === "paused";
  const canPause =
    !isPaused &&
    (gameState.phase === "playing" || gameState.phase === "bidding") &&
    myPlayerSeat !== null &&
    !gameState.pauseUsed?.[myPlayerSeat];

  // Surrender state (Story 8.2)
  const surrenderProposerSeat = gameState.surrenderProposerSeat;
  const isProposer = surrenderProposerSeat !== null && surrenderProposerSeat === myPlayerSeat;
  const isPartnerOfProposer =
    surrenderProposerSeat !== null &&
    myPlayerSeat !== null &&
    (surrenderProposerSeat + 2) % 4 === myPlayerSeat;
  const isOpponentOfProposer =
    surrenderProposerSeat !== null && myPlayerSeat !== null && !isProposer && !isPartnerOfProposer;
  const showSurrenderControls =
    myPlayerSeat !== null && (gameState.phase === "playing" || gameState.phase === "bidding");
  const canSurrenderRequest =
    showSurrenderControls &&
    surrenderProposerSeat === null &&
    myPlayerSeat !== null &&
    !gameState.surrenderUsed?.[myPlayerSeat];
  const proposerPlayer =
    surrenderProposerSeat !== null
      ? gameState.players.find((p) => p.seat === surrenderProposerSeat)
      : undefined;
  const proposerUsername = proposerPlayer?.username ?? t("game.surrender.unknownProposer");

  const surrenderedByUsername =
    matchEndData?.outcomeReason === "surrender" &&
    typeof matchEndData.surrenderedBySeat === "number"
      ? gameState.players.find((p) => p.seat === matchEndData.surrenderedBySeat)?.username
      : undefined;

  // Compute playable card IDs — block during prompts and pause
  const isMyTurn =
    gameState.activePlayerSeat === myPlayerSeat &&
    gameState.phase === "playing" &&
    !gameState.awaitingDeclaration &&
    gameState.pendingBelotSeat !== myPlayerSeat;
  const myPlayer = gameState.players.find((p) => p.seat === myPlayerSeat);
  const myHand = myPlayer?.hand ?? [];
  const playableCardIds =
    isMyTurn && myPlayerSeat !== null ? legalCardIds(gameState, myPlayerSeat) : [];

  // Bidding state
  const isBiddingPhase = gameState.phase === "bidding";
  const isActiveBidder = isBiddingPhase && gameState.activePlayerSeat === myPlayerSeat;

  // Declaration state
  const showDeclarationPrompt =
    gameState.awaitingDeclaration === true && gameState.activePlayerSeat === myPlayerSeat;

  // Belot state
  const showBelotPrompt = gameState.pendingBelotSeat === myPlayerSeat;
  // The triggering K/Q is the last card of the current trick at prompt time.
  const belotPromptLastTrickCard = showBelotPrompt
    ? (gameState.currentTrick[gameState.currentTrick.length - 1] ?? null)
    : null;
  const belotPromptIsKing = belotPromptLastTrickCard?.card.rank === "K";

  // Deal animation state
  const isDealingPhase = gameState.phase === "dealing";

  return (
    <div
      className="h-screen w-screen overflow-hidden relative bg-background"
      data-testid="game-page"
    >
      {/* Score panel - top left */}
      <ScorePanel
        redScore={gameState.teamScores[0]}
        blueScore={gameState.teamScores[1]}
        redTricks={gameState.tricksWon[0]}
        blueTricks={gameState.tricksWon[1]}
        redHandPotential={gameState.handPoints[0] + gameState.declarationPoints[0]}
        blueHandPotential={gameState.handPoints[1] + gameState.declarationPoints[1]}
        lastTrickBonus={scoreRevealData?.lastTrickBonus}
        lastTrickTeam={scoreRevealData?.lastTrickTeam}
      />

      {/* Dealer + trump indicators - top right, stacked vertically.
          Trump indicator is gated to play phases (AC 4.4.5); the dealer
          indicator is visible whenever the dealer's seat resolves to a player. */}
      <div className="absolute top-4 right-16 z-10 flex flex-col items-end gap-2">
        {(() => {
          const dealerName = gameState.players.find(
            (p) => p.seat === gameState.dealerSeat,
          )?.username;
          return dealerName ? <DealerIndicator dealerName={dealerName} /> : null;
        })()}
        {gameState.trumpSuit && gameState.phase !== "dealing" && gameState.phase !== "bidding" && (
          <TrumpIndicator
            trumpSuit={gameState.trumpSuit}
            trumpCallerSeat={gameState.trumpCallerSeat}
            trumpCallerName={
              gameState.trumpCallerSeat !== null
                ? (gameState.players.find((p) => p.seat === gameState.trumpCallerSeat)?.username ??
                  null)
                : null
            }
          />
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
              turnExpiresAt={isActive ? gameState.turnExpiresAt : null}
              timerDuration={gameState.timerDurationSec}
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

      {/* Pause + surrender controls — bottom-left stack */}
      {(gameState.phase === "playing" || gameState.phase === "bidding") && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
          <button
            className="border border-border text-text-secondary font-body text-sm px-3 py-1.5 rounded-lg hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handlePause}
            disabled={!canPause}
            data-testid="pause-button"
          >
            {gameState.pauseUsed?.[myPlayerSeat]
              ? t("game.pause.pauseUsed")
              : t("game.pause.pauseButton")}
          </button>

          <SurrenderButton
            canRequest={canSurrenderRequest}
            isExhausted={!!gameState.surrenderUsed?.[myPlayerSeat]}
            isPending={surrenderProposerSeat !== null}
            onConfirm={handleSurrenderRequest}
          />
        </div>
      )}

      {/* Surrender prompt — partner-only, modal. Suppress while a match-end
          / match-abandoned overlay is up so the prompt's focus trap doesn't
          swallow Tab navigation to the Return-to-Lobby button. */}
      {isPartnerOfProposer && matchEndData === null && matchAbandonedData === null && (
        <SurrenderPrompt
          proposerUsername={proposerUsername}
          onAccept={handleSurrenderAccept}
          onDecline={handleSurrenderDecline}
        />
      )}

      {/* Surrender opponent banner — non-modal status strip. Same overlay
          gate as the prompt. */}
      {isOpponentOfProposer && matchEndData === null && matchAbandonedData === null && (
        <SurrenderOpponentBanner proposerUsername={proposerUsername} />
      )}

      {/* Pause overlay */}
      {isPaused && (
        <PauseOverlay
          pausedPlayers={gameState.pausedPlayers}
          pauseUsed={gameState.pauseUsed}
          players={gameState.players}
          myPlayerSeat={myPlayerSeat}
          isRoomOwner={isRoomOwner}
          onResume={handleUnpause}
          onPause={handlePause}
          onOwnerResume={handleOwnerUnpause}
        />
      )}

      {/* Reconnect overlay — shown during disconnect countdown OR abandonment */}
      {((gameState.phase === "disconnected" &&
        gameState.disconnectedSeat !== -1 &&
        gameState.reconnectExpiresAt) ||
        matchAbandonedData) && (
        <ReconnectOverlay
          disconnectedPlayerName={
            matchAbandonedData
              ? (gameState.players[matchAbandonedData.abandonedByPlayer]?.username ??
                `Player ${matchAbandonedData.abandonedByPlayer + 1}`)
              : (gameState.players[gameState.disconnectedSeat]?.username ??
                `Player ${gameState.disconnectedSeat + 1}`)
          }
          reconnectExpiresAt={gameState.reconnectExpiresAt ?? ""}
          abandonedData={matchAbandonedData}
          onReturnToLobby={handleAbandonReturnToLobby}
        />
      )}

      {/* Deal animation overlay */}
      {isDealingPhase && <DealAnimation trumpCandidate={gameState.trumpCandidate} />}

      {/* Reshuffle animation overlay */}
      {showReshuffle && <ReshuffleAnimation onComplete={handleReshuffleComplete} />}

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
          declarations={
            myPlayer.declarations.length > 0
              ? myPlayer.declarations
              : detectDeclarations(myPlayer.hand)
          }
          onDeclare={handleDeclare}
          onSkip={handleSkipDeclare}
        />
      )}

      {/* Belot prompt overlay */}
      {showBelotPrompt && (
        <BelotPrompt
          isKing={belotPromptIsKing}
          onAnnounce={handleAnnounceBelot}
          onDecline={handleDeclineBelot}
        />
      )}

      {/* Declaration resolution reveal */}
      {declarationReveal && (
        <DeclarationReveal
          payload={declarationReveal}
          myPlayerSeat={myPlayerSeat}
          players={gameState.players}
          onComplete={handleDeclarationRevealComplete}
        />
      )}

      {/* Belot / Re-belot reveal — keyed on payload so back-to-back reveals remount cleanly */}
      {belotReveal && (
        <BelotReveal
          key={`${belotReveal.playerSeat}-${belotReveal.cardId}`}
          playerSeat={belotReveal.playerSeat}
          myPlayerSeat={myPlayerSeat}
          cardId={belotReveal.cardId}
          isKing={belotReveal.cardId.startsWith("K")}
          onComplete={handleBelotRevealComplete}
        />
      )}

      {/* Trump-take reveal — table-wide dialog showing the picker and the
          originally face-up trumpCandidate. Keyed on payload so a reshuffle-
          then-pick sequence remounts cleanly. */}
      {trumpReveal && (
        <TrumpReveal
          key={`${trumpReveal.playerSeat}-${trumpReveal.cardId}`}
          playerSeat={trumpReveal.playerSeat}
          cardId={trumpReveal.cardId}
          players={gameState.players}
          onComplete={handleTrumpRevealComplete}
        />
      )}

      {/* Match chat sidebar — collapsible right-edge panel broadcasting to the 4 participants */}
      <MatchChatSidebar />

      {/* Capot animation overlay */}
      {overlayPhase === "capot_animation" &&
        scoreRevealData?.capotTeam !== null &&
        scoreRevealData?.capotTeam !== undefined && (
          <CapotAnimation capotTeam={scoreRevealData.capotTeam} onComplete={handleCapotComplete} />
        )}

      {/* Score reveal overlay */}
      {overlayPhase === "score_reveal" && scoreRevealData !== null && (
        <ScoreReveal data={scoreRevealData} onContinue={handleScoreRevealContinue} />
      )}

      {/* Match result overlay */}
      {overlayPhase === "match_result" && matchEndData !== null && (
        <MatchResult
          data={matchEndData}
          onReturnToLobby={handleReturnToLobby}
          surrenderedByUsername={surrenderedByUsername}
        />
      )}

      {/* Error toast */}
      {errorToast && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-destructive/90 text-text-primary font-body text-sm px-4 py-2 rounded-lg flex items-center gap-3"
          role="alert"
          data-testid="error-toast"
        >
          <span>{errorToast}</span>
          <button
            type="button"
            onClick={dismissErrorToast}
            aria-label={t("common.close")}
            data-testid="error-toast-close"
            className="text-text-primary/80 hover:text-text-primary text-lg leading-none px-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
