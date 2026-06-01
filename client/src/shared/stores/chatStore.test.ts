import { beforeEach, describe, expect, it } from "vitest";

import type { ChatMessagePayload } from "@/shared/types/wsEvents";

import { useChatStore } from "./chatStore";

function makeMessage(overrides: Partial<ChatMessagePayload> = {}): ChatMessagePayload {
  return {
    userId: 1,
    username: "alice",
    message: "hello",
    timestamp: "2026-04-18T10:00:00Z",
    scope: "lobby",
    ...overrides,
  };
}

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      lobbyMessages: [],
      matchMessages: [],
      roomMessages: [],
      matchMessagesReceivedTotal: 0,
      hasSentLobby: false,
      hasSentMatch: false,
      hasSentRoom: false,
    });
  });

  it("appendLobby adds a message to the end of the list", () => {
    useChatStore.getState().appendLobby(makeMessage({ message: "first" }));
    useChatStore.getState().appendLobby(makeMessage({ message: "second" }));

    const messages = useChatStore.getState().lobbyMessages;
    expect(messages).toHaveLength(2);
    expect(messages[0]!.message).toBe("first");
    expect(messages[1]!.message).toBe("second");
  });

  it("appendLobby drops oldest when exceeding 200-message cap", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendLobby(makeMessage({ message: `msg-${i}` }));
    }

    const messages = useChatStore.getState().lobbyMessages;
    expect(messages).toHaveLength(200);
    expect(messages[0]!.message).toBe("msg-10");
    expect(messages[199]!.message).toBe("msg-209");
  });

  it("clearLobby resets the message list", () => {
    useChatStore.getState().appendLobby(makeMessage());
    useChatStore.getState().appendLobby(makeMessage());
    expect(useChatStore.getState().lobbyMessages).toHaveLength(2);

    useChatStore.getState().clearLobby();
    expect(useChatStore.getState().lobbyMessages).toHaveLength(0);
  });

  it("appendLobby produces a new array reference (immutable updates)", () => {
    const before = useChatStore.getState().lobbyMessages;
    useChatStore.getState().appendLobby(makeMessage());
    const after = useChatStore.getState().lobbyMessages;
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
    useChatStore.getState().appendLobby(makeMessage());
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    expect(useChatStore.getState().lobbyMessages).toHaveLength(1);
    expect(useChatStore.getState().matchMessages).toHaveLength(1);

    useChatStore.getState().clearMatch();
    expect(useChatStore.getState().matchMessages).toHaveLength(0);
    expect(useChatStore.getState().lobbyMessages).toHaveLength(1);
  });

  it("partitions are independent: appendLobby does not touch matchMessages", () => {
    useChatStore.getState().appendLobby(makeMessage());
    expect(useChatStore.getState().matchMessages).toHaveLength(0);
  });

  it("partitions are independent: appendMatch does not touch lobbyMessages", () => {
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    expect(useChatStore.getState().lobbyMessages).toHaveLength(0);
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

  it("appendLobby does NOT affect matchMessagesReceivedTotal", () => {
    useChatStore.getState().appendLobby(makeMessage());
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
    useChatStore.getState().appendLobby(makeMessage());
    useChatStore.getState().appendMatch(makeMessage({ scope: "match" }));
    useChatStore.getState().appendRoom(makeMessage({ scope: "room" }));

    useChatStore.getState().clearRoom();
    const state = useChatStore.getState();
    expect(state.roomMessages).toHaveLength(0);
    expect(state.lobbyMessages).toHaveLength(1);
    expect(state.matchMessages).toHaveLength(1);
  });

  it("partitions are independent: appendRoom does not touch global or match", () => {
    useChatStore.getState().appendRoom(makeMessage({ scope: "room" }));
    expect(useChatStore.getState().lobbyMessages).toHaveLength(0);
    expect(useChatStore.getState().matchMessages).toHaveLength(0);
  });

  it("appendRoom does NOT affect matchMessagesReceivedTotal", () => {
    useChatStore.getState().appendRoom(makeMessage({ scope: "room" }));
    expect(useChatStore.getState().matchMessagesReceivedTotal).toBe(0);
  });

  // --- hasSent* placeholder flags ---

  it("markSent flags are independent across channels", () => {
    useChatStore.getState().markSentLobby();
    let state = useChatStore.getState();
    expect(state.hasSentLobby).toBe(true);
    expect(state.hasSentMatch).toBe(false);
    expect(state.hasSentRoom).toBe(false);

    useChatStore.getState().markSentMatch();
    useChatStore.getState().markSentRoom();
    state = useChatStore.getState();
    expect(state.hasSentMatch).toBe(true);
    expect(state.hasSentRoom).toBe(true);
  });

  it("clear* resets the matching hasSent flag", () => {
    useChatStore.setState({ hasSentLobby: true, hasSentMatch: true, hasSentRoom: true });

    useChatStore.getState().clearLobby();
    expect(useChatStore.getState().hasSentLobby).toBe(false);
    expect(useChatStore.getState().hasSentMatch).toBe(true);
    expect(useChatStore.getState().hasSentRoom).toBe(true);

    useChatStore.getState().clearMatch();
    expect(useChatStore.getState().hasSentMatch).toBe(false);
    expect(useChatStore.getState().hasSentRoom).toBe(true);

    useChatStore.getState().clearRoom();
    expect(useChatStore.getState().hasSentRoom).toBe(false);
  });
});
