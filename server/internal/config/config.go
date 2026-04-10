package config

import (
	"os"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	Port        string
}

func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("BELOTE_DB_URL", "postgres://belote:belote_dev_password@localhost:5433/belote?sslmode=disable"),
		JWTSecret:   getEnv("BELOTE_JWT_SECRET", "change-me-in-production"),
		Port:        getEnv("BELOTE_PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
