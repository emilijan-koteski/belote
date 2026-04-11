import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { Room } from "@/shared/types/apiTypes";

import { RoomCard } from "./RoomCard";

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

function renderRoomCard(room: Room = makeRoom()) {
  render(
    <BrowserRouter>
      <RoomCard room={room} />
    </BrowserRouter>,
  );
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
});
