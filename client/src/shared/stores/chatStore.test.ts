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
    useChatStore.setState({
      globalMessages: [],
      matchMessages: [],
      roomMessages: [],
      matchMessagesReceivedTotal: 0,
    });
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

  it("appendMatch adds a message to the match partition", () => {
    useChatStore.getState().appendMatch(makeMessage({ scope: "match", message: "team1" }));
    useChatStore.getState().appendMatch(makeMessage({ scope: "match", message: "team2" }));

    const messages = useChatStore.getState().matchMessages;
    expect(messages).toHaveLength(2);
    expect(messages[1]!.message).toBe("team2");
  });

  it("appendMatch drops oldest when exceeding 200-message cap", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendMatch(makeMessage({ scope: "match", message: `m-${i}` }));
    }

    const messages = useChatStore.getState().matchMessages;
    expect(messages).toHaveLength(200);
    expect(messages[0]!.message).toBe("m-10");
    expect(messages[199]!.message).toBe("m-209");
  });

  it("clearMatch resets only the match partition", () => {
    useChatStore.getState().appendGlobal(makeMessage());
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    expect(useChatStore.getState().globalMessages).toHaveLength(1);
    expect(useChatStore.getState().matchMessages).toHaveLength(1);

    useChatStore.getState().clearMatch();
    expect(useChatStore.getState().matchMessages).toHaveLength(0);
    expect(useChatStore.getState().globalMessages).toHaveLength(1);
  });

  it("partitions are independent: appendGlobal does not touch matchMessages", () => {
    useChatStore.getState().appendGlobal(makeMessage());
    expect(useChatStore.getState().matchMessages).toHaveLength(0);
  });

  it("partitions are independent: appendMatch does not touch globalMessages", () => {
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    expect(useChatStore.getState().globalMessages).toHaveLength(0);
  });

  it("appendMatch increments matchMessagesReceivedTotal monotonically, even past the 200 cap", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendMatch(makeMessage({ scope: "match", message: `t-${i}` }));
    }

    const state = useChatStore.getState();
    expect(state.matchMessages).toHaveLength(200);
    // Length is capped but the monotonic counter keeps growing — required for
    // the sidebar's unread badge to stay accurate after the ring buffer fills.
    expect(state.matchMessagesReceivedTotal).toBe(210);
  });

  it("clearMatch resets matchMessagesReceivedTotal to 0", () => {
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    expect(useChatStore.getState().matchMessagesReceivedTotal).toBe(2);

    useChatStore.getState().clearMatch();
    expect(useChatStore.getState().matchMessagesReceivedTotal).toBe(0);
  });

  it("appendGlobal does NOT affect matchMessagesReceivedTotal", () => {
    useChatStore.getState().appendGlobal(makeMessage());
    expect(useChatStore.getState().matchMessagesReceivedTotal).toBe(0);
  });

  // --- Room partition ---

  it("appendRoom adds a message to the room partition", () => {
    useChatStore.getState().appendRoom(makeMessage({ scope: "room", message: "r1" }));
    useChatStore.getState().appendRoom(makeMessage({ scope: "room", message: "r2" }));

    const messages = useChatStore.getState().roomMessages;
    expect(messages).toHaveLength(2);
    expect(messages[1]!.message).toBe("r2");
  });

  it("appendRoom drops oldest when exceeding 200-message cap", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendRoom(makeMessage({ scope: "room", message: `r-${i}` }));
    }

    const messages = useChatStore.getState().roomMessages;
    expect(messages).toHaveLength(200);
    expect(messages[0]!.message).toBe("r-10");
    expect(messages[199]!.message).toBe("r-209");
  });

  it("clearRoom resets only the room partition", () => {
    useChatStore.getState().appendGlobal(makeMessage());
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    useChatStore.getState().appendRoom(makeMessage({ scope: "room" }));

    useChatStore.getState().clearRoom();
    const state = useChatStore.getState();
    expect(state.roomMessages).toHaveLength(0);
    expect(state.globalMessages).toHaveLength(1);
    expect(state.matchMessages).toHaveLength(1);
  });

  it("partitions are independent: appendRoom does not touch global or match", () => {
    useChatStore.getState().appendRoom(makeMessage({ scope: "room" }));
    expect(useChatStore.getState().globalMessages).toHaveLength(0);
    expect(useChatStore.getState().matchMessages).toHaveLength(0);
  });

  it("appendRoom does NOT affect matchMessagesReceivedTotal", () => {
    useChatStore.getState().appendRoom(makeMessage({ scope: "room" }));
    expect(useChatStore.getState().matchMessagesReceivedTotal).toBe(0);
  });
});
