import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FetchError } from "@/shared/api/fetchClient";
import { useAuthStore } from "@/shared/stores/authStore";

import { RoomLobby } from "./RoomLobby";

// Mock react-router useParams and useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useParams: () => ({ id: "1" }),
    useNavigate: () => mockNavigate,
  };
});

// Mock API
vi.mock("@/shared/api/rooms", () => ({
  getRoom: vi.fn(),
  leaveRoom: vi.fn(),
  selectSeat: vi.fn(),
  startGame: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

import { getRoom, leaveRoom, selectSeat, startGame } from "@/shared/api/rooms";

const mockGetRoom = vi.mocked(getRoom);
const mockLeaveRoom = vi.mocked(leaveRoom);
const mockSelectSeat = vi.mocked(selectSeat);
const mockStartGame = vi.mocked(startGame);

function renderRoomLobby() {
  render(
    <BrowserRouter>
      <RoomLobby />
    </BrowserRouter>,
  );
}

const defaultRoom = {
  id: 1,
  name: "Test Room",
  code: "XYZ123",
  ownerId: 10,
  variant: "bitola",
  matchMode: "1001",
  timerStyle: "relaxed",
  timerDurationSeconds: null,
  status: "waiting",
  playerCount: 2,
  createdAt: "",
  updatedAt: "",
};

const defaultUser = {
  id: 10,
  username: "alice",
  email: "a@b.com",
  languagePreference: "en",
  createdAt: "",
};

beforeEach(() => {
  mockLeaveRoom.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, token: null });
});

describe("RoomLobby", () => {
  it("renders room name and configuration", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("Test Room")).toBeInTheDocument();
    });

    expect(screen.getByTestId("room-lobby")).toBeInTheDocument();
    expect(screen.getByText(/Bitola/)).toBeInTheDocument();
    expect(screen.getByText(/1001 pts/)).toBeInTheDocument();
    expect(screen.getByText(/Relaxed/)).toBeInTheDocument();
  });

  it("displays occupied seats with player usernames", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });

    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("displays empty seats with Waiting text", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });

    const waitingTexts = screen.getAllByText("Waiting...");
    expect(waitingTexts).toHaveLength(3);
  });

  it("highlights current user seat with You indicator", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("You")).toBeInTheDocument();
    });
  });

  it("calls clipboard API on copy link click", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("copy-link")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("copy-link"));

    expect(writeTextMock).toHaveBeenCalledWith("XYZ123");
    expect(toast.success).toHaveBeenCalled();
  });

  it("calls leaveRoom and navigates to lobby on leave click", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockLeaveRoom.mockResolvedValue(undefined);

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("leave-room")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("leave-room"));

    expect(mockLeaveRoom).toHaveBeenCalledWith(1);
    expect(mockNavigate).toHaveBeenCalledWith("/lobby");
  });

  it("displays loading skeleton while fetching", () => {
    mockGetRoom.mockReturnValue(new Promise(() => {})); // never resolves

    renderRoomLobby();

    expect(screen.getByTestId("room-lobby-loading")).toBeInTheDocument();
  });

  it("displays error state for non-existent room", async () => {
    mockGetRoom.mockRejectedValue(new Error("not found"));

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("room-lobby-error")).toBeInTheDocument();
    });

    expect(screen.getByText("Room not found")).toBeInTheDocument();
  });

  // --- Team color indicators ---

  it("renders Red Team and Blue Team labels", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("Red Team")).toBeInTheDocument();
    });
    expect(screen.getByText("Blue Team")).toBeInTheDocument();
  });

  // --- Seat selection ---

  it("calls selectSeat API when clicking an empty seat", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: null, team: null, createdAt: "" },
      ],
    });

    mockSelectSeat.mockResolvedValue({
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("player-seat-1")).toBeInTheDocument();
    });

    // Seat 1 is empty — click it
    await user.click(screen.getByTestId("player-seat-1"));

    expect(mockSelectSeat).toHaveBeenCalledWith(1, 1);
  });

  it("does not call selectSeat when clicking seat occupied by another player", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("bob")).toBeInTheDocument();
    });

    // Seat 1 is occupied by bob — should be disabled
    await user.click(screen.getByTestId("player-seat-1"));

    expect(mockSelectSeat).not.toHaveBeenCalled();
  });

  it("calls selectSeat when clicking own occupied seat (for switching)", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    mockSelectSeat.mockResolvedValue({
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 1, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });

    // Click empty seat 1 to switch
    await user.click(screen.getByTestId("player-seat-1"));

    expect(mockSelectSeat).toHaveBeenCalledWith(1, 1);
  });

  it("shows toast when seat selection fails", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
      ],
    });

    mockSelectSeat.mockRejectedValue(new FetchError(409, "SEAT_TAKEN", "seat is taken"));

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("player-seat-1")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("player-seat-1"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // --- Start Game ---

  it("renders Start Game button for room owner", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 4 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
        { id: 3, roomId: 1, userId: 30, username: "carol", seat: 2, team: "red", createdAt: "" },
        { id: 4, roomId: 1, userId: 40, username: "dave", seat: 3, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("start-game")).toBeInTheDocument();
    });

    expect(screen.getByTestId("start-game")).toBeEnabled();
  });

  it("renders disabled Start Game button when fewer than 4 players seated", async () => {
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: null, team: null, createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("start-game")).toBeInTheDocument();
    });

    expect(screen.getByTestId("start-game")).toBeDisabled();
  });

  it("calls startGame API and navigates on success", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 4 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
        { id: 3, roomId: 1, userId: 30, username: "carol", seat: 2, team: "red", createdAt: "" },
        { id: 4, roomId: 1, userId: 40, username: "dave", seat: 3, team: "blue", createdAt: "" },
      ],
    });

    mockStartGame.mockResolvedValue({
      ...defaultRoom,
      status: "in_progress",
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("start-game")).toBeEnabled();
    });

    await user.click(screen.getByTestId("start-game"));

    expect(mockStartGame).toHaveBeenCalledWith(1);
    expect(mockNavigate).toHaveBeenCalledWith("/game/1");
  });

  it("renders waiting message for non-owner when 4 players seated", async () => {
    useAuthStore.setState({
      user: { id: 20, username: "bob", email: "b@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 4 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
        { id: 3, roomId: 1, userId: 30, username: "carol", seat: 2, team: "red", createdAt: "" },
        { id: 4, roomId: 1, userId: 40, username: "dave", seat: 3, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("waiting-for-start")).toBeInTheDocument();
    });

    expect(screen.getByText(/Waiting for alice to start/)).toBeInTheDocument();
    expect(screen.queryByTestId("start-game")).not.toBeInTheDocument();
  });

  it("does not render Start Game button for non-owner", async () => {
    useAuthStore.setState({
      user: { id: 20, username: "bob", email: "b@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("bob")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("start-game")).not.toBeInTheDocument();
  });

  it("shows toast when game start fails", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: defaultUser, token: "tok" });

    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 4 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: 0, team: "red", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: 1, team: "blue", createdAt: "" },
        { id: 3, roomId: 1, userId: 30, username: "carol", seat: 2, team: "red", createdAt: "" },
        { id: 4, roomId: 1, userId: 40, username: "dave", seat: 3, team: "blue", createdAt: "" },
      ],
    });

    mockStartGame.mockRejectedValue(new FetchError(400, "NOT_ALL_SEATED", "not all seated"));

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByTestId("start-game")).toBeEnabled();
    });

    await user.click(screen.getByTestId("start-game"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
