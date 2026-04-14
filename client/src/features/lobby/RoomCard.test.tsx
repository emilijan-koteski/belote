import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { Room } from "@/shared/types/apiTypes";

import { RoomCard } from "./RoomCard";

// Mock RoomDetailPreview to avoid API calls in RoomCard tests
vi.mock("@/features/lobby/RoomDetailPreview", () => ({
  RoomDetailPreview: ({ roomId }: { roomId: number }) => (
    <div data-testid="room-detail-preview">Preview for room {roomId}</div>
  ),
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

function renderRoomCard(
  room: Room = makeRoom(),
  props: {
    onJoin?: ReturnType<typeof vi.fn>;
    isExpanded?: boolean;
    onToggle?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const onJoin = props.onJoin ?? vi.fn();
  const onToggle = props.onToggle ?? vi.fn();
  render(
    <BrowserRouter>
      <RoomCard room={room} onJoin={onJoin} isExpanded={props.isExpanded} onToggle={onToggle} />
    </BrowserRouter>,
  );
  return { onJoin, onToggle };
}

describe("RoomCard", () => {
  it("renders room name", () => {
    renderRoomCard(makeRoom({ name: "Zagreb Ekipa" }));

    expect(screen.getByText("Zagreb Ekipa")).toBeInTheDocument();
  });

  it("renders translated variant and match mode", () => {
    renderRoomCard(makeRoom({ variant: "bitola", matchMode: "1001" }));

    expect(screen.getByTestId("room-card")).toHaveTextContent("Bitola");
    expect(screen.getByTestId("room-card")).toHaveTextContent("1001 pts");
  });

  it("renders player count", () => {
    renderRoomCard(makeRoom({ playerCount: 3 }));

    expect(screen.getByTestId("room-card")).toHaveTextContent("3/4");
  });

  it("renders relaxed timer style", () => {
    renderRoomCard(makeRoom({ timerStyle: "relaxed" }));

    expect(screen.getByTestId("room-card")).toHaveTextContent("Relaxed");
  });

  it("renders per-move timer with duration", () => {
    renderRoomCard(makeRoom({ timerStyle: "per-move", timerDurationSeconds: 45 }));

    expect(screen.getByTestId("room-card")).toHaveTextContent("45s timer");
  });

  it("renders join button", () => {
    renderRoomCard();

    expect(screen.getByTestId("room-card-join")).toBeInTheDocument();
    expect(screen.getByTestId("room-card-join")).toHaveTextContent("Join");
  });

  it("invokes onJoin callback with room id on join click", async () => {
    const room = makeRoom({ id: 42 });
    const { onJoin } = renderRoomCard(room);

    await userEvent.click(screen.getByTestId("room-card-join"));

    expect(onJoin).toHaveBeenCalledWith(42);
  });

  // --- Expandable detail ---

  it("calls onToggle when clicking card body", async () => {
    const { onToggle } = renderRoomCard(makeRoom(), { onToggle: vi.fn() });

    await userEvent.click(screen.getByTestId("room-card-toggle"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not call onToggle when clicking Join button", async () => {
    const onToggle = vi.fn();
    renderRoomCard(makeRoom(), { onToggle });

    await userEvent.click(screen.getByTestId("room-card-join"));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("renders RoomDetailPreview when isExpanded is true", () => {
    renderRoomCard(makeRoom({ id: 7 }), { isExpanded: true });

    expect(screen.getByTestId("room-detail-preview")).toBeInTheDocument();
    expect(screen.getByTestId("room-detail-preview")).toHaveTextContent("Preview for room 7");
  });

  it("does not render RoomDetailPreview when isExpanded is false", () => {
    renderRoomCard(makeRoom(), { isExpanded: false });

    expect(screen.queryByTestId("room-detail-preview")).not.toBeInTheDocument();
  });

  it("does not render RoomDetailPreview by default (no isExpanded prop)", () => {
    renderRoomCard();

    expect(screen.queryByTestId("room-detail-preview")).not.toBeInTheDocument();
  });
});
