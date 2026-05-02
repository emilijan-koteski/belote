// Locale overflow test (AC-009).
//
// AC-009 overflow check is JSDOM-impossible: both `scrollWidth` and
// `clientWidth` are 0 in jsdom, so any `scrollWidth > clientWidth` comparison
// is trivially false and would never fail. The real overflow regression gate
// lives in Playwright (TODO — convert to Playwright). This test only asserts
// i18n key parity at the seat-label render path: that the localized "Team A"
// / "Tim A" labels mount without a missing-key fallback that would itself
// break layout.
//
// AC10 / D117: removed the dead-letter scrollWidth/clientWidth assertion;
// keeping it would mislead future readers into thinking this test catches
// overflow regressions in unit-test runs.

import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n/i18n";
import { useAuthStore } from "@/shared/stores/authStore";
import { useChatStore } from "@/shared/stores/chatStore";
import { QueryWrapper } from "@/test-utils";

import { RoomLobby } from "./RoomLobby";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useParams: () => ({ id: "1" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/shared/api/rooms", () => ({
  getRoom: vi.fn(),
  leaveRoom: vi.fn(),
  selectSeat: vi.fn(),
  startGame: vi.fn(),
  kickPlayer: vi.fn(),
  swapSeats: vi.fn(),
}));

vi.mock("@/shared/providers/WebSocketContext", () => ({
  useWsConnectionState: () => "connected",
  useWsSendMessage: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getRoom, leaveRoom } from "@/shared/api/rooms";
const mockGetRoom = vi.mocked(getRoom);
const mockLeaveRoom = vi.mocked(leaveRoom);

function fourSeatedRoom() {
  return {
    room: {
      id: 1,
      name: "Test Room",
      code: "ABC123",
      ownerId: 100,
      variant: "bitola",
      matchMode: "1001",
      timerStyle: "relaxed",
      timerDurationSeconds: null,
      status: "waiting",
      playerCount: 4,
      isQuickPlay: false,
      createdAt: "",
      updatedAt: "",
    },
    players: [
      { id: 1, roomId: 1, userId: 100, username: "alice", seat: 0, team: "teamA", createdAt: "" },
      { id: 2, roomId: 1, userId: 200, username: "bob", seat: 1, team: "teamB", createdAt: "" },
      { id: 3, roomId: 1, userId: 300, username: "carol", seat: 2, team: "teamA", createdAt: "" },
      { id: 4, roomId: 1, userId: 400, username: "dave", seat: 3, team: "teamB", createdAt: "" },
    ],
  };
}

function renderRoomLobby() {
  return render(
    <QueryWrapper>
      <BrowserRouter>
        <RoomLobby />
      </BrowserRouter>
    </QueryWrapper>,
  );
}

beforeAll(async () => {
  // Make sure we start in `en` regardless of any cross-test residue.
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  mockLeaveRoom.mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  useAuthStore.setState({
    user: {
      id: 100,
      username: "alice",
      email: "a@b.com",
      languagePreference: "en",
      createdAt: "",
    },
    token: "tok",
  });
  mockGetRoom.mockResolvedValue(fourSeatedRoom());
});

afterEach(async () => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, token: null });
  useChatStore.setState({ globalMessages: [], matchMessages: [], roomMessages: [] });
  await i18n.changeLanguage("en");
});

describe("RoomLobby locale overflow", () => {
  it.each(["en", "sr"] as const)(
    "renders Tim A / Tim B labels without missing-key fallback in %s locale",
    async (locale) => {
      await i18n.changeLanguage(locale);

      renderRoomLobby();

      await waitFor(() => {
        expect(screen.getByTestId("seats-grid")).toBeInTheDocument();
      });

      const expectedTeamA = locale === "en" ? "Team A" : "Tim A";
      const expectedTeamB = locale === "en" ? "Team B" : "Tim B";
      expect(screen.getByText(expectedTeamA)).toBeInTheDocument();
      expect(screen.getByText(expectedTeamB)).toBeInTheDocument();

      // Sanity-check the diamond layout has all four seat tiles.
      const seatGrid = screen.getByTestId("seats-grid");
      const tiles = seatGrid.querySelectorAll<HTMLElement>("[data-testid^='seat-position-']");
      expect(tiles.length).toBe(4);
    },
  );
});
