import { create } from "zustand";

import type { ChatMessagePayload } from "@/shared/types/wsEvents";

const MAX_MESSAGES = 200;

interface ChatState {
  globalMessages: ChatMessagePayload[];
  matchMessages: ChatMessagePayload[];
  roomMessages: ChatMessagePayload[];
  // Monotonic count of match messages received since the last clear.
  // Unlike matchMessages.length (which plateaus at MAX_MESSAGES once the ring
  // buffer is full), this counter keeps incrementing so unread-badge tracking
  // still sees every arrival. Reset to 0 by clearMatch.
  matchMessagesReceivedTotal: number;
  // Whether the local user has sent at least one message in each channel
  // since the channel was last cleared. Tracked explicitly (rather than
  // derived from messages) so it latches through ring-buffer eviction — a
  // busy global lobby can push the user's first message out of the
  // MAX_MESSAGES window, but the placeholder should still reflect "already
  // chatted". Reset by the corresponding clear* action so a new match or
  // room gets a fresh invitation placeholder.
  hasSentGlobal: boolean;
  hasSentMatch: boolean;
  hasSentRoom: boolean;
  appendGlobal: (msg: ChatMessagePayload) => void;
  appendMatch: (msg: ChatMessagePayload) => void;
  appendRoom: (msg: ChatMessagePayload) => void;
  markSentGlobal: () => void;
  markSentMatch: () => void;
  markSentRoom: () => void;
  clearGlobal: () => void;
  clearMatch: () => void;
  clearRoom: () => void;
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
  roomMessages: [],
  matchMessagesReceivedTotal: 0,
  hasSentGlobal: false,
  hasSentMatch: false,
  hasSentRoom: false,
  appendGlobal: (msg) =>
    set((state) => ({ globalMessages: appendWithCap(state.globalMessages, msg) })),
  appendMatch: (msg) =>
    set((state) => ({
      matchMessages: appendWithCap(state.matchMessages, msg),
      matchMessagesReceivedTotal: state.matchMessagesReceivedTotal + 1,
    })),
  appendRoom: (msg) => set((state) => ({ roomMessages: appendWithCap(state.roomMessages, msg) })),
  markSentGlobal: () => set({ hasSentGlobal: true }),
  markSentMatch: () => set({ hasSentMatch: true }),
  markSentRoom: () => set({ hasSentRoom: true }),
  clearGlobal: () => set({ globalMessages: [], hasSentGlobal: false }),
  clearMatch: () => set({ matchMessages: [], matchMessagesReceivedTotal: 0, hasSentMatch: false }),
  clearRoom: () => set({ roomMessages: [], hasSentRoom: false }),
}));
