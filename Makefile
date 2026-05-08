.PHONY: dev build test lint migrate seed deploy backup

-include .env
export

dev:
	docker compose up -d
	@echo "PostgreSQL started on port 5433"
	trap 'kill 0' EXIT; \
	cd client && npm run dev & \
	cd server && go run cmd/api/main.go

build:
	cd client && npm run build
	cd server && go build -o bin/api cmd/api/main.go

test:
	cd client && npx vitest run
	cd server && go test ./...

lint:
	cd client && npx eslint . && npx prettier --check .
	cd server && golangci-lint run ./...

migrate:
	migrate -path server/migrations -database "$(BELJOT_DB_URL)" up

seed:
	@echo "Seed script not yet implemented"

deploy:
	bash scripts/deploy.sh

backup:
	bash scripts/backup-db.sh
