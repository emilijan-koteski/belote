import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { QueryWrapper } from "@/test-utils";

import { RoomDetailPreview } from "./RoomDetailPreview";

// Mock API
vi.mock("@/shared/api/rooms", () => ({
  getRoom: vi.fn(),
}));

import { getRoom } from "@/shared/api/rooms";

const mockGetRoom = vi.mocked(getRoom);

const defaultRoom = {
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
  createdAt: "",
  updatedAt: "",
};

function renderPreview(roomId = 1) {
  render(
    <QueryWrapper>
      <BrowserRouter>
        <RoomDetailPreview roomId={roomId} />
      </BrowserRouter>
    </QueryWrapper>,
  );
}

describe("RoomDetailPreview", () => {
  it("renders loading skeleton while fetching", () => {
    mockGetRoom.mockReturnValue(new Promise(() => {})); // never resolves

    renderPreview();

    expect(screen.getByTestId("room-detail-preview")).toBeInTheDocument();
    // All 4 seat slots should be skeleton placeholders
    expect(screen.getByTestId("room-detail-seat-0")).toBeInTheDocument();
    expect(screen.getByTestId("room-detail-seat-1")).toBeInTheDocument();
    expect(screen.getByTestId("room-detail-seat-2")).toBeInTheDocument();
    expect(screen.getByTestId("room-detail-seat-3")).toBeInTheDocument();
  });

  it("renders Team A / Team B headers (neutral view)", async () => {
    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 0 },
      players: [],
    });

    renderPreview();

    await waitFor(() => {
      expect(screen.getByText("Team A")).toBeInTheDocument();
    });
    expect(screen.getByText("Team B")).toBeInTheDocument();
  });

  it("renders player names in correct seat positions with data-team attributes", async () => {
    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "Kiro", seat: 0, team: "teamA", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "Irena", seat: 3, team: "teamB", createdAt: "" },
      ],
    });

    renderPreview();

    await waitFor(() => {
      expect(screen.getByText("Kiro")).toBeInTheDocument();
    });

    expect(screen.getByText("Irena")).toBeInTheDocument();

    // Kiro at seat 0 (teamA, top-left)
    const seat0 = screen.getByTestId("room-detail-seat-0");
    expect(seat0).toHaveTextContent("Kiro");
    expect(seat0).toHaveAttribute("data-team", "teamA");
    // Irena at seat 3 (teamB, bottom-right)
    const seat3 = screen.getByTestId("room-detail-seat-3");
    expect(seat3).toHaveTextContent("Irena");
    expect(seat3).toHaveAttribute("data-team", "teamB");
  });

  it("renders empty seats with placeholder text", async () => {
    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 1 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "Kiro", seat: 0, team: "teamA", createdAt: "" },
      ],
    });

    renderPreview();

    await waitFor(() => {
      expect(screen.getByText("Kiro")).toBeInTheDocument();
    });

    // Seats 1, 2, 3 should show "Empty"
    const emptySlots = screen.getAllByText("Empty");
    expect(emptySlots).toHaveLength(3);
  });

  it("calls getRoom with the provided roomId", () => {
    mockGetRoom.mockReturnValue(new Promise(() => {}));

    renderPreview(99);

    expect(mockGetRoom).toHaveBeenCalledWith(99);
  });

  it("renders all four seats as empty when no players are seated", async () => {
    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 0 },
      players: [],
    });

    renderPreview();

    await waitFor(() => {
      const emptySlots = screen.getAllByText("Empty");
      expect(emptySlots).toHaveLength(4);
    });
  });

  it("renders unseated players with 'Not seated' label below the grid", async () => {
    mockGetRoom.mockResolvedValue({
      room: { ...defaultRoom, playerCount: 2 },
      players: [
        { id: 1, roomId: 1, userId: 10, username: "Kiro", seat: 0, team: "teamA", createdAt: "" },
        { id: 2, roomId: 1, userId: 20, username: "Maja", seat: null, team: null, createdAt: "" },
      ],
    });

    renderPreview();

    await waitFor(() => {
      expect(screen.getByText("Kiro")).toBeInTheDocument();
    });

    // Maja is unseated — should appear with "Not seated" label
    expect(screen.getByTestId("room-detail-unseated")).toBeInTheDocument();
    expect(screen.getByText(/Maja/)).toBeInTheDocument();
    expect(screen.getByText(/Not seated/)).toBeInTheDocument();

    // Maja should NOT appear in any seat slot
    expect(screen.getByTestId("room-detail-seat-1")).not.toHaveTextContent("Maja");
    expect(screen.getByTestId("room-detail-seat-2")).not.toHaveTextContent("Maja");
    expect(screen.getByTestId("room-detail-seat-3")).not.toHaveTextContent("Maja");
  });
});
