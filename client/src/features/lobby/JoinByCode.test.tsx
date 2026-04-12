import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FetchError } from "@/shared/api/fetchClient";

import { JoinByCode } from "./JoinByCode";

const mockGetRoomByCode = vi.fn();
const mockJoinRoom = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/shared/api/rooms", () => ({
  getRoomByCode: (...args: unknown[]) => mockGetRoomByCode(...args),
  joinRoom: (...args: unknown[]) => mockJoinRoom(...args),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

function renderJoinByCode() {
  render(
    <BrowserRouter>
      <JoinByCode />
    </BrowserRouter>,
  );
}

describe("JoinByCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders input and join button", () => {
    renderJoinByCode();

    expect(screen.getByTestId("join-by-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("join-by-code-button")).toBeInTheDocument();
  });

  it("disables join button when input is empty", () => {
    renderJoinByCode();

    expect(screen.getByTestId("join-by-code-button")).toBeDisabled();
  });

  it("enables join button when code is entered", async () => {
    const user = userEvent.setup();
    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "ABC123");

    expect(screen.getByTestId("join-by-code-button")).toBeEnabled();
  });

  it("uppercases input as user types", async () => {
    const user = userEvent.setup();
    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "abc123");

    expect(screen.getByTestId("join-by-code-input")).toHaveValue("ABC123");
  });

  it("limits input to 6 characters", async () => {
    const user = userEvent.setup();
    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "ABCDEFGH");

    expect(screen.getByTestId("join-by-code-input")).toHaveValue("ABCDEF");
  });

  it("navigates to room on successful join", async () => {
    const user = userEvent.setup();
    mockGetRoomByCode.mockResolvedValue({
      room: { id: 42, name: "Test Room", code: "XYZ789" },
      players: [],
    });
    mockJoinRoom.mockResolvedValue({ id: 42 });

    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "XYZ789");
    await user.click(screen.getByTestId("join-by-code-button"));

    await waitFor(() => {
      expect(mockGetRoomByCode).toHaveBeenCalledWith("XYZ789");
      expect(mockJoinRoom).toHaveBeenCalledWith(42);
      expect(mockNavigate).toHaveBeenCalledWith("/rooms/42");
    });
  });

  it("shows not found toast on ROOM_NOT_FOUND error", async () => {
    const user = userEvent.setup();
    mockGetRoomByCode.mockRejectedValue(new FetchError(404, "ROOM_NOT_FOUND", "not found"));

    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "NOROOM");
    await user.click(screen.getByTestId("join-by-code-button"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it("shows room full toast on ROOM_FULL error from join", async () => {
    const user = userEvent.setup();
    mockGetRoomByCode.mockResolvedValue({
      room: { id: 10, name: "Full Room", code: "FULL01" },
      players: [],
    });
    mockJoinRoom.mockRejectedValue(new FetchError(409, "ROOM_FULL", "room is full"));

    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "FULL01");
    await user.click(screen.getByTestId("join-by-code-button"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it("joins on Enter key press", async () => {
    const user = userEvent.setup();
    mockGetRoomByCode.mockResolvedValue({
      room: { id: 7, name: "Enter Room", code: "ENTER1" },
      players: [],
    });
    mockJoinRoom.mockResolvedValue({ id: 7 });

    renderJoinByCode();

    await user.type(screen.getByTestId("join-by-code-input"), "ENTER1");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockGetRoomByCode).toHaveBeenCalledWith("ENTER1");
      expect(mockNavigate).toHaveBeenCalledWith("/rooms/7");
    });
  });
});
