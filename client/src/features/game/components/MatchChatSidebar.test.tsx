import "@/shared/i18n/i18n";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "@/shared/stores/chatStore";
import { useGameStore } from "@/shared/stores/gameStore";
import type { ChatMessagePayload } from "@/shared/types/wsEvents";

import { MatchChatSidebar } from "./MatchChatSidebar";

const mockSendMessage = vi.fn();
let mockConnectionState: "connected" | "connecting" | "authenticating" | "disconnected" =
  "connected";

vi.mock("@/shared/providers/WebSocketContext", () => ({
  useWsSendMessage: () => mockSendMessage,
  useWsConnectionState: () => mockConnectionState,
}));

function makeMatchMessage(overrides: Partial<ChatMessagePayload> = {}): ChatMessagePayload {
  return {
    userId: 1,
    username: "alice",
    message: "hi team",
    timestamp: "2026-04-18T12:00:00Z",
    scope: "match",
    ...overrides,
  };
}

beforeEach(() => {
  mockSendMessage.mockReset();
  mockConnectionState = "connected";
  useChatStore.setState({
    globalMessages: [],
    matchMessages: [],
    matchMessagesReceivedTotal: 0,
  });
  useGameStore.setState({ roomId: 42 });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  useGameStore.setState({ roomId: null });
});

describe("MatchChatSidebar", () => {
  it("renders the toggle button when roomId is set", () => {
    render(<MatchChatSidebar />);
    expect(screen.getByTestId("match-chat-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("match-chat-sidebar")).not.toBeInTheDocument();
  });

  it("does NOT render anything when roomId is null", () => {
    act(() => {
      useGameStore.setState({ roomId: null });
    });
    const { container } = render(<MatchChatSidebar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("toggles the sidebar open/closed on click", () => {
    render(<MatchChatSidebar />);
    const toggle = screen.getByTestId("match-chat-toggle");

    fireEvent.click(toggle);
    expect(screen.getByTestId("match-chat-sidebar")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByTestId("match-chat-sidebar")).not.toBeInTheDocument();
  });

  it("increments unread badge when new match messages arrive while closed", () => {
    render(<MatchChatSidebar />);

    act(() => {
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "m1" }));
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "m2" }));
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "m3" }));
    });

    expect(screen.getByTestId("match-chat-toggle-unread")).toHaveTextContent("3");
  });

  it("resets unread count to 0 when the sidebar is opened", () => {
    render(<MatchChatSidebar />);

    act(() => {
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "m1" }));
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "m2" }));
    });
    expect(screen.getByTestId("match-chat-toggle-unread")).toHaveTextContent("2");

    fireEvent.click(screen.getByTestId("match-chat-toggle"));
    expect(screen.queryByTestId("match-chat-toggle-unread")).not.toBeInTheDocument();
  });

  it("does NOT increment unread badge when messages arrive while sidebar is open", () => {
    render(<MatchChatSidebar />);
    fireEvent.click(screen.getByTestId("match-chat-toggle"));

    act(() => {
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "while-open" }));
    });

    // No badge visible
    expect(screen.queryByTestId("match-chat-toggle-unread")).not.toBeInTheDocument();
  });

  it("caps the unread badge at 99+ when more than 99 messages arrive", () => {
    render(<MatchChatSidebar />);

    act(() => {
      for (let i = 0; i < 120; i++) {
        useChatStore.getState().appendMatch(makeMatchMessage({ message: `m-${i}` }));
      }
    });

    expect(screen.getByTestId("match-chat-toggle-unread")).toHaveTextContent("99+");
  });

  it("keeps incrementing the unread badge after matchMessages hits the 200-message cap", () => {
    render(<MatchChatSidebar />);

    // Fill past the ring-buffer cap — matchMessages.length plateaus at 200
    // but the monotonic counter keeps growing, so unread tracking must
    // follow the counter, not the length.
    act(() => {
      for (let i = 0; i < 205; i++) {
        useChatStore.getState().appendMatch(makeMatchMessage({ message: `m-${i}` }));
      }
    });

    expect(useChatStore.getState().matchMessages).toHaveLength(200);
    expect(useChatStore.getState().matchMessagesReceivedTotal).toBe(205);

    // Badge must reflect every arrival, including those beyond the cap.
    expect(screen.getByTestId("match-chat-toggle-unread")).toHaveTextContent("99+");
  });

  it("resets the unread badge when matchMessages is cleared while the sidebar is closed", () => {
    render(<MatchChatSidebar />);

    act(() => {
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "pre-clear" }));
      useChatStore.getState().appendMatch(makeMatchMessage({ message: "pre-clear-2" }));
    });
    expect(screen.getByTestId("match-chat-toggle-unread")).toHaveTextContent("2");

    // Simulate a match teardown: clearMatch while sidebar is still closed.
    // The badge must drop to 0 — no phantom unread for a cleared history.
    act(() => {
      useChatStore.getState().clearMatch();
    });

    expect(screen.queryByTestId("match-chat-toggle-unread")).not.toBeInTheDocument();
  });

  it("renders match messages inside the opened sidebar", () => {
    render(<MatchChatSidebar />);
    act(() => {
      useChatStore.setState({
        matchMessages: [makeMatchMessage({ userId: 2, username: "bob", message: "nice play" })],
      });
    });
    fireEvent.click(screen.getByTestId("match-chat-toggle"));

    const rows = screen.getAllByTestId("chat-message-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("bob");
    expect(rows[0]).toHaveTextContent("nice play");
  });
});
