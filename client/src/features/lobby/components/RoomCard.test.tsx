import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoomCard } from "@/features/lobby/components/RoomCard";
import type { Room } from "@/shared/types/apiTypes";

const baseRoom: Room = {
  id: 1,
  name: "Table One",
  code: "ABC123",
  ownerId: 1,
  ownerUsername: "host",
  variant: "bitola",
  matchMode: "1001",
  timerStyle: "relaxed",
  timerDurationSeconds: null,
  status: "waiting",
  playerCount: 1,
  isQuickPlay: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  players: [
    { id: 1, roomId: 1, userId: 1, username: "host", seat: 0, team: "teamA", createdAt: "" },
  ],
};

describe("RoomCard", () => {
  it("labels a quick-play room with the Quick Play badge and a 'Join queue' action", () => {
    render(<RoomCard room={{ ...baseRoom, isQuickPlay: true }} onJoin={() => {}} />);

    expect(screen.getByTestId("quick-play-badge")).toBeInTheDocument();
    expect(screen.getByTestId("room-card-join")).toHaveTextContent("Join queue");
  });

  it("renders a custom room with the plain Join action and no badge", () => {
    render(<RoomCard room={baseRoom} onJoin={() => {}} />);

    expect(screen.queryByTestId("quick-play-badge")).not.toBeInTheDocument();
    const join = screen.getByTestId("room-card-join");
    expect(join).toHaveTextContent("Join");
    expect(join).not.toHaveTextContent("Join queue");
  });
});
