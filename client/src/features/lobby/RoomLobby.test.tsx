import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { getRoom, leaveRoom } from "@/shared/api/rooms";
import { toast } from "sonner";

const mockGetRoom = vi.mocked(getRoom);
const mockLeaveRoom = vi.mocked(leaveRoom);

function renderRoomLobby() {
  render(
    <BrowserRouter>
      <RoomLobby />
    </BrowserRouter>,
  );
}

beforeEach(() => {
  // Default: leaveRoom resolves so cleanup effect doesn't throw
  mockLeaveRoom.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, token: null });
});

describe("RoomLobby", () => {
  it("renders room name and configuration", async () => {
    useAuthStore.setState({
      user: { id: 10, username: "alice", email: "a@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockGetRoom.mockResolvedValue({
      room: {
        id: 1, name: "Test Room", code: "XYZ123", ownerId: 10,
        variant: "bitola", matchMode: "1001", timerStyle: "relaxed",
        timerDurationSeconds: null, status: "waiting", playerCount: 1,
        createdAt: "", updatedAt: "",
      },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: null, team: null, createdAt: "" },
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
    useAuthStore.setState({
      user: { id: 10, username: "alice", email: "a@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockGetRoom.mockResolvedValue({
      room: {
        id: 1, name: "Room", code: "ABC", ownerId: 10,
        variant: "bitola", matchMode: "1001", timerStyle: "relaxed",
        timerDurationSeconds: null, status: "waiting", playerCount: 2,
        createdAt: "", updatedAt: "",
      },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: null, team: null, createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "bob", seat: null, team: null, createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });

    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("displays empty seats with Waiting text", async () => {
    useAuthStore.setState({
      user: { id: 10, username: "alice", email: "a@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockGetRoom.mockResolvedValue({
      room: {
        id: 1, name: "Room", code: "ABC", ownerId: 10,
        variant: "bitola", matchMode: "1001", timerStyle: "relaxed",
        timerDurationSeconds: null, status: "waiting", playerCount: 1,
        createdAt: "", updatedAt: "",
      },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: null, team: null, createdAt: "" },
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
    useAuthStore.setState({
      user: { id: 10, username: "alice", email: "a@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockGetRoom.mockResolvedValue({
      room: {
        id: 1, name: "Room", code: "ABC", ownerId: 10,
        variant: "bitola", matchMode: "1001", timerStyle: "relaxed",
        timerDurationSeconds: null, status: "waiting", playerCount: 1,
        createdAt: "", updatedAt: "",
      },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: null, team: null, createdAt: "" },
      ],
    });

    renderRoomLobby();

    await waitFor(() => {
      expect(screen.getByText("You")).toBeInTheDocument();
    });
  });

  it("calls clipboard API on copy link click", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: { id: 10, username: "alice", email: "a@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    mockGetRoom.mockResolvedValue({
      room: {
        id: 1, name: "Room", code: "XYZ123", ownerId: 10,
        variant: "bitola", matchMode: "1001", timerStyle: "relaxed",
        timerDurationSeconds: null, status: "waiting", playerCount: 1,
        createdAt: "", updatedAt: "",
      },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: null, team: null, createdAt: "" },
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
    useAuthStore.setState({
      user: { id: 10, username: "alice", email: "a@b.com", languagePreference: "en", createdAt: "" },
      token: "tok",
    });

    mockLeaveRoom.mockResolvedValue(undefined);

    mockGetRoom.mockResolvedValue({
      room: {
        id: 1, name: "Room", code: "ABC", ownerId: 10,
        variant: "bitola", matchMode: "1001", timerStyle: "relaxed",
        timerDurationSeconds: null, status: "waiting", playerCount: 1,
        createdAt: "", updatedAt: "",
      },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "alice", seat: null, team: null, createdAt: "" },
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
});
