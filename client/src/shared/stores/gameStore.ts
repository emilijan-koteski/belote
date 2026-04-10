import { create } from "zustand";

interface GameState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ isLoading: false }),
}));
