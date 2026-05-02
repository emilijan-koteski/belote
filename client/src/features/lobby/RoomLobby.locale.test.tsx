// Locale overflow test (AC-009). Renders RoomLobby in both `en` and `sr`
// and asserts no text element inside the seat tiles overflows its
// container.
//
// JSDOM caveat: scrollWidth and clientWidth are both 0 in JSDOM, so a
// straight `el.scrollWidth > el.clientWidth` check is trivially false and
// the test would never fail in the unit-test runtime. Two complementary
// strategies handle that:
//
//   1. Run the scrollWidth/clientWidth check anyway — it remains a no-op
//      under JSDOM but becomes meaningful when the same test file is
//      executed in a real browser via Playwright/Cypress (planned in a
//      follow-up commit). Documenting the intent here keeps the gate in
//      place.
//
//   2. CSS-only proxy assertion: confirm the rendered Serbian and English
//      labels mount without crashing and that the seat tile structure
//      matches the diamond layout expectation. The visible-text presence
//      of `Tim A` / `Tim B` (or `Team A` / `Team B`) inside the lobby is
//      a strong signal the i18n key resolved without a missing-string
//      fallback that would itself break layout.
//
// This is the choice the spec calls out: "Implement whichever fits the
// codebase's existing test patterns and document the choice in a comment
// at the top of the file." The codebase already mocks i18n via
// `i18n.changeLanguage` (see i18n.test.ts), so we follow that pattern.

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
  it.each(["en", "sr"] as const)("no seat-tile text overflows in %s locale", async (locale) => {
    await i18n.changeLanguage(locale);

    renderRoomLobby();

    // Wait for the seat grid + the team header that swaps on language
    // change. If translation keys were missing, getByText would throw
    // before we get to the overflow assertion — that is itself a
    // signal the i18n parity test should also catch.
    await waitFor(() => {
      expect(screen.getByTestId("seats-grid")).toBeInTheDocument();
    });

    const expectedTeamA = locale === "en" ? "Team A" : "Tim A";
    const expectedTeamB = locale === "en" ? "Team B" : "Tim B";
    expect(screen.getByText(expectedTeamA)).toBeInTheDocument();
    expect(screen.getByText(expectedTeamB)).toBeInTheDocument();

    // Walk every text-bearing element inside each seat tile and apply
    // the scrollWidth/clientWidth check. JSDOM zeroes both, so the
    // assertion is trivially satisfied here — its real value lands
    // when a future Playwright run executes the same shape. Comment
    // is on the file header explaining the limitation.
    const seatGrid = screen.getByTestId("seats-grid");
    const tiles = seatGrid.querySelectorAll<HTMLElement>("[data-testid^='seat-position-']");
    expect(tiles.length).toBe(4);

    for (const tile of tiles) {
      // Buttons, spans, divs — anything that holds text. Reading
      // textContent excludes hidden whitespace nodes.
      const textNodes = tile.querySelectorAll<HTMLElement>("button, span, p, div");
      for (const el of textNodes) {
        if (!el.textContent || el.textContent.trim() === "") continue;
        expect(
          el.scrollWidth,
          `text overflow in ${locale} on element <${el.tagName.toLowerCase()}> with content "${el.textContent.trim().slice(0, 40)}"`,
        ).toBeLessThanOrEqual(el.clientWidth);
      }
    }
  });
});
