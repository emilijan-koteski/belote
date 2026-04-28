import { create } from "zustand";

import type { GameState } from "@/shared/types/gameTypes";
import type {
  BelotAnnouncedPayload,
  DeclarationsResolvedPayload,
  EmoteID,
  HandScoredPayload,
  MatchAbandonedPayload,
  MatchEndPayload,
  SurrenderDeclinedPayload,
  SurrenderProposedPayload,
  TrumpSelectedPayload,
} from "@/shared/types/wsEvents";

// Per-seat ephemeral emote slot. The receivedAt stamp doubles as a remount
// key so a second emote on the same seat replaces the first cleanly.
export interface ActiveEmote {
  emote: EmoteID;
  receivedAt: number;
}

export type ActiveEmotesMap = Record<0 | 1 | 2 | 3, ActiveEmote | null>;

interface GameStoreState {
  gameState: GameState | null;
  myPlayerSeat: number | null;
  roomId: number | null;
  isLoading: boolean;
  lastError: string | null;
  declarationReveal: DeclarationsResolvedPayload | null;
  belotReveal: BelotAnnouncedPayload | null;
  trumpReveal: TrumpSelectedPayload | null;
  scoreRevealData: HandScoredPayload | null;
  matchEndData: MatchEndPayload | null;
  matchAbandonedData: MatchAbandonedPayload | null;
  surrenderProposed: SurrenderProposedPayload | null;
  surrenderDeclined: SurrenderDeclinedPayload | null;
  activeEmotes: ActiveEmotesMap;

  setGameState: (state: GameState) => void;
  setMyPlayerSeat: (seat: number) => void;
  setLoading: (loading: boolean) => void;
  setLastError: (error: string | null) => void;
  setDeclarationReveal: (payload: DeclarationsResolvedPayload | null) => void;
  setBelotReveal: (payload: BelotAnnouncedPayload | null) => void;
  setTrumpReveal: (payload: TrumpSelectedPayload | null) => void;
  setScoreRevealData: (data: HandScoredPayload | null) => void;
  setMatchEndData: (data: MatchEndPayload | null) => void;
  setMatchAbandonedData: (data: MatchAbandonedPayload | null) => void;
  setSurrenderProposed: (payload: SurrenderProposedPayload | null) => void;
  setSurrenderDeclined: (payload: SurrenderDeclinedPayload | null) => void;
  setActiveEmote: (seat: number, emote: EmoteID | null) => void;
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
  trumpReveal: null,
  scoreRevealData: null,
  matchEndData: null,
  matchAbandonedData: null,
  surrenderProposed: null,
  surrenderDeclined: null,
  activeEmotes: { 0: null, 1: null, 2: null, 3: null } as ActiveEmotesMap,
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

  setTrumpReveal: (trumpReveal) => set({ trumpReveal }),

  setScoreRevealData: (scoreRevealData) => set({ scoreRevealData }),

  setMatchEndData: (matchEndData) => set({ matchEndData }),

  setMatchAbandonedData: (matchAbandonedData) => set({ matchAbandonedData }),

  setSurrenderProposed: (surrenderProposed) => set({ surrenderProposed }),

  setSurrenderDeclined: (surrenderDeclined) => set({ surrenderDeclined }),

  setActiveEmote: (seat, emote) =>
    set((state) => {
      // Defensive: out-of-range seat is a noop. The dispatcher already
      // validates this server payload, but the setter must not corrupt the
      // map shape if a test or stray caller passes a bad index.
      if (seat !== 0 && seat !== 1 && seat !== 2 && seat !== 3) return state;
      const slot = seat as 0 | 1 | 2 | 3;
      const next: ActiveEmote | null = emote === null ? null : { emote, receivedAt: Date.now() };
      return {
        activeEmotes: { ...state.activeEmotes, [slot]: next } as ActiveEmotesMap,
      };
    }),

  clearGame: () => set(initialState),

  reset: () => set(initialState),
}));
