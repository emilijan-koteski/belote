package chat

import (
	"encoding/json"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilijan/belote/server/internal/user"
	"github.com/emilijan/belote/server/internal/ws"
)

const (
	maxMessageLength = 500
	ChannelGlobal    = "global"
	ChannelMatch     = "match"
)

// GameMembership reports whether a user is currently in an active game session
// and resolves the four participants of a given match.
// Wired to *session.Manager in main.go.
type GameMembership interface {
	IsUserInGame(userID uint) bool
	MatchParticipants(matchID uint) ([4]uint, bool)
}

// Broadcaster is the subset of *ws.Hub that the chat handler depends on.
// Defined as an interface to allow lightweight unit testing without spinning
// up a real hub goroutine and websocket server.
type Broadcaster interface {
	ConnectedUserIDs() []uint
	BroadcastToUsers(userIDs []uint, msg []byte)
}

// Handler processes action:chat_message events.
// Match-scoped chat (channel == "match") is implemented in Story 6.2;
// this handler ignores it for now and returns silently.
type Handler struct {
	hub      Broadcaster
	userRepo user.UserRepository
	game     GameMembership
}

// NewHandler creates a chat handler wired to the WebSocket broadcaster,
// the user repository (for sender username lookup), and the session manager
// (for in-game membership checks).
func NewHandler(hub Broadcaster, userRepo user.UserRepository, game GameMembership) *Handler {
	return &Handler{hub: hub, userRepo: userRepo, game: game}
}

// HandleAction is the action handler entry point. Composed with
// session.Manager.HandleAction in main.go via a dispatch closure.
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
	case ChannelGlobal:
		h.handleGlobal(client.UserID, text)
	case ChannelMatch:
		h.handleMatch(client.UserID, req.MatchID, text)
	default:
		slog.Info("chat: unknown channel", "userID", client.UserID, "channel", req.Channel)
	}
}

func (h *Handler) handleGlobal(senderID uint, text string) {
	// Enforce "no global chat while in a game" — silently drop (AC #7).
	if h.game.IsUserInGame(senderID) {
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
		Scope:     ChannelGlobal,
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
		if uid != senderID && h.game.IsUserInGame(uid) {
			continue
		}
		eligible = append(eligible, uid)
	}
	h.hub.BroadcastToUsers(eligible, msgBytes)
}

func (h *Handler) handleMatch(senderID uint, matchID *uint, text string) {
	if matchID == nil {
		slog.Info("chat: match send dropped (missing matchId)", "userID", senderID)
		return
	}

	participants, ok := h.game.MatchParticipants(*matchID)
	if !ok {
		slog.Info("chat: match send dropped (unknown matchId)",
			"userID", senderID, "matchID", *matchID)
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
			"userID", senderID, "matchID", *matchID)
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
