import { create } from "zustand";

interface LobbyState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
}));
