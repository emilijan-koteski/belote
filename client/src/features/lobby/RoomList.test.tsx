import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { useLobbyStore } from "@/shared/stores/lobbyStore";
import type { Room } from "@/shared/types/apiTypes";

import { RoomList } from "./RoomList";

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
    createdAt: "2026-04-11T14:00:00Z",
    updatedAt: "2026-04-11T14:00:00Z",
    ...overrides,
  };
}

function renderRoomList() {
  render(
    <BrowserRouter>
      <RoomList />
    </BrowserRouter>,
  );
}

afterEach(() => {
  useLobbyStore.setState({
    rooms: [],
    isLoading: false,
    searchQuery: "",
  });
});

describe("RoomList", () => {
  it("renders room cards from data", () => {
    useLobbyStore.setState({
      rooms: [
        makeRoom({ id: 1, name: "Room Alpha" }),
        makeRoom({ id: 2, name: "Room Beta" }),
      ],
    });

    renderRoomList();

    const cards = screen.getAllByTestId("room-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Room Alpha")).toBeInTheDocument();
    expect(screen.getByText("Room Beta")).toBeInTheDocument();
  });

  it("filters rooms by name as user types", async () => {
    const user = userEvent.setup();
    useLobbyStore.setState({
      rooms: [
        makeRoom({ id: 1, name: "Zagreb Ekipa" }),
        makeRoom({ id: 2, name: "Bitola Majstori" }),
      ],
    });

    renderRoomList();

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "zagreb");

    const cards = screen.getAllByTestId("room-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Zagreb Ekipa")).toBeInTheDocument();
  });

  it("filters rooms by code", async () => {
    const user = userEvent.setup();
    useLobbyStore.setState({
      rooms: [
        makeRoom({ id: 1, name: "Room A", code: "XYZ789" }),
        makeRoom({ id: 2, name: "Room B", code: "ABC123" }),
      ],
    });

    renderRoomList();

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "xyz");

    const cards = screen.getAllByTestId("room-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Room A")).toBeInTheDocument();
  });

  it("displays empty state when no rooms match search", async () => {
    const user = userEvent.setup();
    useLobbyStore.setState({
      rooms: [makeRoom({ id: 1, name: "Room A" })],
    });

    renderRoomList();

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "nonexistent");

    expect(screen.getByTestId("room-list-empty-search")).toBeInTheDocument();
  });

  it("displays empty state when no rooms exist at all", () => {
    useLobbyStore.setState({ rooms: [] });

    renderRoomList();

    expect(screen.getByTestId("room-list-empty")).toBeInTheDocument();
  });

  it("clears search when clear link is clicked", async () => {
    const user = userEvent.setup();
    useLobbyStore.setState({
      rooms: [makeRoom({ id: 1, name: "Room A" })],
    });

    renderRoomList();

    const searchInput = screen.getByTestId("room-list-search");
    await user.type(searchInput, "nonexistent");

    const clearLink = screen.getByTestId("room-list-clear-search");
    await user.click(clearLink);

    expect(screen.getAllByTestId("room-card")).toHaveLength(1);
  });

  it("displays loading skeleton when loading", () => {
    useLobbyStore.setState({ isLoading: true });

    renderRoomList();

    expect(screen.getByTestId("room-list-loading")).toBeInTheDocument();
  });
});
