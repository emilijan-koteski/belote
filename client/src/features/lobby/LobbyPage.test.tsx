import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLobbyStore } from "@/shared/stores/lobbyStore";

import { LobbyPage } from "./LobbyPage";

const mockGetRooms = vi.fn();

vi.mock("@/shared/api/rooms", () => ({
  createRoom: vi.fn(),
  getRooms: (...args: unknown[]) => mockGetRooms(...args),
}));

afterEach(() => {
  vi.clearAllMocks();
  useLobbyStore.setState({
    rooms: [],
    isLoading: false,
    searchQuery: "",
  });
});

function renderLobbyPage() {
  render(
    <BrowserRouter>
      <LobbyPage />
    </BrowserRouter>,
  );
}

describe("LobbyPage", () => {
  it("renders play option cards", () => {
    renderLobbyPage();

    expect(screen.getByTestId("quick-play-card")).toBeInTheDocument();
    expect(screen.getByTestId("browse-rooms-card")).toBeInTheDocument();
    expect(screen.getByTestId("create-room-card")).toBeInTheDocument();
  });

  it("opens CreateRoomModal when Create Room card is clicked", async () => {
    const user = userEvent.setup();
    renderLobbyPage();

    const createRoomCard = screen.getByTestId("create-room-card");
    await user.click(createRoomCard);

    expect(screen.getByTestId("room-name-input")).toBeInTheDocument();
  });

  it("switches to browse view when Browse Rooms card is clicked", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([]);
    renderLobbyPage();

    const browseCard = screen.getByTestId("browse-rooms-card");
    await user.click(browseCard);

    await waitFor(() => {
      expect(screen.getByTestId("back-to-options")).toBeInTheDocument();
    });
    expect(screen.getByTestId("room-list-search")).toBeInTheDocument();
    expect(screen.queryByTestId("quick-play-card")).not.toBeInTheDocument();
  });

  it("returns to options view when back button is clicked", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([]);
    renderLobbyPage();

    const browseCard = screen.getByTestId("browse-rooms-card");
    await user.click(browseCard);

    await waitFor(() => {
      expect(screen.getByTestId("back-to-options")).toBeInTheDocument();
    });

    const backButton = screen.getByTestId("back-to-options");
    await user.click(backButton);

    expect(screen.getByTestId("quick-play-card")).toBeInTheDocument();
    expect(screen.getByTestId("browse-rooms-card")).toBeInTheDocument();
    expect(screen.getByTestId("create-room-card")).toBeInTheDocument();
  });

  it("fetches rooms when browse view is activated", async () => {
    const user = userEvent.setup();
    mockGetRooms.mockResolvedValueOnce([]);
    renderLobbyPage();

    const browseCard = screen.getByTestId("browse-rooms-card");
    await user.click(browseCard);

    await waitFor(() => {
      expect(mockGetRooms).toHaveBeenCalledWith("waiting");
    });
  });
});
