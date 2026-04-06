# Story 1.1: Project Scaffold & Development Environment

Status: ready-for-dev

## Story

As a developer,
I want a fully configured monorepo with React frontend, Go backend, PostgreSQL database, CI pipeline, and design system foundations,
so that I can begin building features on a solid, consistent development environment.

## Acceptance Criteria

1. **Given** the project is initialized from scratch
   **When** I run the scaffold setup commands per Architecture spec
   **Then** the monorepo contains `client/` (Vite react-swc-ts template) and `server/` (Go module with Echo v4, GORM, coder/websocket dependencies)
   **And** `npx shadcn@latest init` has been run, with base components (Button, Dialog, Input, Tabs, Toast, Tooltip) added and themed to the Balatro design token set

2. **Given** the monorepo is set up
   **When** I inspect the Makefile
   **Then** it includes working targets: `dev` (concurrent client + server), `build`, `test`, `lint`, `migrate`, `seed`

3. **Given** Docker Compose is configured
   **When** I run `make dev`
   **Then** PostgreSQL starts in a Docker container on port 5432, Vite dev server runs on port 5173 with HMR, and the Go server runs natively on port 8080 with a `/health` endpoint returning 200

4. **Given** the CI pipeline is configured
   **When** code is pushed to GitHub
   **Then** GitHub Actions runs `make test` and `make lint` and blocks merge on failure

