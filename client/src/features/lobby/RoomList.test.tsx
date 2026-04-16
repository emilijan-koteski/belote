import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLobbyStore } from "@/shared/stores/lobbyStore";
import type { Room } from "@/shared/types/apiTypes";
import { QueryWrapper } from "@/test-utils";

import { RoomList } from "./RoomList";

// Mock RoomDetailPreview to avoid API calls
vi.mock("@/features/lobby/RoomDetailPreview", () => ({
  RoomDetailPreview: ({ roomId }: { roomId: number }) => (
    <div data-testid="room-detail-preview">Preview for room {roomId}</div>
  ),
}));

const mockGetRooms = vi.fn();
vi.mock("@/shared/api/rooms", () => ({
  getRooms: (...args: unknown[]) => mockGetRooms(...args),
}));

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    name: "Test Room",
    code: "ABC123",
    ownerId: 5,
    variant: "bitola",
    matchMode: "1001",
    timerStyle: "relaxed",
    timerDurationSeconds: null,
    status: "waiting",
    playerCount: 2,
    isQuickPlay: false,
    createdAt: "2026-04-11T14:00:00Z",
    updatedAt: "2026-04-11T14:00:00Z",
    ...overrides,
  };
}

function renderRoomList(onJoinRoom = vi.fn()) {
  render(
    <QueryWrapper>
      <BrowserRouter>
        <RoomList onJoinRoom={onJoinRoom} />
      </BrowserRouter>
    </QueryWrapper>,
  );
  return { onJoinRoom };
}

afterEach(() => {
  vi.clearAllMocks();
  useLobbyStore.setState({ searchQuery: "" });
});

describe("RoomList", () => {
  it("renders room cards from data", async () => {
    mockGetRooms.mockResolvedValueOnce([
      makeRoom({ id: 1, name: "Room Alpha" }),
      makeRoom({ id: 2, name: "Room Beta" }),
    ]);

    renderRoomList();

    await waitFor(() => {
      const cards = screen.getAllByTestId("room-card");
      expect(cards).toHaveLength(2);
    });
    expect(screen.getByText("Room Alpha")).toBeInTheDocument();
    expect(screen.getByText("Room Beta")).toBeInTheDocument();
  });

  it("filters rooms by name as user types", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([
      makeRoom({ id: 1, name: "Zagreb Ekipa" }),
      makeRoom({ id: 2, name: "Bitola Majstori" }),
    ]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getAllByTestId("room-card")).toHaveLength(2);
    });

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "zagreb");

    const cards = screen.getAllByTestId("room-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Zagreb Ekipa")).toBeInTheDocument();
  });

  it("filters rooms by code", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([
      makeRoom({ id: 1, name: "Room A", code: "XYZ789" }),
      makeRoom({ id: 2, name: "Room B", code: "ABC123" }),
    ]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getAllByTestId("room-card")).toHaveLength(2);
    });

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "xyz");

    const cards = screen.getAllByTestId("room-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Room A")).toBeInTheDocument();
  });

  it("displays empty state when no rooms match search", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([makeRoom({ id: 1, name: "Room A" })]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getAllByTestId("room-card")).toHaveLength(1);
    });

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "nonexistent");

    expect(screen.getByTestId("room-list-empty-search")).toBeInTheDocument();
  });

  it("displays empty state when no rooms exist at all", async () => {
    mockGetRooms.mockResolvedValueOnce([]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getByTestId("room-list-empty")).toBeInTheDocument();
    });
  });

  it("clears search when clear link is clicked", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([makeRoom({ id: 1, name: "Room A" })]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getAllByTestId("room-card")).toHaveLength(1);
    });

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "nonexistent");

    const clearLink = screen.getByTestId("room-list-clear-search");
    await user.click(clearLink);

    expect(screen.getAllByTestId("room-card")).toHaveLength(1);
  });

  it("displays loading skeleton when loading", () => {
    // Return a promise that never resolves to keep loading state
    mockGetRooms.mockReturnValueOnce(new Promise(() => {}));

    renderRoomList();

    expect(screen.getByTestId("room-list-loading")).toBeInTheDocument();
  });

  // --- Accordion behavior ---

  it("expands room detail when clicking a room card", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([makeRoom({ id: 1, name: "Room Alpha" })]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getByTestId("room-card")).toBeInTheDocument();
    });

    // Initially no preview
    expect(screen.queryByTestId("room-detail-preview")).not.toBeInTheDocument();

    // Click the card toggle area
    await user.click(screen.getByTestId("room-card-toggle"));

    // Preview should now be visible
    expect(screen.getByTestId("room-detail-preview")).toBeInTheDocument();
    expect(screen.getByTestId("room-detail-preview")).toHaveTextContent("Preview for room 1");
  });

  it("collapses room detail when clicking the same room card again", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([makeRoom({ id: 1, name: "Room Alpha" })]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getByTestId("room-card")).toBeInTheDocument();
    });

    const toggle = screen.getByTestId("room-card-toggle");

    // First click — expand
    await user.click(toggle);
    expect(screen.getByTestId("room-detail-preview")).toBeInTheDocument();

    // Second click — collapse
    await user.click(toggle);
    expect(screen.queryByTestId("room-detail-preview")).not.toBeInTheDocument();
  });

  it("only one room is expanded at a time (accordion)", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([
      makeRoom({ id: 1, name: "Room Alpha" }),
      makeRoom({ id: 2, name: "Room Beta" }),
    ]);

    renderRoomList();

    await waitFor(() => {
      expect(screen.getAllByTestId("room-card")).toHaveLength(2);
    });

    const toggles = screen.getAllByTestId("room-card-toggle");

    // Expand first room
    await user.click(toggles[0]!);
    expect(screen.getByTestId("room-detail-preview")).toHaveTextContent("Preview for room 1");

    // Expand second room — first should close
    await user.click(toggles[1]!);
    const previews = screen.getAllByTestId("room-detail-preview");
    expect(previews).toHaveLength(1);
    expect(previews[0]!).toHaveTextContent("Preview for room 2");
  });
});
