import { HelpCircle, Pause, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { FLAG_LIFETIME, MOTION } from "@/shared/lib/motion";
import { useWsSendMessage } from "@/shared/providers/WebSocketContext";
import { useAuthStore } from "@/shared/stores/authStore";
import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { Suit, TeamString } from "@/shared/types/gameTypes";
import {
  ACTION_ANNOUNCE_BELOT,
  ACTION_DECLARE,
  ACTION_DECLINE_BELOT,
  ACTION_EMOTE,
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
  type EmoteID,
} from "@/shared/types/wsEvents";

import { BelotPrompt } from "./components/BelotPrompt";
import { BelotReveal } from "./components/BelotReveal";
import { CapotAnimation } from "./components/CapotAnimation";
import { DealAnimation } from "./components/DealAnimation";
import { DeclarationPrompt } from "./components/DeclarationPrompt";
import { DeclarationReveal } from "./components/DeclarationReveal";
import { EmoteBubble } from "./components/EmoteBubble";
import { EmotePickerButton } from "./components/EmotePickerButton";
import { HandCards } from "./components/HandCards";
import { HUDButton } from "./components/HUDButton";
import { MatchChatSidebar } from "./components/MatchChatSidebar";
import { MatchResult } from "./components/MatchResult";
import { PauseOverlay } from "./components/PauseOverlay";
import { PlayerSeat, type SeatOrientation } from "./components/PlayerSeat";
import { ReconnectOverlay } from "./components/ReconnectOverlay";
import { ReshuffleAnimation } from "./components/ReshuffleAnimation";
import { RulesDialog } from "./components/RulesDialog";
import { ScorePanel } from "./components/ScorePanel";
import { ScoreReveal } from "./components/ScoreReveal";
import { SettingsDialog } from "./components/SettingsDialog";
import { SurrenderButton } from "./components/SurrenderButton";
import { SurrenderOpponentBanner } from "./components/SurrenderOpponentBanner";
import { SurrenderPrompt } from "./components/SurrenderPrompt";
import { TableAmbience } from "./components/TableAmbience";
import { TableBackdrop } from "./components/TableBackdrop";
import { TrickArea } from "./components/TrickArea";
import { TrumpIndicator } from "./components/TrumpIndicator";
import { TrumpPrompt } from "./components/TrumpPrompt";
import { TrumpReveal } from "./components/TrumpReveal";
import { Wordmark } from "./components/Wordmark";
import { detectDeclarations } from "./lib/declarations";
import { legalCardIds } from "./lib/legalCards";
import { seatTeam } from "./lib/tableTheme";

function compassOffset(seat: number, myPlayerSeat: number): number {
  return (seat - myPlayerSeat + 4) % 4;
}

const SEAT_POSITIONS: Record<number, string> = {
  0: "bottom-44 left-1/2 -translate-x-1/2", // South (self) - above the fanned hand
  1: "right-16 top-1/2 -translate-y-1/2", // East (next player counter-clockwise) - inset off wood rim
  2: "top-16 left-1/2 -translate-x-1/2", // North (partner) - clears the wordmark
  3: "left-16 top-1/2 -translate-y-1/2", // West (third player) - inset off wood rim
};

const SEAT_ORIENTATIONS: Record<number, SeatOrientation> = {
  0: "bottom",
  1: "right",
  2: "top",
  3: "left",
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
  const activeEmotes = useGameStore((s) => s.activeEmotes);
  const setActiveEmote = useGameStore((s) => s.setActiveEmote);

  const [showReshuffle, setShowReshuffle] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimerRef = useRef<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Local card-throw animation: set on play_card dispatch, cleared shortly
  // after so HandCards animates the played card down + fades it. The actual
  // hand removal arrives via the next gameState push, which keys the
  // remaining cards by id so HandCards stays stable across the hand-off.
  const [flyingCardId, setFlyingCardId] = useState<string | null>(null);
  const flyingClearTimerRef = useRef<number | null>(null);

  // ScoreReveal needs the trump suit / caller seat from the just-finished
  // hand for its contract-held subtitle. The server pushes the next-hand
  // gameState (trumpSuit=null) close to the hand_scored payload, so by the
  // time the reveal mounts those fields may already be cleared. Snapshot
  // the latest non-null trump info every render — the snapshot survives
  // the next-hand reset and feeds ScoreReveal cleanly.
  const lastTrumpRef = useRef<{ suit: Suit | null; callerSeat: number | null }>({
    suit: null,
    callerSeat: null,
  });
  if (gameState?.trumpSuit) {
    lastTrumpRef.current = {
      suit: gameState.trumpSuit,
      callerSeat: gameState.trumpCallerSeat,
    };
  }

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

  // Chat sidebar open/closed — lifted here so the rules/settings cluster can
  // hide the emote button while the chat sidebar is occupying the right rail.
  const [isChatOpen, setIsChatOpen] = useState(false);

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
    }, MOTION.TOAST_ERROR);
  }, [lastError, setLastError, t]);

  useEffect(() => {
    return () => {
      if (errorToastTimerRef.current !== null) {
        clearTimeout(errorToastTimerRef.current);
      }
      if (flyingClearTimerRef.current !== null) {
        clearTimeout(flyingClearTimerRef.current);
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
      // Trigger the hand-throw animation immediately so the gesture starts
      // before the WS round-trip completes. The card is cleared from the
      // local hand by the next gameState push (server removes it from
      // `players[seat].hand`); this state just controls the exit animation.
      setFlyingCardId(cardId);
      if (flyingClearTimerRef.current !== null) {
        clearTimeout(flyingClearTimerRef.current);
      }
      flyingClearTimerRef.current = window.setTimeout(() => {
        setFlyingCardId(null);
        flyingClearTimerRef.current = null;
      }, FLAG_LIFETIME.FLYING_CARD);
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

  const handleSendEmote = useCallback(
    (emote: EmoteID) => {
      sendMessage(ACTION_EMOTE, { emote });
    },
    [sendMessage],
  );

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

  // Loading state — themed with the in-game felt + brass palette so the
  // transition into the table doesn't flash a generic dark splash. We can't
  // render the full TableBackdrop (no gameState yet), so this is a slimmed-
  // down felt gradient + brass spinner using the same tokens.
  if (!gameState || myPlayerSeat === null) {
    return (
      <div
        className="game-table h-screen w-screen overflow-hidden flex items-center justify-center"
        data-testid="game-page"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, var(--felt-dark) 0%, var(--felt-deep) 60%, var(--felt-bg) 100%)",
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <span
            aria-hidden
            className="inline-block rounded-full motion-safe:animate-spin"
            style={{
              width: 36,
              height: 36,
              border: "2px solid rgba(201,168,118,0.18)",
              borderTopColor: "var(--brass, #c9a876)",
              animationDuration: "0.9s",
            }}
          />
          <span
            className="font-body text-base"
            style={{
              color: "var(--ink-light, #f5f2e8)",
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: 0.3,
              opacity: 0.85,
            }}
          >
            {t("game.loading")}
          </span>
        </div>
      </div>
    );
  }

  // Viewer team derivation — single rule, frontend only. Components rendered
  // below this guard always have a non-null myPlayerSeat, so viewerTeam is
  // always a real TeamString when we're inside an active match.
  const viewerTeam: TeamString = myPlayerSeat % 2 === 0 ? "teamA" : "teamB";

  // Pause state
  const isRoomOwner = myPlayerSeat !== null && gameState.ownerSeat === myPlayerSeat;
  const isPaused = gameState.phase === "paused";

  // Single source of truth for "is an overlay covering the table". Used to
  // gate reveals (D112) and the dealer/trump pill (dealer-indicator D97).
  const isOverlayActive =
    isPaused ||
    matchEndData !== null ||
    matchAbandonedData !== null ||
    gameState.phase === "disconnected";
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
      className="game-table h-screen w-screen overflow-hidden relative bg-background"
      data-testid="game-page"
    >
      {/* Static table chrome — felt + wood rim + brass oval + filigree */}
      <TableBackdrop />
      {/* Floating particles + soft top beam (decorative, reduced-motion aware) */}
      <TableAmbience intensity={0.9} tint="#ffe9b0" />
      {/* "Beljot.online" wordmark — top center */}
      <Wordmark />

      {/* Score panel - top left */}
      <ScorePanel
        viewerTeam={viewerTeam}
        teamAScore={gameState.teamScores[0]}
        teamBScore={gameState.teamScores[1]}
        teamATricks={gameState.tricksWon[0]}
        teamBTricks={gameState.tricksWon[1]}
        teamAHandPotential={gameState.handPoints[0] + gameState.declarationPoints[0]}
        teamBHandPotential={gameState.handPoints[1] + gameState.declarationPoints[1]}
        lastTrickBonus={scoreRevealData?.lastTrickBonus}
        lastTrickTeam={scoreRevealData?.lastTrickTeam}
        handNumber={gameState.handNumber}
        variantLabel={t(`game.variants.${gameState.variant}`, { defaultValue: gameState.variant })}
      />

      {/* Trump indicator - top right. Gated to play phases (AC 4.4.5) and
          hidden behind any active overlay. The dealer is now indicated by a
          chip on the dealer's avatar (Stage 2), so the standalone dealer pill
          is no longer rendered here. */}
      {!isOverlayActive &&
        gameState.trumpSuit &&
        gameState.phase !== "dealing" &&
        gameState.phase !== "bidding" && (
          <div className="absolute top-4 right-4 z-10">
            <TrumpIndicator
              trumpSuit={gameState.trumpSuit}
              trumpCallerSeat={gameState.trumpCallerSeat}
              trumpCallerName={
                gameState.trumpCallerSeat !== null
                  ? (gameState.players.find((p) => p.seat === gameState.trumpCallerSeat)
                      ?.username ?? null)
                  : null
              }
              viewerTeam={viewerTeam}
            />
          </div>
        )}

      {/* Player seats at compass positions */}
      {gameState.players.map((player) => {
        const compass = compassOffset(player.seat, myPlayerSeat);
        const isSelf = player.seat === myPlayerSeat;
        const isActive = gameState.activePlayerSeat === player.seat;
        // Caller chip only shows the suit when this seat IS the trump caller.
        const isCaller =
          gameState.trumpCallerSeat !== null &&
          gameState.trumpCallerSeat === player.seat &&
          gameState.trumpSuit !== null;

        return (
          <div
            key={player.seat}
            className={`absolute ${SEAT_POSITIONS[compass]}`}
            data-testid={`player-seat-${compass}-wrapper`}
          >
            <PlayerSeat
              player={player}
              isSelf={isSelf}
              isActive={isActive}
              seatTeam={seatTeam(player.seat, myPlayerSeat)}
              cardCount={isSelf ? undefined : player.hand.length}
              turnExpiresAt={isActive ? gameState.turnExpiresAt : null}
              timerDuration={gameState.timerDurationSec}
              isDealer={gameState.dealerSeat === player.seat}
              trumpCallerSuit={isCaller ? gameState.trumpSuit : null}
              orientation={SEAT_ORIENTATIONS[compass]}
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

      {/* Hand cards - bottom center. While a personal action prompt is up
          (trump bidding, belot announcement, declaration) the hand is
          elevated to z-50 so it sits between the OverlayBackdrop dim (z-40)
          and the panel itself (z-60) — the player can read their cards
          unblurred while everything else stays dimmed. */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${
          isActiveBidder || showBelotPrompt || showDeclarationPrompt ? "z-50" : ""
        }`}
      >
        <HandCards
          hand={myHand}
          isMyTurn={isMyTurn}
          playableCardIds={playableCardIds}
          onPlayCard={handlePlayCard}
          flyingId={flyingCardId}
        />
      </div>

      {/* Pause + surrender controls — bottom-left HUD cluster */}
      {(gameState.phase === "playing" || gameState.phase === "bidding") && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <HUDButton
            icon={<Pause className="h-4 w-4" aria-hidden="true" />}
            label={
              gameState.pauseUsed?.[myPlayerSeat] ? t("game.pause.pauseUsed") : t("game.hud.pause")
            }
            onClick={handlePause}
            disabled={!canPause}
            data-testid="pause-button"
          />

          <SurrenderButton
            canRequest={canSurrenderRequest}
            isExhausted={!!gameState.surrenderUsed?.[myPlayerSeat]}
            isPending={surrenderProposerSeat !== null}
            onConfirm={handleSurrenderRequest}
          />
        </div>
      )}

      {/* Rules + settings + emote — bottom-right HUD cluster sitting LEFT of
          the chat FAB. The emote button joins this row (instead of floating
          on its own) and is hidden while the chat sidebar is open so it
          doesn't peek out from behind the rail. The Sound button is
          intentionally omitted until audio ships. */}
      {!isOverlayActive && (
        <div className="absolute bottom-4 right-24 z-10 flex items-center gap-2">
          <HUDButton
            icon={<HelpCircle className="h-4 w-4" aria-hidden="true" />}
            aria-label={t("game.hud.rules")}
            title={t("game.hud.rules")}
            onClick={() => setRulesOpen(true)}
            data-testid="rules-button"
          />
          <HUDButton
            icon={<SettingsIcon className="h-4 w-4" aria-hidden="true" />}
            aria-label={t("game.hud.settings")}
            title={t("game.hud.settings")}
            onClick={() => setSettingsOpen(true)}
            data-testid="settings-button"
          />
          {!isChatOpen &&
            (gameState.phase === "dealing" ||
              gameState.phase === "bidding" ||
              gameState.phase === "playing") &&
            matchEndData === null &&
            matchAbandonedData === null && <EmotePickerButton onSend={handleSendEmote} />}
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

      {/* Surrender opponent banner — non-modal status strip anchored to the
          proposer's seat (same per-seat pattern as EmoteBubble). Same overlay
          gate as the prompt. */}
      {isOpponentOfProposer &&
        myPlayerSeat !== null &&
        surrenderProposerSeat !== null &&
        matchEndData === null &&
        matchAbandonedData === null && (
          <SurrenderOpponentBanner
            proposerUsername={proposerUsername}
            compassPosition={compassOffset(surrenderProposerSeat, myPlayerSeat) as 0 | 1 | 2 | 3}
          />
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
          viewerTeam={viewerTeam}
          onReturnToLobby={handleAbandonReturnToLobby}
        />
      )}

      {/* Next-hand UI is suppressed while the end-of-hand overlay sequence
          (capot animation → score reveal → match result) owns the screen.
          Without this gate the new hand's deal animation + first-bidder
          trump prompt paint behind the score reveal because both layers
          live at z-50; their order in the DOM decides the painted result.
          Holding them off until overlayPhase === "normal" makes the
          end-of-hand summary unambiguously the front overlay, then the
          new-hand prompts surface in sequence as the player dismisses it. */}
      {overlayPhase === "normal" && (
        <>
          {/* Deal animation overlay */}
          {isDealingPhase && <DealAnimation trumpCandidate={gameState.trumpCandidate} />}

          {/* Trump bidding prompt overlay */}
          {isBiddingPhase && (
            <TrumpPrompt
              trumpCandidate={gameState.trumpCandidate}
              biddingRound={gameState.biddingRound}
              isActiveBidder={isActiveBidder}
              onPick={handlePickTrump}
              onPass={handlePassTrump}
              turnExpiresAt={gameState.turnExpiresAt}
              timerDurationSec={gameState.timerDurationSec}
            />
          )}
        </>
      )}

      {/* Reshuffle animation overlay */}
      {showReshuffle && <ReshuffleAnimation onComplete={handleReshuffleComplete} />}

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
          turnExpiresAt={gameState.turnExpiresAt}
          timerDurationSec={gameState.timerDurationSec}
        />
      )}

      {/* Belot prompt overlay */}
      {showBelotPrompt && gameState.trumpSuit && (
        <BelotPrompt
          isKing={belotPromptIsKing}
          trumpSuit={gameState.trumpSuit}
          onAnnounce={handleAnnounceBelot}
          onDecline={handleDeclineBelot}
          turnExpiresAt={gameState.turnExpiresAt}
          timerDurationSec={gameState.timerDurationSec}
        />
      )}

      {/* Declaration resolution reveal — silently consumed while an overlay
          covers the table (D112). The reveal's internal setTimeout still ticks
          via useEffect; gating is render-only by design. */}
      {declarationReveal && !isOverlayActive && (
        <DeclarationReveal
          payload={declarationReveal}
          players={gameState.players}
          viewerTeam={viewerTeam}
          onComplete={handleDeclarationRevealComplete}
        />
      )}

      {/* Belot / Re-belot reveal — same overlay-active gate as the declaration
          reveal. Keyed on payload so back-to-back reveals remount cleanly. */}
      {belotReveal && !isOverlayActive && (
        <BelotReveal
          key={`${belotReveal.playerSeat}-${belotReveal.cardId}`}
          playerSeat={belotReveal.playerSeat}
          myPlayerSeat={myPlayerSeat}
          cardId={belotReveal.cardId}
          isKing={belotReveal.cardId.startsWith("K")}
          players={gameState.players}
          onComplete={handleBelotRevealComplete}
        />
      )}

      {/* Trump-take reveal — center-of-table announcement toast that glows
          in the caller's viewer-relative team color (Gold = Us, Silver = Them)
          and auto-closes after 8 s with an X-with-countdown-ring escape. */}
      {trumpReveal && (
        <TrumpReveal
          key={`${trumpReveal.playerSeat}-${trumpReveal.cardId}`}
          playerSeat={trumpReveal.playerSeat}
          myPlayerSeat={myPlayerSeat}
          cardId={trumpReveal.cardId}
          players={gameState.players}
          onComplete={handleTrumpRevealComplete}
        />
      )}

      {/* Match chat sidebar — collapsible right-edge panel broadcasting to the 4 participants */}
      <MatchChatSidebar isOpen={isChatOpen} onOpenChange={setIsChatOpen} />

      {/* Emote bubbles — one per seat that has an active emote. Suppressed
          when an overlay or pause owns the screen; the store still records
          the latest emote so that re-emergence renders the next live one. */}
      {matchEndData === null &&
        matchAbandonedData === null &&
        gameState.phase !== "paused" &&
        gameState.phase !== "disconnected" &&
        gameState.players.map((player) => {
          const slot = activeEmotes[player.seat as 0 | 1 | 2 | 3];
          if (slot === null) return null;
          const compass = compassOffset(player.seat, myPlayerSeat) as 0 | 1 | 2 | 3;
          return (
            <EmoteBubble
              key={`${player.seat}-${slot.receivedAt}`}
              emote={slot.emote}
              compassPosition={compass}
              onDismiss={() => setActiveEmote(player.seat, null)}
            />
          );
        })}

      {/* Capot animation overlay */}
      {overlayPhase === "capot_animation" &&
        scoreRevealData?.capotTeam !== null &&
        scoreRevealData?.capotTeam !== undefined && (
          <CapotAnimation capotTeam={scoreRevealData.capotTeam} onComplete={handleCapotComplete} />
        )}

      {/* Score reveal overlay */}
      {overlayPhase === "score_reveal" && scoreRevealData !== null && (
        <ScoreReveal
          data={scoreRevealData}
          viewerTeam={viewerTeam}
          onContinue={handleScoreRevealContinue}
          handNumber={gameState.handNumber}
          trumpSuit={gameState.trumpSuit ?? lastTrumpRef.current.suit}
          trumpCallerSeat={gameState.trumpCallerSeat ?? lastTrumpRef.current.callerSeat}
        />
      )}

      {/* Match result overlay */}
      {overlayPhase === "match_result" && matchEndData !== null && (
        <MatchResult
          data={matchEndData}
          viewerTeam={viewerTeam}
          onReturnToLobby={handleReturnToLobby}
          surrenderedByUsername={surrenderedByUsername}
        />
      )}

      {/* Settings + rules dialogs — driven by the bottom-right HUD buttons */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />

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
