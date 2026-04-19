package user

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/match"
)

type ProfileResponse struct {
	ID                 uint      `json:"id"`
	Username           string    `json:"username"`
	LanguagePreference string    `json:"languagePreference"`
	CreatedAt          time.Time `json:"createdAt"`
	TotalGamesPlayed   int       `json:"totalGamesPlayed"`
	Wins               int       `json:"wins"`
	Losses             int       `json:"losses"`
	Abandoned          int       `json:"abandoned"`
}

type UpdatePreferencesRequest struct {
	LanguagePreference string `json:"languagePreference"`
}

// MatchPlayer is the per-seat participant embedded in a match list item.
type MatchPlayer struct {
	Seat     int    `json:"seat"`
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
}

// MatchHandView is the per-hand scoring breakdown embedded in a match list item.
type MatchHandView struct {
	HandNumber      int  `json:"handNumber"`
	RedCardPoints   int  `json:"redCardPoints"`
	BlueCardPoints  int  `json:"blueCardPoints"`
	RedDeclPoints   int  `json:"redDeclPoints"`
	BlueDeclPoints  int  `json:"blueDeclPoints"`
	LastTrickTeam   int  `json:"lastTrickTeam"`
	LastTrickBonus  int  `json:"lastTrickBonus"`
	Capot           bool `json:"capot"`
	CapotTeam       *int `json:"capotTeam,omitempty"`
	CapotBonus      int  `json:"capotBonus"`
	FailedContract  bool `json:"failedContract"`
	ContractingTeam int  `json:"contractingTeam"`
	RedHandTotal    int  `json:"redHandTotal"`
	BlueHandTotal   int  `json:"blueHandTotal"`
}

// MatchListItem is the per-match DTO returned by GET /users/:id/matches.
type MatchListItem struct {
	ID            uint            `json:"id"`
	Variant       string          `json:"variant"`
	MatchMode     string          `json:"matchMode"`
	StartedAt     time.Time       `json:"startedAt"`
	CompletedAt   time.Time       `json:"completedAt"`
	Status        string          `json:"status"`
	WinnerTeam    int             `json:"winnerTeam"`
	TeamRedScore  int             `json:"teamRedScore"`
	TeamBlueScore int             `json:"teamBlueScore"`
	AbandonedBy   *uint           `json:"abandonedBy,omitempty"`
	ViewerSeat    int             `json:"viewerSeat"`
	Outcome       string          `json:"outcome"`
	Players       []MatchPlayer   `json:"players"`
	Hands         []MatchHandView `json:"hands"`
}

// MatchesListResponse is the envelope returned by GET /users/:id/matches.
type MatchesListResponse struct {
	Items  []MatchListItem `json:"items"`
	Total  int64           `json:"total"`
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
}

type UserHandler struct {
	userRepo  UserRepository
	matchRepo match.MatchRepository
}

func NewUserHandler(userRepo UserRepository, matchRepo match.MatchRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo, matchRepo: matchRepo}
}

func getUserID(c echo.Context) (uint, error) {
	val := c.Get("userID")
	if val == nil {
		return 0, fmt.Errorf("userID not found in context")
	}
	userID, ok := val.(uint)
	if !ok {
		return 0, fmt.Errorf("userID has unexpected type")
	}
	return userID, nil
}

func (h *UserHandler) GetProfile(c echo.Context) error {
	authUserID, err := getUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	paramID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || paramID == 0 {
		return apperr.ErrBadRequest
	}

	if uint(paramID) != authUserID {
		return apperr.ErrForbidden
	}

	u, err := h.userRepo.FindByID(authUserID)
	if err != nil {
		return fmt.Errorf("finding user: %w", err)
	}
	if u == nil {
		return apperr.ErrUserNotFound
	}

	wins, losses, abandoned, err := h.matchRepo.GetStatsForUser(authUserID)
	if err != nil {
		return fmt.Errorf("fetching profile stats: %w", err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": ProfileResponse{
			ID:                 u.ID,
			Username:           u.Username,
			LanguagePreference: u.LanguagePreference,
			CreatedAt:          u.CreatedAt,
			TotalGamesPlayed:   wins + losses + abandoned,
			Wins:               wins,
			Losses:             losses,
			Abandoned:          abandoned,
		},
	})
}

func (h *UserHandler) UpdatePreferences(c echo.Context) error {
	authUserID, err := getUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	paramID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || paramID == 0 {
		return apperr.ErrBadRequest
	}

	if uint(paramID) != authUserID {
		return apperr.ErrForbidden
	}

	var req UpdatePreferencesRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}

	if req.LanguagePreference != "en" && req.LanguagePreference != "sr" {
		return apperr.ErrInvalidLanguage
	}

	if err := h.userRepo.UpdateLanguagePreference(authUserID, req.LanguagePreference); err != nil {
		return fmt.Errorf("updating language preference: %w", err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]string{
			"languagePreference": req.LanguagePreference,
		},
	})
}

