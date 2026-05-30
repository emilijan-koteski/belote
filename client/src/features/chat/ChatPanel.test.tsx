import "@/shared/i18n/i18n";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "@/shared/stores/chatStore";
import { ACTION_CHAT_MESSAGE } from "@/shared/types/wsEvents";

import { ChatPanel } from "./ChatPanel";

const mockSendMessage = vi.fn();
let mockConnectionState: "connected" | "connecting" | "authenticating" | "disconnected" =
  "connected";

vi.mock("@/shared/providers/WebSocketContext", () => ({
  useWsSendMessage: () => mockSendMessage,
  useWsConnectionState: () => mockConnectionState,
}));

beforeEach(() => {
  mockSendMessage.mockReset();
  mockConnectionState = "connected";
  useChatStore.setState({
    globalMessages: [],
    matchMessages: [],
    roomMessages: [],
    hasSentGlobal: false,
    hasSentMatch: false,
    hasSentRoom: false,
  });
  // jsdom does not implement scrollIntoView; stub it
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatPanel", () => {
  it("renders the title and empty-state when no messages", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
  });

  it("renders messages from the chatStore", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "hello",
          timestamp: "2026-04-18T10:00:00Z",
          scope: "global",
        },
        {
          userId: 2,
          username: "bob",
          message: "hi alice",
          timestamp: "2026-04-18T10:01:00Z",
          scope: "global",
        },
      ],
    });

    render(<ChatPanel />);
    const rows = screen.getAllByTestId("chat-message-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("alice");
    expect(rows[0]).toHaveTextContent("hello");
    expect(rows[1]).toHaveTextContent("bob");
    expect(rows[1]).toHaveTextContent("hi alice");
  });

  it("sends a chat message with channel=global on Enter when connected", () => {
    render(<ChatPanel />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello world" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(ACTION_CHAT_MESSAGE, {
      channel: "global",
      text: "hello world",
    });
    expect(input.value).toBe("");
  });

  it("sends a chat message via Send button click", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    const sendBtn = screen.getByTestId("chat-send-button");

    fireEvent.change(input, { target: { value: "via button" } });
    fireEvent.click(sendBtn);

    expect(mockSendMessage).toHaveBeenCalledWith(ACTION_CHAT_MESSAGE, {
      channel: "global",
      text: "via button",
    });
  });

  it("trims whitespace and rejects whitespace-only submissions", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).not.toHaveBeenCalled();
    // Send button should be disabled
    const sendBtn = screen.getByTestId("chat-send-button") as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });

  it("disables input and send button when disconnected", () => {
    mockConnectionState = "disconnected";
    render(<ChatPanel />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    const sendBtn = screen.getByTestId("chat-send-button") as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);

    // Even with text, cannot send
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("Shift+Enter does NOT submit (reserved for newline behaviour)", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("uses the initial 'Say hi…' placeholder until the local user sends a message", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    expect(input.placeholder).toBe("Say hi\u2026");
  });

  it("flips to 'Message…' placeholder after a successful send", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.placeholder).toBe("Message\u2026");
  });

  it("latched placeholder survives ring-buffer eviction and unmount", () => {
    // Send once — flag latches.
    const { unmount } = render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.placeholder).toBe("Message\u2026");

    // Flood the buffer with other users' messages (simulates ring-buffer
    // eviction pushing the local user's opener out of the MAX_MESSAGES
    // window). The placeholder must stay flipped because the flag is
    // independent of the messages array.
    act(() =>
      useChatStore.setState({
        globalMessages: Array.from({ length: 250 }, (_, i) => ({
          userId: 1000 + i,
          username: "flood",
          message: `msg-${i}`,
          timestamp: `2026-04-22T10:00:${String(i % 60).padStart(2, "0")}Z`,
          scope: "global" as const,
        })),
      }),
    );
    unmount();

    render(<ChatPanel />);
    const remounted = screen.getByTestId("chat-input") as HTMLInputElement;
    expect(remounted.placeholder).toBe("Message\u2026");
  });

  it("clearGlobal resets the placeholder to 'Say hi…'", () => {
    useChatStore.setState({ hasSentGlobal: true });
    const { rerender } = render(<ChatPanel />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe(
      "Message\u2026",
    );

    act(() => useChatStore.getState().clearGlobal());
    rerender(<ChatPanel />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe("Say hi\u2026");
  });

  it("rejects messages over 500 characters", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;

    // Use fireEvent to set a too-long value (bypassing maxLength)
    const longText = "x".repeat(501);
    fireEvent.change(input, { target: { value: longText } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId("chat-too-long")).toBeInTheDocument();
  });

  it("clear-chat button empties the message list and is disabled when empty", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "hi",
          timestamp: "2026-04-29T10:00:00Z",
          scope: "global",
        },
      ],
    });

    render(<ChatPanel />);
    expect(screen.getAllByTestId("chat-message-row")).toHaveLength(1);

    const clearBtn = screen.getByTestId("chat-clear-button") as HTMLButtonElement;
    expect(clearBtn.disabled).toBe(false);
    act(() => fireEvent.click(clearBtn));

    expect(useChatStore.getState().globalMessages).toEqual([]);
    expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
    expect((screen.getByTestId("chat-clear-button") as HTMLButtonElement).disabled).toBe(true);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("typing /cc and pressing Enter clears chat without sending a network message", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "old",
          timestamp: "2026-04-29T10:00:00Z",
          scope: "global",
        },
      ],
    });

    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "/cc" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().globalMessages).toEqual([]);
    expect(input.value).toBe("");
  });

  it("/cc match is case-insensitive and trims surrounding whitespace", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "old",
          timestamp: "2026-04-29T10:00:00Z",
          scope: "global",
        },
      ],
    });
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "  /CC  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().globalMessages).toEqual([]);
  });

  it("'/cc hello' is sent as a normal message — only the bare command clears", () => {
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "/cc hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledWith(ACTION_CHAT_MESSAGE, {
      channel: "global",
      text: "/cc hello",
    });
  });

  it("clear-chat button operates on the active channel only — other channels untouched", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "global-msg",
          timestamp: "2026-04-29T10:00:00Z",
          scope: "global",
        },
      ],
      matchMessages: [
        {
          userId: 2,
          username: "bob",
          message: "match-msg",
          timestamp: "2026-04-29T10:01:00Z",
          scope: "match",
        },
      ],
      roomMessages: [
        {
          userId: 3,
          username: "carol",
          message: "room-msg",
          timestamp: "2026-04-29T10:02:00Z",
          scope: "room",
        },
      ],
    });

    render(<ChatPanel channel="match" matchId={42} />);
    act(() => fireEvent.click(screen.getByTestId("chat-clear-button")));

    expect(useChatStore.getState().matchMessages).toEqual([]);
    expect(useChatStore.getState().globalMessages).toHaveLength(1);
    expect(useChatStore.getState().roomMessages).toHaveLength(1);
  });

  it("clear-chat button resets the placeholder back to the channel invitation", () => {
    // Latch the post-first-send placeholder, then clear via the button.
    useChatStore.setState({
      hasSentGlobal: true,
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "x",
          timestamp: "2026-04-29T10:00:00Z",
          scope: "global",
        },
      ],
    });
    render(<ChatPanel />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe("Message…");

    act(() => fireEvent.click(screen.getByTestId("chat-clear-button")));
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe("Say hi…");
  });

  it("/cc command resets the placeholder back to 'Say hi…'", () => {
    useChatStore.setState({ hasSentGlobal: true });
    render(<ChatPanel />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    expect(input.placeholder).toBe("Message…");

    fireEvent.change(input, { target: { value: "/cc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.placeholder).toBe("Say hi…");
  });

  it("clear-chat button returns focus to the input so keyboard users don't get stranded", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "x",
          timestamp: "2026-04-29T10:00:00Z",
          scope: "global",
        },
      ],
    });
    render(<ChatPanel />);
    const button = screen.getByTestId("chat-clear-button");
    const input = screen.getByTestId("chat-input");
    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => fireEvent.click(button));
    expect(document.activeElement).toBe(input);
  });
});

