package chat

import (
	"encoding/json"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilijan/beljot/server/internal/user"
	"github.com/emilijan/beljot/server/internal/ws"
)

const (
	maxMessageLength = 500
	ChannelLobby     = "lobby"
	ChannelMatch     = "match"
	ChannelRoom      = "room"
)

// GameMembership reports whether a user is currently in an active game session
// and resolves the four participants of a given match.
// Wired to *match.Manager in main.go.
type GameMembership interface {
	IsUserInMatch(userID uint) bool
	MatchParticipants(roomID uint) ([4]uint, bool)
}

// RoomMembership resolves the member userIDs of a room for room-scoped chat.
// Returns (userIDs, true) only when the room exists AND its status is
// "waiting" (pre-match). Returns (nil, false) for unknown rooms or rooms
// whose match has started/ended — room chat is a pre-match feature.
// Wired in main.go to an adapter over room.RoomRepository.
type RoomMembership interface {
	RoomMembers(roomID uint) (userIDs []uint, waiting bool)
}

// Broadcaster is the subset of *ws.Hub that the chat handler depends on.
// Defined as an interface to allow lightweight unit testing without spinning
// up a real hub goroutine and websocket server.
type Broadcaster interface {
	ConnectedUserIDs() []uint
	BroadcastToUsers(userIDs []uint, msg []byte)
}

// Handler processes action:chat_message events for all three scopes
// (global, match, room).
type Handler struct {
	hub      Broadcaster
	userRepo user.UserRepository
	game     GameMembership
	room     RoomMembership
}

// NewHandler creates a chat handler wired to the WebSocket broadcaster,
// the user repository (for sender username lookup), the session manager
// (for in-game membership + match participant checks), and the room
// membership resolver (for room-scoped chat recipient lists).
func NewHandler(
	hub Broadcaster,
	userRepo user.UserRepository,
	game GameMembership,
	room RoomMembership,
) *Handler {
	return &Handler{hub: hub, userRepo: userRepo, game: game, room: room}
}

// HandleAction is the action handler entry point. Composed with
// match.Manager.HandleAction in main.go via a dispatch closure.
// Returns silently for any msg.Type other than ws.ActionChatMessage so the
// composite caller can safely route every action through it.
func (h *Handler) HandleAction(client *ws.Client, msg ws.WSMessage) {
	if msg.Type != ws.ActionChatMessage {
		return
	}

	var req ws.ChatMessageRequest
	if err := json.Unmarshal(msg.Payload, &req); err != nil {
		slog.Info("chat: invalid payload", "userID", client.UserID, "error", err)
		return
	}

	text := strings.TrimSpace(req.Text)
	// Use rune count (not byte count) so the server cap matches the client's
	// `string.length` (UTF-16 code units approximate runes). A 500-rune
	// Cyrillic or emoji message stays within the limit.
	runeCount := utf8.RuneCountInString(text)
	if text == "" || runeCount > maxMessageLength {
		slog.Info("chat: message rejected (empty or too long)",
			"userID", client.UserID, "runes", runeCount)
		return
	}

	switch req.Channel {
	case ChannelLobby:
		h.handleGlobal(client.UserID, text)
	case ChannelMatch:
		h.handleMatch(client.UserID, req.RoomID, text)
	case ChannelRoom:
		h.handleRoom(client.UserID, req.RoomID, text)
	default:
		slog.Info("chat: unknown channel", "userID", client.UserID, "channel", req.Channel)
	}
}

