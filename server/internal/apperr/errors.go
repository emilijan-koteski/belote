package apperr

import (
	"fmt"
	"net/http"
)

type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

func (e *AppError) Error() string {
	return e.Message
}

func NewAppError(code string, message string, status int) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

func Wrap(err error, appErr *AppError) error {
	return fmt.Errorf("%s: %w", appErr.Message, err)
}

// Centralized application errors
var (
	ErrInternal     = NewAppError("INTERNAL_ERROR", "An internal error occurred", http.StatusInternalServerError)
	ErrNotFound     = NewAppError("NOT_FOUND", "Resource not found", http.StatusNotFound)
	ErrUnauthorized = NewAppError("UNAUTHORIZED", "Authentication required", http.StatusUnauthorized)
	ErrForbidden    = NewAppError("FORBIDDEN", "Access denied", http.StatusForbidden)
	ErrBadRequest   = NewAppError("BAD_REQUEST", "Invalid request", http.StatusBadRequest)
	ErrConflict     = NewAppError("CONFLICT", "Resource conflict", http.StatusConflict)

	// Auth domain errors
	ErrInvalidCredentials   = NewAppError("INVALID_CREDENTIALS", "invalid email or password", http.StatusUnauthorized)
	ErrEmailTaken           = NewAppError("EMAIL_TAKEN", "email is already registered", http.StatusConflict)
	ErrUsernameTaken        = NewAppError("USERNAME_TAKEN", "username is already taken", http.StatusConflict)
	ErrInvalidEmail         = NewAppError("INVALID_EMAIL", "invalid email format", http.StatusBadRequest)
	ErrPasswordTooShort     = NewAppError("PASSWORD_TOO_SHORT", "password must be at least 8 characters", http.StatusBadRequest)
	ErrPasswordTooLong      = NewAppError("PASSWORD_TOO_LONG", "password must be at most 72 characters", http.StatusBadRequest)
	ErrUsernameTooShort     = NewAppError("USERNAME_TOO_SHORT", "username must be at least 3 characters", http.StatusBadRequest)
	ErrUsernameTooLong      = NewAppError("USERNAME_TOO_LONG", "username must be at most 20 characters", http.StatusBadRequest)
	ErrUsernameInvalidChars = NewAppError("USERNAME_INVALID_CHARS", "username can only contain letters, numbers, and underscores", http.StatusBadRequest)
)
