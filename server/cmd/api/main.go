package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/emilijan/belote/server/internal/apperr"
	"github.com/emilijan/belote/server/internal/auth"
	"github.com/emilijan/belote/server/internal/chat"
	"github.com/emilijan/belote/server/internal/config"
	"github.com/emilijan/belote/server/internal/match"
	"github.com/emilijan/belote/server/internal/room"
	"github.com/emilijan/belote/server/internal/session"
	"github.com/emilijan/belote/server/internal/user"
	"github.com/emilijan/belote/server/internal/ws"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: gormlogger.New(
			log.New(os.Stdout, "", log.LstdFlags),
			gormlogger.Config{
				SlowThreshold:             200 * time.Millisecond,
				IgnoreRecordNotFoundError: true,
				LogLevel:                  gormlogger.Warn,
			},
		),
	})
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	userRepo := user.NewGormUserRepository(db)
	authHandler := auth.NewAuthHandler(userRepo, cfg.JWTSecret, cfg.Environment)

	e := echo.New()
	e.HideBanner = true

	// Middleware registration order is load-bearing: CORS -> Logging -> Error Handler -> Auth
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus: true,
		LogURI:    true,
		LogMethod: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			slog.Info("request",
				"method", v.Method,
				"uri", v.URI,
				"status", v.Status,
			)
			return nil
		},
	}))

	e.HTTPErrorHandler = appErrorHandler

	// Routes
	e.GET("/health", healthHandler)

	// Auth routes — public, no auth middleware
	authGroup := e.Group("/api/v1/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)

	// Authenticated route group
	userHandler := user.NewUserHandler(userRepo)
	api := e.Group("/api/v1", auth.AuthMiddleware(cfg.JWTSecret))
	api.GET("/users/:id/profile", userHandler.GetProfile)
	api.PATCH("/users/:id/preferences", userHandler.UpdatePreferences)

	// WebSocket hub and endpoint
	hub := ws.NewHub()
	go hub.Run()
	wsHandler := &ws.WSHandler{
		Hub:            hub,
		JWTSecret:      cfg.JWTSecret,
		AcceptedOrigins: cfg.CORSOrigins,
	}
	e.GET("/ws", wsHandler.HandleWS)

	// Session manager + room repo (repo needed before handler wiring)
	matchRepo := match.NewGormMatchRepository(db)
	roomRepo := room.NewGormRepository(db)
	sessionManager := session.NewManager(hub, matchRepo)
	sessionManager.SetRoomUpdater(&room.RoomStatusAdapter{Repo: roomRepo})

	// Chat handler — composed with sessionManager.HandleAction so a single
	// hub action handler can route both game actions and chat messages.
	chatHandler := chat.NewHandler(hub, userRepo, sessionManager)
	hub.SetActionHandler(func(client *ws.Client, msg ws.WSMessage) {
		if msg.Type == ws.ActionChatMessage {
			chatHandler.HandleAction(client, msg)
			return
		}
		sessionManager.HandleAction(client, msg)
	})

	// Lobby disconnect handler — frees seats after 10s when players disconnect in room lobby
	lobbyDisconnectHandler := room.NewLobbyDisconnectHandler(roomRepo, hub)
	hub.SetConnectHandler(func(userID uint) {
		sessionManager.HandleReconnect(userID)
		lobbyDisconnectHandler.HandleReconnect(userID)
	})
	hub.SetDisconnectHandler(func(userID uint) {
		sessionManager.HandleDisconnect(userID)
		lobbyDisconnectHandler.HandleDisconnect(userID)
	})

	// Room routes
	roomHandler := room.NewRoomHandler(roomRepo, sessionManager, hub)
	api.POST("/rooms", roomHandler.CreateRoom)
	api.GET("/rooms", roomHandler.ListRooms)
	api.POST("/rooms/quick-play", roomHandler.QuickPlay)
	api.GET("/rooms/code/:code", roomHandler.GetRoomByCode)
	api.GET("/rooms/:id", roomHandler.GetRoom)
	api.POST("/rooms/:id/join", roomHandler.JoinRoom)
	api.POST("/rooms/:id/leave", roomHandler.LeaveRoom)
	api.POST("/rooms/:id/seat", roomHandler.SelectSeat)
	api.POST("/rooms/:id/start", roomHandler.StartGame)

	// Graceful shutdown
	go func() {
		slog.Info("starting server", "port", cfg.Port)
		if err := e.Start(":" + cfg.Port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server")
	hub.Shutdown()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}
	slog.Info("server stopped")
}

func healthHandler(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func appErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	var appErr *apperr.AppError
	if errors.As(err, &appErr) {
		if writeErr := c.JSON(appErr.Status, map[string]interface{}{
			"error": map[string]string{
				"code":    appErr.Code,
				"message": appErr.Message,
			},
		}); writeErr != nil {
			slog.Error("failed to write error response", "error", writeErr)
		}
		return
	}

	var echoErr *echo.HTTPError
	if errors.As(err, &echoErr) {
		msg := "An error occurred"
		if m, ok := echoErr.Message.(string); ok {
			msg = m
		}
		if writeErr := c.JSON(echoErr.Code, map[string]interface{}{
			"error": map[string]string{
				"code":    "HTTP_ERROR",
				"message": msg,
			},
		}); writeErr != nil {
			slog.Error("failed to write error response", "error", writeErr)
		}
		return
	}

	slog.Error("unhandled error", "error", err)
	if writeErr := c.JSON(http.StatusInternalServerError, map[string]interface{}{
		"error": map[string]string{
			"code":    apperr.ErrInternal.Code,
			"message": apperr.ErrInternal.Message,
		},
	}); writeErr != nil {
		slog.Error("failed to write error response", "error", writeErr)
	}
}