describe("ChatPanel (match channel)", () => {
  it("renders messages from chatStore.matchMessages", () => {
    useChatStore.setState({
      matchMessages: [
        {
          userId: 11,
          username: "carol",
          message: "nice trump",
          timestamp: "2026-04-18T12:00:00Z",
          scope: "match",
        },
      ],
    });

    render(<ChatPanel channel="match" matchId={42} />);
    const rows = screen.getAllByTestId("chat-message-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("carol");
    expect(rows[0]).toHaveTextContent("nice trump");
  });

  it("sends action:chat_message with channel=match and matchId", () => {
    render(<ChatPanel channel="match" matchId={42} />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "team chat" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(ACTION_CHAT_MESSAGE, {
      channel: "match",
      matchId: 42,
      text: "team chat",
    });
    expect(input.value).toBe("");
  });

  it("does NOT send when matchId is undefined", () => {
    render(<ChatPanel channel="match" />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "no match id" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("keeps the match-channel placeholder as 'Message…' before and after a send", () => {
    render(<ChatPanel channel="match" matchId={42} />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    expect(input.placeholder).toBe("Message\u2026");
    fireEvent.change(input, { target: { value: "gg" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.placeholder).toBe("Message\u2026");
  });

  it("clearMatch keeps the match placeholder as 'Message…' for a new match", () => {
    useChatStore.setState({ hasSentMatch: true });
    const { rerender } = render(<ChatPanel channel="match" matchId={42} />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe(
      "Message\u2026",
    );
    act(() => useChatStore.getState().clearMatch());
    rerender(<ChatPanel channel="match" matchId={43} />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe(
      "Message\u2026",
    );
  });

  it("does NOT surface globalMessages when channel=match", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "global",
          timestamp: "2026-04-18T10:00:00Z",
          scope: "global",
        },
      ],
      matchMessages: [],
    });

    render(<ChatPanel channel="match" matchId={42} />);
    expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
    expect(screen.queryByText("global")).not.toBeInTheDocument();
  });
});

describe("ChatPanel (room channel)", () => {
  it("renders messages from chatStore.roomMessages", () => {
    useChatStore.setState({
      roomMessages: [
        {
          userId: 11,
          username: "carol",
          message: "taking seat 2",
          timestamp: "2026-04-22T12:00:00Z",
          scope: "room",
        },
      ],
    });

    render(<ChatPanel channel="room" roomId={7} />);
    const rows = screen.getAllByTestId("chat-message-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("carol");
    expect(rows[0]).toHaveTextContent("taking seat 2");
  });

  it("sends action:chat_message with channel=room and roomId", () => {
    render(<ChatPanel channel="room" roomId={7} />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ready when you are" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(ACTION_CHAT_MESSAGE, {
      channel: "room",
      roomId: 7,
      text: "ready when you are",
    });
    expect(input.value).toBe("");
  });

  it("does NOT send when roomId is undefined", () => {
    render(<ChatPanel channel="room" />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "no room id" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("rejects non-positive roomId (0, negative, non-integer)", () => {
    for (const invalid of [0, -1, 1.5, Number.NaN]) {
      mockSendMessage.mockReset();
      const { unmount } = render(<ChatPanel channel="room" roomId={invalid} />);
      const input = screen.getByTestId("chat-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "x" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mockSendMessage).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("flips room-channel placeholder to 'Message…' after a successful send", () => {
    render(<ChatPanel channel="room" roomId={7} />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    expect(input.placeholder).toBe("Message\u2026");
    fireEvent.change(input, { target: { value: "ready" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.placeholder).toBe("Message\u2026");
  });

  it("clearRoom resets the room placeholder — re-joining a room starts fresh", () => {
    useChatStore.setState({ hasSentRoom: true });
    const { rerender } = render(<ChatPanel channel="room" roomId={7} />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe(
      "Message\u2026",
    );
    act(() => useChatStore.getState().clearRoom());
    rerender(<ChatPanel channel="room" roomId={7} />);
    expect((screen.getByTestId("chat-input") as HTMLInputElement).placeholder).toBe(
      "Message\u2026",
    );
  });

  it("does NOT surface globalMessages when channel=room", () => {
    useChatStore.setState({
      globalMessages: [
        {
          userId: 1,
          username: "alice",
          message: "global-only",
          timestamp: "2026-04-22T10:00:00Z",
          scope: "global",
        },
      ],
      roomMessages: [],
    });

    render(<ChatPanel channel="room" roomId={7} />);
    expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
    expect(screen.queryByText("global-only")).not.toBeInTheDocument();
  });
});
