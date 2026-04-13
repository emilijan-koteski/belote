// WebSocket event contract — keep in sync with server/internal/ws/events.go

// Event type prefixes
// action: — client -> server
// event:  — server -> client (game state)
// error:  — server -> client (errors)
// system: — server -> client (platform events)

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

// --- Authentication events ---
export const ACTION_AUTHENTICATE = "action:authenticate" as const;
export const SYSTEM_AUTHENTICATED = "system:authenticated" as const;
export const ERROR_AUTH_FAILED = "error:auth_failed" as const;

export interface AuthenticatePayload {
  token: string;
}

export interface AuthenticatedPayload {
  userId: number;
}

export interface AuthFailedPayload {
  message: string;
}

// --- Game action events (client -> server) ---
export const ACTION_PLAY_CARD = "action:play_card" as const;
export const ACTION_PICK_TRUMP = "action:pick_trump" as const;
export const ACTION_PASS_TRUMP = "action:pass_trump" as const;
export const ACTION_DECLARE = "action:declare" as const;
export const ACTION_SKIP_DECLARE = "action:skip_declare" as const;
export const ACTION_ANNOUNCE_BELOT = "action:announce_belot" as const;
export const ACTION_DECLINE_BELOT = "action:decline_belot" as const;

export interface PlayCardPayload {
  cardId: string;
}

export interface PickTrumpPayload {
  suit?: "S" | "H" | "D" | "C"; // Required in round 2 (free suit selection); omit in round 1
}

export interface PassTrumpPayload {
  // Empty — passing on trump selection
}

export interface DeclarePayload {
  // Empty — declaring available combinations
}

export interface SkipDeclarePayload {
  // Empty — skipping declaration
}

export interface AnnounceBelotPayload {
  // Empty — announcing Belot (K+Q of trump)
}

export interface DeclineBelotPayload {
  // Empty — declining Belot announcement
}

// --- Game state events (server -> client) ---
export const EVENT_GAME_STATE = "event:game_state" as const;
export const EVENT_CARD_PLAYED = "event:card_played" as const;
export const EVENT_TRICK_RESOLVED = "event:trick_resolved" as const;
export const EVENT_HAND_SCORED = "event:hand_scored" as const;
export const EVENT_MATCH_END = "event:match_end" as const;
export const EVENT_TRUMP_SELECTED = "event:trump_selected" as const;
export const EVENT_DECLARATIONS_RESOLVED = "event:declarations_resolved" as const;
export const EVENT_BELOT_ANNOUNCED = "event:belot_announced" as const;

// Game state payload types will be expanded in Story 4.2 when the session manager
// defines the exact shape of game state broadcasts. For now, typed as unknown.
export interface GameStatePayload {
  [key: string]: unknown;
}

export interface CardPlayedPayload {
  playerSeat: number;
  cardId: string;
  autoPlayed: boolean;
}

export interface TrickResolvedPayload {
  winnerSeat: number;
  winnerTeam: number;
  cards: string[];
}

export interface HandScoredPayload {
  redCardPoints: number;
  blueCardPoints: number;
  redDeclPoints: number;
  blueDeclPoints: number;
  lastTrickTeam: number;
  lastTrickBonus: number;
  capot: boolean;
  capotTeam: number | null;
  capotBonus: number;
  failedContract: boolean;
  contractingTeam: number;
  redHandTotal: number;
  blueHandTotal: number;
  redMatchScore: number;
  blueMatchScore: number;
}

export interface MatchEndPayload {
  winnerTeam: number;
  redFinalScore: number;
  blueFinalScore: number;
  matchDurationSec: number;
}

export interface TrumpSelectedPayload {
  playerSeat: number;
  trumpSuit: string;
}

export interface DeclarationsResolvedPayload {
  winnerTeam: number | null;
  declarations: Array<{
    playerSeat: number;
    type: string;
    value: number;
    cards: string[];
  }>;
}

export interface BelotAnnouncedPayload {
  playerSeat: number;
  team: number;
}

// --- Game error events (server -> client) ---
export const ERROR_INVALID_ACTION = "error:invalid_action" as const;
export const ERROR_NOT_YOUR_TURN = "error:not_your_turn" as const;
export const ERROR_WRONG_PHASE = "error:wrong_phase" as const;
export const ERROR_ILLEGAL_PLAY = "error:illegal_play" as const;

export interface GameErrorPayload {
  code: string;
  message: string;
}

// --- Room events ---
export const SYSTEM_ROOM_CREATED = "system:room_created" as const;
export const SYSTEM_ROOM_UPDATED = "system:room_updated" as const;

export interface RoomCreatedPayload {
  id: number;
  name: string;
  code: string;
  ownerId: number;
  variant: string;
  matchMode: string;
  timerStyle: string;
  timerDurationSeconds: number | null;
  status: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomUpdatedPayload {
  id: number;
  name: string;
  code: string;
  ownerId: number;
  variant: string;
  matchMode: string;
  timerStyle: string;
  timerDurationSeconds: number | null;
  status: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
}

// --- Room player events ---
export const SYSTEM_PLAYER_JOINED = "system:player_joined" as const;
export const SYSTEM_PLAYER_LEFT = "system:player_left" as const;

export interface PlayerJoinedPayload {
  roomId: number;
  userId: number;
  username: string;
  playerCount: number;
}

export interface PlayerLeftPayload {
  roomId: number;
  userId: number;
  username: string;
  playerCount: number;
  newOwnerId?: number;
}

// --- Seat and game events ---
export const SYSTEM_SEAT_UPDATED = "system:seat_updated" as const;
export const SYSTEM_GAME_STARTED = "system:game_started" as const;

export interface SeatUpdatedPayload {
  roomId: number;
  userId: number;
  username: string;
  seat: number;
  team: string;
  previousSeat: number | null;
}

export interface GameStartedPayload {
  roomId: number;
}

// --- Chat events ---
export const SYSTEM_CHAT_MESSAGE = "system:chat_message" as const;

export interface ChatMessagePayload {
  userId: number;
  username: string;
  message: string;
  timestamp: string;
  scope: "global" | "match";
}

// --- General error events ---
export const SYSTEM_ERROR = "system:error" as const;
export const ERROR_UNKNOWN_EVENT = "error:unknown_event" as const;

export interface ErrorPayload {
  message: string;
}
