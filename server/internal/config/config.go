package config

import (
	"log/slog"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	Port        string
	CORSOrigins []string
	Environment string
}

func Load() *Config {
	cfg := &Config{
		DatabaseURL: getEnv("BELJOT_DB_URL", "postgres://beljot:beljot_dev_password@localhost:5433/beljot?sslmode=disable"),
		JWTSecret:   getEnv("BELJOT_JWT_SECRET", "change-me-in-production"),
		Port:        getEnv("BELJOT_PORT", "8080"),
		CORSOrigins: parseOrigins(getEnv("BELJOT_CORS_ORIGINS", "http://localhost:5173")),
		Environment: getEnv("BELJOT_ENV", "development"),
	}

	if cfg.JWTSecret == "" || cfg.JWTSecret == "change-me-in-production" {
		if cfg.Environment != "development" {
			slog.Error("BELJOT_JWT_SECRET must be set to a secure value in non-development environments")
			os.Exit(1)
		}
		slog.Warn("BELJOT_JWT_SECRET is not set or uses the default value — do not deploy to production without changing it")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func parseOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}
