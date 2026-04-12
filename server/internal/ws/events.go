package ws

// WebSocket event contract — keep in sync with client/src/shared/types/wsEvents.ts

// Event type prefixes:
// action: — client -> server
// event:  — server -> client (game state)
// error:  — server -> client (errors)
// system: — server -> client (platform events)

// --- Authentication events ---
const ActionAuthenticate = "action:authenticate"
const SystemAuthenticated = "system:authenticated"
const ErrorAuthFailed = "error:auth_failed"

// --- Game action events (client -> server) ---
const ActionPlayCard = "action:play_card"
const ActionPickTrump = "action:pick_trump"
const ActionPassTrump = "action:pass_trump"
const ActionDeclare = "action:declare"
const ActionSkipDeclare = "action:skip_declare"
const ActionAnnounceBelot = "action:announce_belot"
const ActionDeclineBelot = "action:decline_belot"

// --- Game state events (server -> client) ---
const EventGameState = "event:game_state"
const EventCardPlayed = "event:card_played"
const EventTrickResolved = "event:trick_resolved"
const EventHandScored = "event:hand_scored"
const EventMatchEnd = "event:match_end"
const EventTrumpSelected = "event:trump_selected"
const EventDeclarationsResolved = "event:declarations_resolved"
const EventBelotAnnounced = "event:belot_announced"

// --- Game error events (server -> client) ---
const ErrorInvalidAction = "error:invalid_action"
const ErrorNotYourTurn = "error:not_your_turn"
const ErrorWrongPhase = "error:wrong_phase"
const ErrorIllegalPlay = "error:illegal_play"

// --- Room events ---
const SystemRoomCreated = "system:room_created"
const SystemRoomUpdated = "system:room_updated"

// --- Room player events ---
const SystemPlayerJoined = "system:player_joined"
const SystemPlayerLeft = "system:player_left"

// --- Seat and game events ---
const SystemSeatUpdated = "system:seat_updated"
const SystemGameStarted = "system:game_started"

// --- Chat events ---
const SystemChatMessage = "system:chat_message"

// --- General error events ---
const SystemError = "system:error"
const ErrorUnknownEvent = "error:unknown_event"
