import "@/shared/i18n/i18n";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { LobbyPage } from "./LobbyPage";

vi.mock("@/shared/api/rooms", () => ({
  createRoom: vi.fn(),
}));

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
});
