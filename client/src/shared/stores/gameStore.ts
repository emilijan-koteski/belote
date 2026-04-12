import { create } from "zustand";

import type { GameState } from "@/shared/types/gameTypes";

interface GameStoreState {
  gameState: GameState | null;
  myPlayerSeat: number | null;
  roomId: number | null;
  isLoading: boolean;

  setGameState: (state: GameState) => void;
  setMyPlayerSeat: (seat: number) => void;
  setLoading: (loading: boolean) => void;
  clearGame: () => void;
  reset: () => void;
}

const initialState = {
  gameState: null,
  myPlayerSeat: null,
  roomId: null,
  isLoading: false,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  setGameState: (gameState) =>
    set({ gameState, roomId: gameState.roomId }),

  setMyPlayerSeat: (myPlayerSeat) => set({ myPlayerSeat }),

  setLoading: (isLoading) => set({ isLoading }),

  clearGame: () => set(initialState),

  reset: () => set(initialState),
}));
