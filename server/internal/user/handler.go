package user

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/emilijan/belote/server/internal/apperr"
)

type ProfileResponse struct {
	ID                 uint      `json:"id"`
	Username           string    `json:"username"`
	LanguagePreference string    `json:"languagePreference"`
	CreatedAt          time.Time `json:"createdAt"`
}

type UpdatePreferencesRequest struct {
	LanguagePreference string `json:"languagePreference"`
}

type UserHandler struct {
	userRepo UserRepository
}

func NewUserHandler(userRepo UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
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
	if err != nil {
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

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": ProfileResponse{
			ID:                 u.ID,
			Username:           u.Username,
			LanguagePreference: u.LanguagePreference,
			CreatedAt:          u.CreatedAt,
		},
	})
}

func (h *UserHandler) UpdatePreferences(c echo.Context) error {
	authUserID, err := getUserID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	paramID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
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