func (h *Handler) handleGlobal(senderID uint, text string) {
	// Enforce "no global chat while in a game" — silently drop (AC #7).
	if h.game.IsUserInMatch(senderID) {
		slog.Info("chat: global send dropped (sender in game)", "userID", senderID)
		return
	}

	sender, err := h.userRepo.FindByID(senderID)
	if err != nil || sender == nil {
		slog.Warn("chat: sender not found", "userID", senderID, "error", err)
		return
	}

	payload := ws.ChatMessagePayload{
		UserID:   sender.ID,
		Username: sender.Username,
		Message:  text,
		// RFC3339Nano gives nanosecond precision so (userId, timestamp) is
		// effectively unique across the message stream — used as a stable
		// React key on the client.
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Scope:     ChannelLobby,
	}
	msgBytes := buildMessage(ws.SystemChatMessage, payload)
	if msgBytes == nil {
		return
	}

	// Recipients: all connected users NOT currently in a game.
	// The sender is unconditionally included (their initial check already
	// passed at the top of this function) so they always see their own
	// message echo even if they joined a game in the microseconds since.
	recipients := h.hub.ConnectedUserIDs()
	eligible := make([]uint, 0, len(recipients))
	for _, uid := range recipients {
		if uid != senderID && h.game.IsUserInMatch(uid) {
			continue
		}
		eligible = append(eligible, uid)
	}
	h.hub.BroadcastToUsers(eligible, msgBytes)
}

func (h *Handler) handleMatch(senderID uint, roomID *uint, text string) {
	if roomID == nil {
		slog.Info("chat: match send dropped (missing roomId)", "userID", senderID)
		return
	}

	participants, ok := h.game.MatchParticipants(*roomID)
	if !ok {
		slog.Info("chat: match send dropped (unknown roomId)",
			"userID", senderID, "roomID", *roomID)
		return
	}

	// Authorise: sender must be one of the 4 session participants.
	authorized := false
	for _, uid := range participants {
		if uid == senderID {
			authorized = true
			break
		}
	}
	if !authorized {
		slog.Info("chat: match send dropped (sender not in match)",
			"userID", senderID, "roomID", *roomID)
		return
	}

	sender, err := h.userRepo.FindByID(senderID)
	if err != nil || sender == nil {
		slog.Warn("chat: match sender not found", "userID", senderID, "error", err)
		return
	}

	payload := ws.ChatMessagePayload{
		UserID:    sender.ID,
		Username:  sender.Username,
		Message:   text,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Scope:     ChannelMatch,
	}
	msgBytes := buildMessage(ws.SystemChatMessage, payload)
	if msgBytes == nil {
		return
	}

	// Broadcast to ALL 4 participants (sender included so they see their own
	// echo). Hub.BroadcastToUsers silently skips disconnected IDs, which is the
	// intended behaviour for players inside the reconnect window.
	h.hub.BroadcastToUsers(participants[:], msgBytes)
}

func (h *Handler) handleRoom(senderID uint, roomID *uint, text string) {
	if roomID == nil {
		slog.Info("chat: room send dropped (missing roomId)", "userID", senderID)
		return
	}

	members, waiting := h.room.RoomMembers(*roomID)
	if !waiting {
		slog.Info("chat: room send dropped (unknown room or not waiting)",
			"userID", senderID, "roomID", *roomID)
		return
	}

	// Authorise: sender must be one of the room members.
	authorized := false
	for _, uid := range members {
		if uid == senderID {
			authorized = true
			break
		}
	}
	if !authorized {
		slog.Info("chat: room send dropped (sender not in room)",
			"userID", senderID, "roomID", *roomID)
		return
	}

	sender, err := h.userRepo.FindByID(senderID)
	if err != nil || sender == nil {
		slog.Warn("chat: room sender not found", "userID", senderID, "error", err)
		return
	}

	payload := ws.ChatMessagePayload{
		UserID:    sender.ID,
		Username:  sender.Username,
		Message:   text,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Scope:     ChannelRoom,
	}
	msgBytes := buildMessage(ws.SystemChatMessage, payload)
	if msgBytes == nil {
		return
	}

	// Broadcast to all room members (sender included for own-echo).
	// Hub.BroadcastToUsers silently skips disconnected IDs, which is the
	// intended behaviour during transient disconnects.
	h.hub.BroadcastToUsers(members, msgBytes)
}

func buildMessage(eventType string, payload interface{}) []byte {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		slog.Error("chat: marshal payload failed", "type", eventType, "error", err)
		return nil
	}
	msg, err := json.Marshal(ws.WSMessage{Type: eventType, Payload: payloadBytes})
	if err != nil {
		slog.Error("chat: marshal message failed", "type", eventType, "error", err)
		return nil
	}
	return msg
}
