package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/labstack/echo/v4"

	"github.com/emilijan/beljot/server/internal/auth"
)

const authTimeout = 10 * time.Second

// WSHandler handles WebSocket upgrade and authentication.
type WSHandler struct {
	Hub             *Hub
	JWTSecret       string
	AcceptedOrigins []string
}

// HandleWS upgrades the HTTP connection to WebSocket and performs
// the JWT authentication handshake via the first message.
func (h *WSHandler) HandleWS(c echo.Context) error {
	opts := &websocket.AcceptOptions{}
	if len(h.AcceptedOrigins) > 0 {
		opts.OriginPatterns = h.AcceptedOrigins
	} else {
		slog.Warn("ws: no accepted origins configured — accepting connections from any origin (InsecureSkipVerify)")
		opts.InsecureSkipVerify = true
	}

	conn, err := websocket.Accept(c.Response(), c.Request(), opts)
	if err != nil {
		slog.Error("ws: accept failed", "error", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "websocket upgrade failed"})
	}
	defer func() { _ = conn.CloseNow() }()

	// Read first message as auth handshake with timeout
	authCtx, cancel := context.WithTimeout(context.Background(), authTimeout)
	defer cancel()

	var authMsg WSMessage
	if err := wsjson.Read(authCtx, conn, &authMsg); err != nil {
		slog.Info("ws: auth read timeout or error", "error", err)
		conn.Close(websocket.StatusPolicyViolation, "authentication timeout")
		return nil
	}

	if authMsg.Type != ActionAuthenticate {
		sendError(conn, ErrorAuthFailed, "expected action:authenticate message")
		conn.Close(websocket.StatusPolicyViolation, "invalid auth message type")
		return nil
	}

	// Parse token from payload
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(authMsg.Payload, &payload); err != nil || payload.Token == "" {
		sendError(conn, ErrorAuthFailed, "missing or invalid token")
		conn.Close(websocket.StatusPolicyViolation, "invalid auth payload")
		return nil
	}

	// Validate JWT
	claims, err := auth.ValidateToken(payload.Token, h.JWTSecret)
	if err != nil {
		sendError(conn, ErrorAuthFailed, "invalid or expired token")
		conn.Close(websocket.StatusPolicyViolation, "token validation failed")
		return nil
	}

	if !slices.Contains([]string(claims.Audience), "access") {
		sendError(conn, ErrorAuthFailed, "invalid token audience")
		conn.Close(websocket.StatusPolicyViolation, "invalid token audience")
		return nil
	}

	userID, err := strconv.ParseUint(claims.Subject, 10, 64)
	if err != nil {
		sendError(conn, ErrorAuthFailed, "invalid token subject")
		conn.Close(websocket.StatusPolicyViolation, "invalid token subject")
		return nil
	}

	// Auth success — send confirmation
	sendSuccess(conn, uint(userID))
	slog.Info("ws: client authenticated", "userID", userID)

	// Create client and register with hub
	client := NewClient(conn, h.Hub, uint(userID))
	h.Hub.register <- client

	// Start read/write pumps — these block until connection closes
	go client.writePump()
	client.readPump()

	return nil
}

func sendError(conn *websocket.Conn, errorType string, message string) {
	payload, _ := json.Marshal(map[string]string{"message": message})
	msg := WSMessage{Type: errorType, Payload: payload}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := wsjson.Write(ctx, conn, msg); err != nil {
		slog.Warn("ws: failed to send error message", "errorType", errorType, "error", err)
	}
}

func sendSuccess(conn *websocket.Conn, userID uint) {
	payload, _ := json.Marshal(map[string]interface{}{"userId": userID})
	msg := WSMessage{Type: SystemAuthenticated, Payload: payload}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := wsjson.Write(ctx, conn, msg); err != nil {
		slog.Warn("ws: failed to send auth success", "userID", userID, "error", err)
	}
}
