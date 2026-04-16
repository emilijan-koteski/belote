import { create } from "zustand";

interface LobbyState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
