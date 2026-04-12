package ws

import "strings"

// Router performs type-based dispatch of WebSocket messages.
// Zero game logic, zero validation — dispatch only.
type Router struct {
	ActionHandler ActionHandler
	SystemHandler SystemHandler
}

// Route dispatches a message based on its type prefix.
// Returns the prefix for the caller to handle unknown cases.
func (r *Router) Route(client *Client, msg WSMessage) string {
	prefix := extractRoutePrefix(msg.Type)
	switch prefix {
	case "action":
		if r.ActionHandler != nil {
			go r.ActionHandler(client, msg)
		}
	case "system":
		if r.SystemHandler != nil {
			go r.SystemHandler(client, msg)
		}
	}
	return prefix
}

func extractRoutePrefix(eventType string) string {
	if idx := strings.IndexByte(eventType, ':'); idx >= 0 {
		return eventType[:idx]
	}
	return ""
}
