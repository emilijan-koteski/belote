import { create } from "zustand";

import type { GameState } from "@/shared/types/gameTypes";
import type {
  BelotAnnouncedPayload,
  DeclarationsResolvedPayload,
  HandScoredPayload,
  MatchAbandonedPayload,
  MatchEndPayload,
} from "@/shared/types/wsEvents";

interface GameStoreState {
  gameState: GameState | null;
  myPlayerSeat: number | null;
  roomId: number | null;
  isLoading: boolean;
  lastError: string | null;
  declarationReveal: DeclarationsResolvedPayload | null;
  belotReveal: BelotAnnouncedPayload | null;
  scoreRevealData: HandScoredPayload | null;
  matchEndData: MatchEndPayload | null;
  matchAbandonedData: MatchAbandonedPayload | null;

  setGameState: (state: GameState) => void;
  setMyPlayerSeat: (seat: number) => void;
  setLoading: (loading: boolean) => void;
  setLastError: (error: string | null) => void;
  setDeclarationReveal: (payload: DeclarationsResolvedPayload | null) => void;
  setBelotReveal: (payload: BelotAnnouncedPayload | null) => void;
  setScoreRevealData: (data: HandScoredPayload | null) => void;
  setMatchEndData: (data: MatchEndPayload | null) => void;
  setMatchAbandonedData: (data: MatchAbandonedPayload | null) => void;
  clearGame: () => void;
  reset: () => void;
}

// Go JSON serializes nil slices as `null`. Coerce the nullable array fields to
// empty arrays so every consumer can iterate without a null guard.
function normalizeGameState(gs: GameState): GameState {
  return {
    ...gs,
    currentTrick: gs.currentTrick ?? [],
    deck: gs.deck ?? [],
    players: gs.players.map((p) => ({
      ...p,
      hand: p.hand ?? [],
      declarations: p.declarations ?? [],
    })) as GameState["players"],
  };
}

const initialState = {
  gameState: null,
  myPlayerSeat: null,
  roomId: null,
  isLoading: false,
  lastError: null,
  declarationReveal: null,
  belotReveal: null,
  scoreRevealData: null,
  matchEndData: null,
  matchAbandonedData: null,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  setGameState: (gameState) =>
    set({ gameState: normalizeGameState(gameState), roomId: gameState.roomId }),

  setMyPlayerSeat: (myPlayerSeat) => set({ myPlayerSeat }),

  setLoading: (isLoading) => set({ isLoading }),

  setLastError: (lastError) => set({ lastError }),

  setDeclarationReveal: (declarationReveal) => set({ declarationReveal }),

  setBelotReveal: (belotReveal) => set({ belotReveal }),

  setScoreRevealData: (scoreRevealData) => set({ scoreRevealData }),

  setMatchEndData: (matchEndData) => set({ matchEndData }),

  setMatchAbandonedData: (matchAbandonedData) => set({ matchAbandonedData }),

  clearGame: () => set(initialState),

  reset: () => set(initialState),
}));