5. **Given** the Tailwind config is set up
   **When** I inspect `client/src/index.css` and Tailwind configuration
   **Then** the Balatro design tokens are defined: `background` (#0a0a0f), `surface` (#13131a), `surface-elevated` (#1c1c26), `border` (#2a2a38), `accent` (#00e5a0), `accent-glow`, `team-red` (#ff4d4d), `team-blue` (#4d9fff), `text-primary` (#f0f0f8), `text-secondary` (#8888a0), `text-disabled` (#44445a), `success`, `warning`, `destructive`
   **And** Space Grotesk and Inter fonts are loaded from Google Fonts

6. **Given** i18n is configured
   **When** I inspect the i18n setup
   **Then** react-i18next is initialized with `en.json` and `sr.json` translation files in `shared/i18n/`, with a working translation hook (`useTranslation`)

7. **Given** frontend tooling is configured
   **When** I run `make lint`
   **Then** ESLint + Prettier run on all TypeScript files and golangci-lint runs on all Go files

8. **Given** the database migration system is set up
   **When** I run `make migrate`
   **Then** golang-migrate executes SQL migration files from `server/migrations/` against the PostgreSQL instance

9. **Given** React Router v7 is installed
   **When** I inspect `App.tsx`
   **Then** base route structure is defined with placeholder routes for `/login`, `/register`, `/lobby`, `/profile`, `/game`

## Tasks / Subtasks

- [ ] **Task 1: Initialize monorepo root** (AC: 2, 3)
  - [ ] Create root `Makefile` with targets: `dev`, `build`, `test`, `lint`, `migrate`, `seed`, `deploy`, `backup`
  - [ ] Create `.env.example` with all env vars (`BELOTE_DB_URL`, `BELOTE_JWT_SECRET`, `BELOTE_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) and placeholder values
  - [ ] Create `.gitignore` (node_modules, dist, .env, Go binaries, IDE files)
  - [ ] Create `docker-compose.yml` for local dev: PostgreSQL only on port 5432
  - [ ] Create `docker-compose.prod.yml` skeleton for production: Go app + PostgreSQL containers
  - [ ] Create `Caddyfile` skeleton for production reverse proxy
  - [ ] Create `scripts/deploy.sh` placeholder
  - [ ] Create `scripts/backup-db.sh` placeholder

- [ ] **Task 2: Initialize frontend (`client/`)** (AC: 1, 5)
  - [ ] Run `npm create vite@latest client -- --template react-swc-ts`
  - [ ] Install core dependencies: `react-router`, `zustand`, `react-i18next`, `i18next`
  - [ ] Install dev dependencies: `@tailwindcss/vite`, `eslint`, `prettier`, `@types/react`, `@types/react-dom`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
  - [ ] Configure `vite.config.ts` with `@tailwindcss/vite` plugin and proxy for `/api` and `/ws` to `localhost:8080`
  - [ ] Configure `tsconfig.json` with strict mode, path aliases (`@/` -> `src/`)
  - [ ] Configure `eslint.config.js` with TypeScript, React, import ordering rules, named exports only
  - [ ] Configure `.prettierrc`

- [ ] **Task 3: Set up Tailwind CSS v4 design tokens** (AC: 5)
  - [ ] Configure `client/src/index.css` with Tailwind v4 `@import "tailwindcss"` and `@theme` directive
  - [ ] Define all Balatro design tokens inside `@theme`:
    - `--color-background: #0a0a0f`
    - `--color-surface: #13131a`
    - `--color-surface-elevated: #1c1c26`
    - `--color-border: #2a2a38`
    - `--color-accent: #00e5a0`
    - `--color-accent-glow: #00e5a040` (40% opacity for glow effects)
    - `--color-team-red: #ff4d4d`
    - `--color-team-blue: #4d9fff`
    - `--color-text-primary: #f0f0f8`
    - `--color-text-secondary: #8888a0`
    - `--color-text-disabled: #44445a`
    - `--color-success: #22c55e`
    - `--color-warning: #eab308`
    - `--color-destructive: #ef4444`
  - [ ] Load Google Fonts: Space Grotesk (display/headings) and Inter (body/UI) via `@import` or `<link>` in `index.html`
  - [ ] Define font tokens: `--font-display: 'Space Grotesk', sans-serif` and `--font-body: 'Inter', sans-serif`

- [ ] **Task 4: Initialize shadcn/ui** (AC: 1)
  - [ ] Run `npx shadcn@latest init` in `client/` directory
  - [ ] Configure shadcn to use `src/shared/components/ui/` as the components directory
  - [ ] Add base components: `npx shadcn@latest add button dialog input tabs toast tooltip`
  - [ ] Verify components are themed using the Balatro CSS variables from `index.css`

- [ ] **Task 5: Create frontend directory structure** (AC: 1, 9)
  - [ ] Create feature directories: `src/features/auth/`, `src/features/game/`, `src/features/lobby/`, `src/features/profile/`, `src/features/chat/`
  - [ ] Create shared directories: `src/shared/components/`, `src/shared/hooks/`, `src/shared/stores/`, `src/shared/types/`, `src/shared/api/`, `src/shared/i18n/`
  - [ ] Create placeholder Zustand stores: `authStore.ts`, `lobbyStore.ts`, `gameStore.ts`, `chatStore.ts` — each with the standard interface shape (`state + isLoading + actions`)
  - [ ] Create `fetchClient.ts` skeleton in `shared/api/` with auth header injection placeholder
  - [ ] Create placeholder type files: `wsEvents.ts`, `gameTypes.ts`, `apiTypes.ts` in `shared/types/`

- [ ] **Task 6: Set up React Router v7 and App shell** (AC: 9)
  - [ ] Configure `App.tsx` with `BrowserRouter` and route definitions for: `/login`, `/register`, `/lobby`, `/profile`, `/game`
  - [ ] Create placeholder page components: `LoginPage.tsx`, `RegisterPage.tsx`, `LobbyPage.tsx`, `ProfilePage.tsx`, `GamePage.tsx`
  - [ ] Add `ErrorBoundary.tsx` in `shared/components/`
  - [ ] Wrap app in ErrorBoundary in `App.tsx`

- [ ] **Task 7: Set up i18n** (AC: 6)
  - [ ] Create `shared/i18n/i18n.ts` configuration file initializing i18next with `initReactI18next`
  - [ ] Create `shared/i18n/en.json` with skeleton keys: `{ "common": { "appName": "Belote" } }`
  - [ ] Create `shared/i18n/sr.json` with matching skeleton keys: `{ "common": { "appName": "Belote" } }`
  - [ ] Import i18n configuration in `main.tsx`
  - [ ] Verify `useTranslation` hook works in a placeholder component

- [ ] **Task 8: Initialize backend (`server/`)** (AC: 1, 3)
  - [ ] Run `go mod init github.com/emilijan/belote/server` (or appropriate module path)
  - [ ] Install dependencies: `go get github.com/labstack/echo/v4`, `go get gorm.io/gorm`, `go get gorm.io/driver/postgres`, `go get nhooyr.io/websocket`, `go get github.com/stretchr/testify`
  - [ ] Create directory structure:
    - `server/cmd/api/main.go` — entrypoint
    - `server/internal/apperr/errors.go` — centralized app errors
    - `server/internal/config/config.go` — config struct loaded from env vars
    - `server/internal/auth/` — placeholder package
    - `server/internal/game/` — placeholder package
    - `server/internal/game/testfixtures/` — placeholder for test factories
    - `server/internal/session/` — placeholder package
    - `server/internal/ws/` — placeholder package (including `events.go` skeleton)
    - `server/internal/lobby/` — placeholder package
    - `server/internal/chat/` — placeholder package
    - `server/internal/user/` — placeholder package
    - `server/migrations/` — empty directory for SQL migrations

- [ ] **Task 9: Implement Go server entrypoint** (AC: 3)
  - [ ] Create `cmd/api/main.go`:
    - Load config from environment via `config.Config` struct
    - Initialize Echo v4 instance
    - Register middleware: CORS (specific origin) -> Logger (slog) -> Error Handler -> (Auth placeholder)
    - Register `/health` endpoint returning `200 OK` with `{ "status": "ok" }`
    - Start server on `BELOTE_PORT` (default 8080)
  - [ ] Create `config/config.go` with `Load()` function reading from env vars (`BELOTE_DB_URL`, `BELOTE_JWT_SECRET`, `BELOTE_PORT`)
  - [ ] Create `apperr/errors.go` with `AppError` type, `NewAppError()` constructor, and initial error: `ErrInternal`
  - [ ] Create Echo error handler middleware that maps `AppError` to structured JSON responses

- [ ] **Task 10: Set up database and migrations** (AC: 8)
  - [ ] Configure GORM connection in `main.go` using `BELOTE_DB_URL`
  - [ ] Create first migration `server/migrations/000001_init.up.sql` (empty or with placeholder comment)
  - [ ] Create `server/migrations/000001_init.down.sql`
  - [ ] Add `make migrate` target that runs `migrate -path server/migrations -database $BELOTE_DB_URL up`
  - [ ] Verify `make migrate` executes successfully against Docker PostgreSQL

- [ ] **Task 11: Set up CI pipeline** (AC: 4)
  - [ ] Create `.github/workflows/ci.yml`:
    - Trigger on push to all branches
    - Set up Go (pinned version), Node (pinned version), PostgreSQL service
    - Install `golangci-lint`
    - Run `make test` and `make lint`
    - Block merge on failure
  - [ ] Create `.golangci.yml` linter configuration

- [ ] **Task 12: Set up Makefile `dev` target** (AC: 2, 3)
  - [ ] Implement `make dev` to run concurrently:
    - `docker compose up -d` (PostgreSQL)
    - `cd client && npm run dev` (Vite on port 5173)
    - `cd server && go run cmd/api/main.go` (Echo on port 8080)
  - [ ] Implement `make build`: `cd client && npm run build` + `cd server && go build -o bin/api cmd/api/main.go`
  - [ ] Implement `make test`: `cd client && npx vitest run` + `cd server && go test ./...`
  - [ ] Implement `make lint`: `cd client && npx eslint . && npx prettier --check .` + `cd server && golangci-lint run ./...`
  - [ ] Implement `make seed` placeholder

- [ ] **Task 13: Verify end-to-end dev workflow** (AC: all)
  - [ ] Run `make dev` and confirm: PostgreSQL on 5432, Vite on 5173 with HMR, Go server on 8080
  - [ ] Hit `http://localhost:8080/health` and confirm `200` with `{ "status": "ok" }`
  - [ ] Confirm Vite proxy forwards `/api/*` to Go server
  - [ ] Run `make test` — both frontend (Vitest) and backend (Go) pass
  - [ ] Run `make lint` — both ESLint/Prettier and golangci-lint pass
  - [ ] Run `make migrate` — golang-migrate runs against PostgreSQL
  - [ ] Confirm shadcn/ui components render with Balatro theming
  - [ ] Confirm `useTranslation` hook returns correct strings for EN and SR

## Dev Notes

### Architecture Compliance

- **Monorepo layout**: `client/` (React SPA) + `server/` (Go module) at root, orchestrated by `Makefile`
- **No shared type generation** between frontend/backend — manual sync via `wsEvents.ts` + `events.go`
- **Docker Compose for dev**: PostgreSQL ONLY in Docker; Go server and Vite run natively on host for hot reload
- **Production topology**: Host Caddy -> Docker Go container -> Docker PostgreSQL container. Go server does NOT serve static files in production
- **Environment variables**: `SCREAMING_SNAKE_CASE`, app vars prefixed `BELOTE_`, loaded once at startup into `config.Config` struct — no `os.Getenv()` elsewhere

### Technical Stack Versions (Verified April 2026)

**Frontend:**
- **Vite 8** — uses Rolldown (Rust bundler), 10-30x faster builds. Template: `npm create vite@latest client -- --template react-swc-ts`. Note: `@vitejs/plugin-react` v6 uses Oxc for React Refresh (Babel no longer a dependency)
- **React 19** + TypeScript strict mode, compiled via SWC
- **Tailwind CSS v4** — CSS-first config via `@theme` directive in `index.css`. **No `tailwind.config.js` file.** All tokens defined in CSS. Use `@tailwindcss/vite` plugin
- **shadcn/ui CLI v4** (March 2026) — `npx shadcn@latest init` supports Vite templates directly. Use `--base` flag if prompted for primitives selection. Components install to `src/shared/components/ui/`
- **React Router v7** — standard client-side routing
- **Zustand** — 4 partitioned stores (auth, lobby, game, chat)
- **react-i18next** — install `react-i18next` + `i18next`. JSON translation files. Configure with `initReactI18next`
- **Vitest** — Vite-native testing, Jest-compatible API
- **Node 18+** required

**Backend:**
- **Go** latest stable — pin exact version in `go.mod`
- **Echo v4** — Do NOT use v5. Pin to latest v4.x
- **GORM** + PostgreSQL driver (`gorm.io/gorm` + `gorm.io/driver/postgres`)
- **nhooyr.io/websocket** — import path is `nhooyr.io/websocket`, actual repo at `github.com/coder/websocket`. `go get nhooyr.io/websocket` resolves correctly
- **golang-migrate** — CLI only, NOT embedded as Go library. Install via `go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`
- **testify** — assertion library
- **slog** (stdlib) — structured JSON logging to stdout
- **bcrypt** — `golang.org/x/crypto/bcrypt` for password hashing (placeholder in this story, used in Story 1.2)

**Infrastructure:**
- **Docker Compose** — PostgreSQL 16+ container for dev
- **GitHub Actions** — CI with `make test` + `make lint`

### Tailwind v4 Critical Notes

Tailwind v4 has NO `tailwind.config.js`. Configuration is entirely in CSS:

```css
@import "tailwindcss";

@theme {
  --color-background: #0a0a0f;
  --color-surface: #13131a;
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  /* ...all tokens here */
}
```

Use `@theme` for design tokens that should generate utility classes (e.g., `bg-background`, `text-accent`). Use `:root` for CSS variables that shouldn't generate utilities.

### shadcn/ui Setup Notes

- shadcn CLI v4 now supports Vite templates directly during init
- Components are copied into `src/shared/components/ui/` — they are owned code, not dependencies
- NEVER create UI primitive files manually — always use `npx shadcn@latest add <component>`
- Style shadcn components via Tailwind classes and CSS variables in consuming components
- Only modify `shared/components/ui/` source for project-wide design token changes

### Backend Domain Package Shape

Every domain package follows:
```
internal/{domain}/
  model.go          # GORM model + domain struct
  repository.go     # Repository interface
  gorm_repo.go      # GORM implementation
  handler.go        # Echo HTTP handlers
  service.go        # Business logic (if needed)
  {domain}_test.go  # Tests
```

For this story, create placeholder files for: `auth/`, `user/`, `game/`, `session/`, `ws/`, `lobby/`, `chat/`. Full implementation comes in later stories.

### Middleware Order (Load-Bearing)

Registration order in `main.go` is critical: **CORS -> Logging -> Error Handler -> Auth**. New middleware must be inserted at the correct position.

### Naming Conventions Summary

| Context | Convention | Examples |
|---------|-----------|----------|
| Database tables | `snake_case`, plural | `users`, `matches`, `rooms` |
| JSON wire format | `camelCase` | `createdAt`, `playerId` |
| REST endpoints | plural, kebab-case | `/api/v1/rooms` |
| WS events | prefixed `snake_case` | `action:play_card`, `event:game_state` |
| Frontend components | `PascalCase.tsx` | `PlayingCard.tsx` |
| Frontend hooks/stores | `camelCase.ts` | `useAuth.ts`, `gameStore.ts` |
| Backend files | `snake_case.go` | `rules_engine.go` |
| i18n keys | `{feature}.{component}.{element}` | `auth.login.emailLabel` |
| Branch naming | `{type}/{epic-id}-{description}` | `chore/E1-S1-project-scaffold` |
| Commits | `{type}({scope}): {desc}` | `feat(scaffold): initialize monorepo` |

### Critical Don'ts for This Story

- Do NOT create a `tailwind.config.js` — Tailwind v4 uses CSS-first configuration
- Do NOT install `@vitejs/plugin-react-swc` separately — Vite 8 react-swc-ts template includes it
- Do NOT embed golang-migrate as a Go library — use CLI only via Makefile
- Do NOT put game logic anywhere — this story is infrastructure only
- Do NOT use `gorilla/websocket` — use `nhooyr.io/websocket` (coder/websocket)
- Do NOT use `export default` in TypeScript — named exports only
- Do NOT store any secrets in the repository — `.env.example` with placeholders only
- Do NOT upgrade Echo to v5 — use v4 explicitly

### Project Structure Notes

Alignment with the architecture's complete directory structure:

```
belote/
  Makefile
  Caddyfile
  docker-compose.yml
  docker-compose.prod.yml
  .env.example
  .gitignore
  .github/workflows/ci.yml
  .golangci.yml
  scripts/deploy.sh
  scripts/backup-db.sh
  client/
    package.json
    vite.config.ts
    tsconfig.json
    eslint.config.js
    .prettierrc
    index.html
    src/
      main.tsx
      App.tsx
      index.css                   # Tailwind v4 + @theme design tokens
      features/
        auth/                     # Placeholder pages
        game/
        lobby/
        profile/
        chat/
      shared/
        components/
          ui/                     # shadcn/ui components (CLI-installed)
          ErrorBoundary.tsx
        hooks/
        stores/
          authStore.ts
          lobbyStore.ts
          gameStore.ts
          chatStore.ts
        types/
          wsEvents.ts             # WS event contract (TS side)
          gameTypes.ts
          apiTypes.ts
        api/
          fetchClient.ts
        i18n/
          i18n.ts                 # i18next configuration
          en.json
          sr.json
  server/
    go.mod
    go.sum
    cmd/api/main.go
    internal/
      config/config.go
      apperr/errors.go
      auth/
      user/
      game/
        testfixtures/
      session/
      ws/
        events.go                 # WS event contract (Go side)
      lobby/
      chat/
    migrations/
      000001_init.up.sql
      000001_init.down.sql
```

### References

- [Source: architecture.md#Starter-Template-Evaluation] — initialization commands and starter selection
- [Source: architecture.md#Core-Architectural-Decisions] — auth, data, API, frontend, backend, infra decisions
- [Source: architecture.md#Implementation-Patterns] — naming, structure, format, communication patterns
- [Source: architecture.md#Project-Structure-and-Boundaries] — complete directory tree
- [Source: epics.md#Story-1.1] — acceptance criteria and story definition
- [Source: prd.md#Web-Application-Requirements] — SPA requirements, browser support, real-time architecture
- [Source: ux-design-specification.md#Design-System-Foundation] — Tailwind + shadcn/ui rationale, design tokens
- [Source: project-context.md] — all critical implementation rules and anti-patterns

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
