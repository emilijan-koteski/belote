package auth

import (
	"fmt"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/user"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterResponseData struct {
	ID                 uint      `json:"id"`
	Username           string    `json:"username"`
	Email              string    `json:"email"`
	LanguagePreference string    `json:"languagePreference"`
	CreatedAt          time.Time `json:"createdAt"`
	Token              string    `json:"token"`
}

type AuthHandler struct {
	userRepo  user.UserRepository
	jwtSecret string
}

func NewAuthHandler(userRepo user.UserRepository, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return apperr.ErrBadRequest
	}

	if err := validateRegisterRequest(&req); err != nil {
		return err
	}

	existing, err := h.userRepo.FindByEmail(req.Email)
	if err != nil {
		return fmt.Errorf("checking email: %w", err)
	}
	if existing != nil {
		return apperr.ErrEmailTaken
	}

	existing, err = h.userRepo.FindByUsername(req.Username)
	if err != nil {
		return fmt.Errorf("checking username: %w", err)
	}
	if existing != nil {
		return apperr.ErrUsernameTaken
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	u := &user.User{
		Email:              req.Email,
		Username:           req.Username,
		PasswordHash:       hash,
		LanguagePreference: "en",
	}

	if err := h.userRepo.Create(u); err != nil {
		return fmt.Errorf("creating user: %w", err)
	}

	accessToken, err := GenerateAccessToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken(u.ID, h.jwtSecret)
	if err != nil {
		return fmt.Errorf("generating refresh token: %w", err)
	}

	c.SetCookie(&http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/api/v1/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   7 * 24 * 60 * 60,
	})

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": RegisterResponseData{
			ID:                 u.ID,
			Username:           u.Username,
			Email:              u.Email,
			LanguagePreference: u.LanguagePreference,
			CreatedAt:          u.CreatedAt,
			Token:              accessToken,
		},
	})
}

func validateRegisterRequest(req *RegisterRequest) error {
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		return apperr.ErrInvalidEmail
	}
	addr, err := mail.ParseAddress(req.Email)
	if err != nil {
		return apperr.ErrInvalidEmail
	}
	req.Email = strings.ToLower(addr.Address)

	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 {
		return apperr.ErrUsernameTooShort
	}
	if len(req.Username) > 20 {
		return apperr.ErrUsernameTooLong
	}
	if !usernameRegex.MatchString(req.Username) {
		return apperr.ErrUsernameInvalidChars
	}

	if len(req.Password) < 8 {
		return apperr.ErrPasswordTooShort
	}
	if len(req.Password) > 72 {
		return apperr.ErrPasswordTooLong
	}

	return nil
}
