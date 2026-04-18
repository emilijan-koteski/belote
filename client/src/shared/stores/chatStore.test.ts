import { beforeEach, describe, expect, it } from "vitest";

import type { ChatMessagePayload } from "@/shared/types/wsEvents";

import { useChatStore } from "./chatStore";

function makeMessage(overrides: Partial<ChatMessagePayload> = {}): ChatMessagePayload {
  return {
    userId: 1,
    username: "alice",
    message: "hello",
    timestamp: "2026-04-18T10:00:00Z",
    scope: "global",
    ...overrides,
  };
}

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({ globalMessages: [] });
  });

  it("appendGlobal adds a message to the end of the list", () => {
    useChatStore.getState().appendGlobal(makeMessage({ message: "first" }));
    useChatStore.getState().appendGlobal(makeMessage({ message: "second" }));

    const messages = useChatStore.getState().globalMessages;
    expect(messages).toHaveLength(2);
    expect(messages[0]!.message).toBe("first");
    expect(messages[1]!.message).toBe("second");
  });

  it("appendGlobal drops oldest when exceeding 200-message cap", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendGlobal(makeMessage({ message: `msg-${i}` }));
    }

    const messages = useChatStore.getState().globalMessages;
    expect(messages).toHaveLength(200);
    expect(messages[0]!.message).toBe("msg-10");
    expect(messages[199]!.message).toBe("msg-209");
  });

  it("clearGlobal resets the message list", () => {
    useChatStore.getState().appendGlobal(makeMessage());
    useChatStore.getState().appendGlobal(makeMessage());
    expect(useChatStore.getState().globalMessages).toHaveLength(2);

    useChatStore.getState().clearGlobal();
    expect(useChatStore.getState().globalMessages).toHaveLength(0);
  });

  it("appendGlobal produces a new array reference (immutable updates)", () => {
    const before = useChatStore.getState().globalMessages;
    useChatStore.getState().appendGlobal(makeMessage());
    const after = useChatStore.getState().globalMessages;
    expect(after).not.toBe(before);
  });
});
