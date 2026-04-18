import { create } from "zustand";

import type { ChatMessagePayload } from "@/shared/types/wsEvents";

const MAX_MESSAGES = 200;

interface ChatState {
  globalMessages: ChatMessagePayload[];
  matchMessages: ChatMessagePayload[];
  // Monotonic count of match messages received since the last clear.
  // Unlike matchMessages.length (which plateaus at MAX_MESSAGES once the ring
  // buffer is full), this counter keeps incrementing so unread-badge tracking
  // still sees every arrival. Reset to 0 by clearMatch.
  matchMessagesReceivedTotal: number;
  appendGlobal: (msg: ChatMessagePayload) => void;
  appendMatch: (msg: ChatMessagePayload) => void;
  clearGlobal: () => void;
  clearMatch: () => void;
}

function appendWithCap(
  buffer: ChatMessagePayload[],
  msg: ChatMessagePayload,
): ChatMessagePayload[] {
  const next = [...buffer, msg];
  if (next.length > MAX_MESSAGES) {
    next.splice(0, next.length - MAX_MESSAGES);
  }
  return next;
}

export const useChatStore = create<ChatState>((set) => ({
  globalMessages: [],
  matchMessages: [],
  matchMessagesReceivedTotal: 0,
  appendGlobal: (msg) =>
    set((state) => ({ globalMessages: appendWithCap(state.globalMessages, msg) })),
  appendMatch: (msg) =>
    set((state) => ({
      matchMessages: appendWithCap(state.matchMessages, msg),
      matchMessagesReceivedTotal: state.matchMessagesReceivedTotal + 1,
    })),
  clearGlobal: () => set({ globalMessages: [] }),
  clearMatch: () => set({ matchMessages: [], matchMessagesReceivedTotal: 0 }),
}));