// ListMatches returns a paginated, newest-first list of matches in which the
// authenticated user participated. Query params:
//
//	limit  — 1..50 (default 20)
//	offset — >= 0  (default 0)
//
// Authorisation mirrors GetProfile: the :id path param must equal the
// authenticated user's ID. Responses never leak email, password hash, or
// language preference — only the 4 participant usernames + ids are included.
func (h *UserHandler) ListMatches(c echo.Context) error {
	authUserID, err := getUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	paramID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || paramID == 0 {
		return apperr.ErrBadRequest
	}
	if uint(paramID) != authUserID {
		return apperr.ErrForbidden
	}

	limit, offset, err := parseMatchesPagination(c)
	if err != nil {
		return err
	}

	matches, total, err := h.matchRepo.GetMatchesForUser(authUserID, limit, offset)
	if err != nil {
		return fmt.Errorf("fetching matches: %w", err)
	}

	usernames, err := h.loadUsernamesForMatches(matches)
	if err != nil {
		return fmt.Errorf("loading match usernames: %w", err)
	}

	items := make([]MatchListItem, 0, len(matches))
	for _, m := range matches {
		items = append(items, buildMatchListItem(m, authUserID, usernames))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": MatchesListResponse{
			Items:  items,
			Total:  total,
			Limit:  limit,
			Offset: offset,
		},
	})
}

// parseMatchesPagination reads the limit/offset query params and applies the
// documented bounds. Returns apperr.ErrBadRequest on any violation.
func parseMatchesPagination(c echo.Context) (int, int, error) {
	const defaultLimit = 20
	const maxLimit = 50

	limit := defaultLimit
	if raw := c.QueryParam("limit"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 1 || v > maxLimit {
			return 0, 0, apperr.ErrBadRequest
		}
		limit = v
	}

	offset := 0
	if raw := c.QueryParam("offset"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 0 {
			return 0, 0, apperr.ErrBadRequest
		}
		offset = v
	}

	return limit, offset, nil
}

// loadUsernamesForMatches gathers all participant IDs across the page and
// issues a single batched query via userRepo.FindManyByIDs. Returns a map
// keyed by userID so callers can project the 4 seats per match in O(1).
func (h *UserHandler) loadUsernamesForMatches(matches []match.Match) (map[uint]string, error) {
	if len(matches) == 0 {
		return map[uint]string{}, nil
	}
	seen := make(map[uint]struct{}, len(matches)*4)
	ids := make([]uint, 0, len(matches)*4)
	for _, m := range matches {
		for _, id := range [4]uint{m.Player1ID, m.Player2ID, m.Player3ID, m.Player4ID} {
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	users, err := h.userRepo.FindManyByIDs(ids)
	if err != nil {
		return nil, err
	}
	result := make(map[uint]string, len(users))
	for _, u := range users {
		result[u.ID] = u.Username
	}
	return result, nil
}

// teamForSeat returns 0 for Red, 1 for Blue — seats 0/2 are Red, 1/3 are Blue.
// Duplicated locally instead of importing the game package to keep the user
// package free of game-engine coupling.
func teamForSeat(seat int) int { return seat % 2 }

// buildMatchListItem projects a DB Match + preloaded Hands into the viewer-
// specific response DTO (derives viewerSeat and outcome server-side).
func buildMatchListItem(m match.Match, viewerID uint, usernames map[uint]string) MatchListItem {
	seats := [4]uint{m.Player1ID, m.Player2ID, m.Player3ID, m.Player4ID}
	viewerSeat := 0
	for i, id := range seats {
		if id == viewerID {
			viewerSeat = i
			break
		}
	}

	players := make([]MatchPlayer, 0, 4)
	for i, id := range seats {
		players = append(players, MatchPlayer{
			Seat:     i,
			UserID:   id,
			Username: usernames[id],
		})
	}

	outcome := "loss"
	if m.Status == "abandoned" {
		outcome = "abandoned"
	} else if m.Status == "completed" && m.WinnerTeam == teamForSeat(viewerSeat) {
		outcome = "win"
	}

	hands := make([]MatchHandView, 0, len(m.Hands))
	for _, h := range m.Hands {
		var capotTeam *int
		if h.CapotTeam != nil {
			v := *h.CapotTeam
			capotTeam = &v
		}
		hands = append(hands, MatchHandView{
			HandNumber:      h.HandNumber,
			RedCardPoints:   h.RedCardPoints,
			BlueCardPoints:  h.BlueCardPoints,
			RedDeclPoints:   h.RedDeclPoints,
			BlueDeclPoints:  h.BlueDeclPoints,
			LastTrickTeam:   h.LastTrickTeam,
			LastTrickBonus:  h.LastTrickBonus,
			Capot:           h.Capot,
			CapotTeam:       capotTeam,
			CapotBonus:      h.CapotBonus,
			FailedContract:  h.FailedContract,
			ContractingTeam: h.ContractingTeam,
			RedHandTotal:    h.RedHandTotal,
			BlueHandTotal:   h.BlueHandTotal,
		})
	}

	return MatchListItem{
		ID:            m.ID,
		Variant:       m.Variant,
		MatchMode:     m.MatchMode,
		StartedAt:     m.StartedAt,
		CompletedAt:   m.CompletedAt,
		Status:        m.Status,
		WinnerTeam:    m.WinnerTeam,
		TeamRedScore:  m.TeamRedScore,
		TeamBlueScore: m.TeamBlueScore,
		AbandonedBy:   m.AbandonedBy,
		ViewerSeat:    viewerSeat,
		Outcome:       outcome,
		Players:       players,
		Hands:         hands,
	}
}
