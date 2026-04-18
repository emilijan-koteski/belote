import "@/shared/i18n/i18n";

import { fireEvent, render, screen } from "@testing-library/react";
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
  useChatStore.setState({ globalMessages: [], matchMessages: [] });
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
