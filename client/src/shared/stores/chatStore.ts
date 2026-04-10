import { create } from "zustand";

interface ChatState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
}));
