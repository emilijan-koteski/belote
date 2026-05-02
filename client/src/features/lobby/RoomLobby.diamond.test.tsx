// Diamond layout invariant test (AC-008). Renders RoomLobby in the seated
// state once for each viewerSeat ∈ {0,1,2,3} and asserts the cardinal-
// position contract:
//   - the seat at `seat-position-south` corresponds to viewerSeat
//   - the seat at `seat-position-north` corresponds to (viewerSeat + 2) % 4
//     (the partner) and shares the viewer's team via the `data-team` attr
//   - the seats at `seat-position-east` and `seat-position-west` are the
//     remaining two (the opponents)
//
// JSDOM caveat: `getBoundingClientRect()` returns zeroed coordinates, so
// asserting visual position via geometry is meaningless here. Per the
// spec, we instead read the inline `gridArea` style — that is what the
// CSS Grid `grid-template-areas` resolution depends on, and it survives
// JSDOM's render. This is also a structural/intent assertion: any future
// internal rotation refactor stays valid as long as the cardinal-position
// contract holds. (Visual geometry would be re-checked in a real browser
// via Playwright/Cypress in a later commit.)

import "@/shared/i18n/i18n";

import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";
import { useChatStore } from "@/shared/stores/chatStore";
import { QueryWrapper } from "@/test-utils";

import { RoomLobby } from "./RoomLobby";

// Mirror the existing RoomLobby.test.tsx mock surface — RoomLobby pulls
// router, room API, WS context, and toasts. Without these the render
// throws before we get to the seat tiles.
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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { getRoom, leaveRoom } from "@/shared/api/rooms";
const mockGetRoom = vi.mocked(getRoom);
const mockLeaveRoom = vi.mocked(leaveRoom);

// fourSeated builds a fully-seated lobby: seats 0,2 → teamA, 1,3 → teamB.
// `viewerUserId` selects which seat the rendered viewer occupies.
function fourSeated(viewerSeat: number) {
  // viewerSeat → userId map: viewer is always userId 100 for clarity.
  const usernames = ["alice", "bob", "carol", "dave"];
  const players = [0, 1, 2, 3].map((seat) => ({
    id: seat + 1,
    roomId: 1,
    userId: seat === viewerSeat ? 100 : 200 + seat,
    username: usernames[seat]!,
    seat,
    team: seat % 2 === 0 ? "teamA" : "teamB",
    createdAt: "",
  }));
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
    players,
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
});

afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, token: null });
  useChatStore.setState({ globalMessages: [], matchMessages: [], roomMessages: [] });
});

describe("RoomLobby diamond layout invariant", () => {
  it.each([0, 1, 2, 3])(
    "viewerSeat=%i → south is viewer, north is partner sharing team, east/west are opponents",
    async (viewerSeat) => {
      useAuthStore.setState({
        user: {
          id: 100,
          username: ["alice", "bob", "carol", "dave"][viewerSeat]!,
          email: "v@b.com",
          languagePreference: "en",
          createdAt: "",
        },
        token: "tok",
      });

      mockGetRoom.mockResolvedValue(fourSeated(viewerSeat));

      renderRoomLobby();

      await waitFor(() => {
        expect(screen.getByTestId("seats-grid")).toBeInTheDocument();
      });

      // Resolve every cardinal slot via testid. RoomLobby renders one
      // wrapper div per seat with both `seat-position-{cardinal}` and the
      // child `player-seat-{N}` so we can map cardinal ↔ seat index.
      const south = screen.getByTestId("seat-position-south");
      const north = screen.getByTestId("seat-position-north");
      const east = screen.getByTestId("seat-position-east");
      const west = screen.getByTestId("seat-position-west");

      // gridArea — the spec's chosen position assertion. JSDOM doesn't
      // compute layout, but the inline `style={{ gridArea }}` survives
      // the React render and is the single source of truth for visual
      // placement in the CSS-Grid scheme.
      expect((south as HTMLElement).style.gridArea).toBe("south");
      expect((north as HTMLElement).style.gridArea).toBe("north");
      expect((east as HTMLElement).style.gridArea).toBe("east");
      expect((west as HTMLElement).style.gridArea).toBe("west");

      // Map cardinal back to seat index by reading the nested
      // `player-seat-{N}` testid.
      function seatIndexAt(el: HTMLElement): number {
        const button = el.querySelector("[data-testid^='player-seat-']") as HTMLElement | null;
        expect(button, "expected nested player-seat-N button").not.toBeNull();
        const match = button!.getAttribute("data-testid")!.match(/^player-seat-(\d)$/);
        expect(
          match,
          `seat testid did not match: ${button!.getAttribute("data-testid")}`,
        ).not.toBeNull();
        return Number(match![1]);
      }

      const partnerSeat = (viewerSeat + 2) % 4;

      expect(seatIndexAt(south as HTMLElement)).toBe(viewerSeat);
      expect(seatIndexAt(north as HTMLElement)).toBe(partnerSeat);
      // AC10 / D119: positional east/west assertions. Counter-clockwise
      // seat indexing puts the next-CCW opponent at east (viewer+1) and
      // the previous-CCW opponent at west (viewer+3). The previous loose
      // sorted-set check would have passed even if east and west were
      // swapped — that is no longer a regression gate.
      expect(seatIndexAt(east as HTMLElement)).toBe((viewerSeat + 1) % 4);
      expect(seatIndexAt(west as HTMLElement)).toBe((viewerSeat + 3) % 4);

      // Partnership signal: viewer and partner share data-team. This is
      // the next task's hook for the gold/silver palette + non-color
      // partnership cue, so locking it now prevents accidental drift.
      const viewerTeam = (south as HTMLElement).getAttribute("data-team");
      const partnerTeam = (north as HTMLElement).getAttribute("data-team");
      expect(viewerTeam).toBe(viewerSeat % 2 === 0 ? "teamA" : "teamB");
      expect(partnerTeam).toBe(viewerTeam);

      // Opponents must carry the *other* team's data-team. Re-asserts the
      // attribute hook is set on every tile, not just the viewer pair.
      const otherTeam = viewerTeam === "teamA" ? "teamB" : "teamA";
      expect((east as HTMLElement).getAttribute("data-team")).toBe(otherTeam);
      expect((west as HTMLElement).getAttribute("data-team")).toBe(otherTeam);
    },
  );
});
