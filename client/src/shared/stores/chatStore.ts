import { create } from "zustand";

import type { ChatMessagePayload } from "@/shared/types/wsEvents";

const MAX_MESSAGES = 200;

interface ChatState {
  globalMessages: ChatMessagePayload[];
  appendGlobal: (msg: ChatMessagePayload) => void;
  clearGlobal: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  globalMessages: [],
  appendGlobal: (msg) =>
    set((state) => {
      const next = [...state.globalMessages, msg];
      if (next.length > MAX_MESSAGES) {
        next.splice(0, next.length - MAX_MESSAGES);
      }
      return { globalMessages: next };
    }),
  clearGlobal: () => set({ globalMessages: [] }),
}));
