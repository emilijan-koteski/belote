---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# belote - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for belote, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Players can register a new account using email and password
FR2: Players can log in and maintain authenticated sessions across page refreshes
FR3: Players can authenticate using third-party social login providers (Google, Facebook)
FR4: Players can view their own profile displaying username, level, stats summary, and match history
FR5: Players can search for other players by username
FR6: Players can send, accept, and decline friend requests and maintain a friend list
FR7: The system enforces Bitola variant rules: 3+2 dealing sequence, reshuffle-and-rotate-dealer trump bidding mechanic when no player selects trump in round 2, counter-clockwise play, and variant-specific scoring
FR8: The system enforces Croatian variant rules: 3+2 dealing sequence, forced trump selection by last player in bidding, counter-clockwise play, and variant-specific scoring
FR9: The system validates and scores declarations at the first trick — highest-value set wins ties; only the winning team's declarations count
FR10: The system awards the Belot bonus (K+Q of trump held by same player = 20 pts) when announced during play
FR11: The system applies failed contract scoring: the failing team scores 0 pts and all points transfer to opponents
FR12: The system awards last-trick bonus (+10 pts) to the team winning the final trick, and applies Capot scoring (+100 pts, replacing last-trick bonus) when one team takes all tricks
FR13: The system detects and resolves the instant-win condition when a player holds all 8 trump in sequence
FR14: The system supports 1001-point match mode
FR15: The system supports 501-point match mode
FR16: Players can create a room and configure settings: game variant (Bitola/Croatian), match mode (1001/501), timer style (per-move or relaxed), and reconnect window duration
FR17: Players can browse a searchable list of open rooms by room name or code
FR18: Players can join a room via the browse list or by entering a room name/code directly
FR19: Players can queue for Quick Play to be matched into a random available game
FR20: Players can self-assign to Red or Blue team within a room lobby before a game starts
FR21: Room owners can start the game once all four player slots are filled
FR22: Room owners can override and clear all active player pauses during a match
FR23: Four players can participate in a real-time Belot match with game state continuously synchronized to all participants
FR24: Players can pause an active match (1 pause per player per game; multiple active pauses stack; room owner can override all)
FR25: The system auto-plays the first eligible legal card (sorted by suit then rank) on behalf of a player when their per-move timer expires
FR26: The system detects a player disconnection, pauses the match, and displays a reconnect countdown timer to all remaining players
FR27: A disconnected player can reconnect within the reconnect window and resume from preserved server-side game state
FR28: The system abandons the match and applies appropriate XP/ELO outcomes when the reconnect window expires without reconnection
FR28a: During an active match, a player can initiate a team surrender request; the request is only executed if their teammate accepts it; upon acceptance, the match ends immediately as a win for the opposing team; each player may trigger a surrender request at most once per game
FR29: Players can access an in-app rules reference for both Belot variants from the lobby and during an active match
FR30: All logged-in players can send and receive messages in a global lobby chat
FR31: Players in an active match can send and receive messages in match-scoped chat, visible only to the four match participants
FR32: Players can express reactions during a match using preset in-game emotes
FR33: Players earn XP from completed matches proportional to game points scored in that match
FR34: Players advance through a level system as XP accumulates, with Level 5 unlocking access to ranked mode
FR35: Level 5+ players can queue for ranked competitive matches with ELO-based opponent pairing
FR36: The system conducts 3 placement matches per season before revealing a player's initial rank
FR37: Players can view their current rank tier (8 tiers: Iron → Bronze → Silver → Gold → Platinum → Diamond → Immortal → Radiant)
FR38: The system applies scaled ELO penalties to players who abandon ranked matches, with penalty scaling by game progress at time of abandonment
FR39: Players can view a seasonal leaderboard of top-ranked players
FR40: The system runs quarterly ranked seasons with rank resets; prior season rank history is preserved and viewable
FR41: Players can view their full match history with per-match scoring detail and outcomes
FR42: Players can view career statistics including win/loss record, points scored, and rank history across all seasons
FR43: Remaining players in an abandoned casual match receive partial XP based on game progress at time of abandonment; the abandoning player receives none
FR44: Players can use the platform in English or Serbian (Latin script), with language selectable as a player preference
FR45: The platform supports additional languages (Macedonian, Croatian) as extended language options
FR46: The platform is fully functional on desktop web browsers (Chrome, Firefox, Edge, Safari — latest 2 major versions)
FR47: Players can view public-facing profiles of other players
FR48: Players can observe ongoing matches in spectator/observer mode
FR49: Players can earn and display achievements and badges on their profile
FR50: Players can purchase cosmetic items (card backs, table themes) that have no effect on gameplay
FR51: Players can participate in bracket-style tournament events with seasonal scheduling
FR52: Players can access the platform via a mobile-optimized experience (progressive web app or native client)

### NonFunctional Requirements

NFR1: The per-move timer display must remain synchronized with server time within ±1 second
NFR2: Game state updates received from the server must render on the client within 200ms
NFR3: All card play actions (card selection, trick resolution, score update) must be reflected across all four clients within 500ms under normal network conditions
NFR4: The application shell (initial page load) must complete within 3 seconds on a standard broadband connection
NFR5: WebSocket reconnection attempts must begin automatically within 1 second of detecting a dropped connection
NFR6: All client-server communication must use encrypted protocols (HTTPS for requests, WSS for WebSocket connections)
NFR7: User passwords must be stored using a one-way cryptographic hash; plaintext passwords must never be stored or logged
NFR8: All game logic (card validation, declaration scoring, auto-play selection, ELO calculation) must execute server-side; the client must not be able to influence game outcomes by sending unsanctioned messages
NFR9: Authentication sessions must use time-limited tokens with secure refresh mechanisms
NFR10: Player account data must be accessible only to the authenticated account owner and authorized platform administrators
NFR11: The system must support Phase 1 capacity: up to 10 concurrent game sessions (~40 simultaneous players) without performance degradation
NFR12: The system must support Phase 2 capacity: up to 50 concurrent game sessions (~200 simultaneous players) without architectural redesign
NFR13: The platform architecture must permit horizontal scaling to accommodate growth beyond Phase 2 without a full rebuild
NFR14: Server uptime must exceed 99.5% measured on a rolling monthly basis
NFR15: The rate of WebSocket connections dropped during active game sessions must remain below 5%
NFR16: Server-side game state must be fully preserved through any client disconnection event, ensuring reconnecting players restore to an identical match state
NFR17: A single player's disconnection must not affect game state integrity or client connectivity for the remaining three players

### Additional Requirements

**From Architecture — Starter Template (impacts Epic 1 Story 1):**
- Project scaffold uses Composed (Vite + Go Module Monorepo): `npm create vite@latest client -- --template react-swc-ts` + `npx shadcn@latest init` for frontend; Go module with Echo v4, GORM, coder/websocket for backend
- Makefile for unified dev/build/test commands (`make dev`, `make build`, `make test`, `make lint`, `make migrate`, `make seed`, `make deploy`)
- Docker Compose for local PostgreSQL; Docker containers for production
- GitHub Actions CI: `make test` + `make lint` on every push

**From Architecture — Data & Auth:**
- In-memory game state as serializable Go structs + PostgreSQL for persistent data
- JWT authentication: access token in memory (Zustand), refresh token in httpOnly cookie; access ~15min, refresh ~7 days
- WebSocket auth: JWT in first message after connection
- bcrypt password hashing
- golang-migrate for database migrations + seed script
- GORM as ORM with repository pattern per domain

**From Architecture — API & Communication:**
- RESTful JSON for HTTP API (auth, profiles, rooms, match history, stats)
- Single multiplexed WebSocket per client with JSON typed events: `action:`, `event:`, `error:`, `system:` prefixes
- WebSocket message structure: `{ "type": "event_name", "payload": { ... } }`
- Timer sync via absolute server timestamps (Unix timestamp for turn expiry)
- Formal WebSocket event contract maintained in both `wsEvents.ts` and `events.go`

**From Architecture — Frontend:**
- Zustand partitioned stores: auth, lobby, game, chat
- React Router v7 for routing
- react-i18next with JSON translation files for i18n
- Feature folder organization: auth/, game/, lobby/, profile/, chat/
- shadcn/ui components themed to Balatro register; custom game components (PlayingCard, HandCards, TrickArea, etc.)

**From Architecture — Backend:**
- Echo v4 framework
- Rules engine as pure function: `ApplyAction(state, action) → (state, error)` — no side effects
- Session manager orchestrates rules engine + WebSocket + timers
- Game state machine phases: dealing → bidding → playing → trick_resolving → hand_scoring → match_end (+ paused, disconnected)
- Card encoding: 2-char format `{Rank}{Suit}` (e.g., KS, TH, 7D)
- Player seats: 0-3 counter-clockwise, teams 0+2 (Red) vs 1+3 (Blue)
- Backend domain package shape: model.go, repository.go, gorm_repo.go, handler.go, service.go, _test.go
- Centralized errors in `internal/apperr/errors.go`

**From Architecture — Infrastructure:**
- Contabo VPS with Caddy reverse proxy (host-level, auto TLS)
- Production: Caddy → Docker Go container → Docker PostgreSQL container
- Go slog for structured JSON logging
- Health endpoint + UptimeRobot for Phase 1 monitoring

**From Architecture — Quality Gates:**
- `internal/game/` coverage >90%, `internal/auth/` >80%, `internal/session/` >70%
- Test fixture factory functions required in `internal/game/testfixtures/`
- Feature-complete checklist: handler + repo + tests, domain errors, WS events in both files, frontend + test, API client, i18n strings, linter pass
- Deployment smoke test: register, login, create room, join room, complete one hand, WS reconnect

**From Architecture — Phase Scoping:**
- Phase 1: ~25 FRs (auth, Bitola variant only, lobby/rooms, real-time session, chat, disconnect handling, basic match history, i18n EN+SR, desktop web)
- Phase 2+: Croatian variant, ELO/ranked, XP/levels, 501 mode, friend system, social login, detailed stats
- Agents must NOT implement Croatian variant or 501 mode in Phase 1
- FR28, FR38, FR43 have undefined formulas — require product decisions before Phase 2 implementation

**From UX Design:**
- Balatro-inspired dark/neon visual register: near-black background (#0a0a0f), teal accent (#00e5a0), team Red/Blue colours
- Typography: Space Grotesk (display/headings), Inter (UI/body)
- Direction 5 lobby layout: top nav, rank banner, play options column + leaderboard panel
- Single-click card play (no confirm step), one-click copy-link for room sharing
- Card states: playable (lift + glow), unplayable (40% opacity), face-down, played (animate to trick area)
- Active player: accent border + glow + pulse on seat, TimerRing overlay
- Game prompts: binary (PICK/PASS, DECLARE/SKIP) — primary + ghost button pairing
- Score reveal as dedicated theatrical moment; Capot gets full-screen animation
- Toasts: bottom-right, max 3 stacked, auto-dismiss (3s success/info, 5s warning)
- Overlays: ReconnectOverlay (calm tone, countdown), game prompts (blocking, must resolve)
- Form patterns: registration 3 fields, room config 4 controls, live-filtering search
- WCAG AA contrast targets; no info conveyed by colour alone
- Minimum viewport 1280x720, desktop-only for MVP

### FR Coverage Map

FR1: Epic 1 — Player registration (email/password)
FR2: Epic 1 — Login and session persistence
FR3: Epic 10 — Social login (Google, Facebook)
FR4: Epic 1 (basic) / Epic 7 (expanded) — Player profile display
FR5: Epic 10 — Player search by username
FR6: Epic 10 — Friend requests and friend list
FR7: Epic 3 — Bitola variant rules engine
FR8: Epic 8 — Croatian variant rules engine
FR9: Epic 3 — Declaration validation and scoring
FR10: Epic 3 — Belot bonus (K+Q trump = 20 pts)
FR11: Epic 3 — Failed contract scoring
FR12: Epic 3 — Last-trick bonus and Capot scoring
FR13: Epic 3 — Instant-win (8 trump in sequence)
FR14: Epic 4 — 1001-point match mode
FR15: Epic 8 — 501-point match mode
FR16: Epic 2 — Create room with configuration
FR17: Epic 2 — Browse/search rooms
FR18: Epic 2 — Join room via list or code
FR19: Epic 2 — Quick Play matchmaking queue
FR20: Epic 2 — Team self-assignment (Red/Blue)
FR21: Epic 2 — Room owner starts game
FR22: Epic 5 — Room owner pause override
FR23: Epic 4 — Real-time game state sync (4 players)
FR24: Epic 5 — Player pause system (stackable)
FR25: Epic 4 — Auto-play on timer expiry
FR26: Epic 5 — Disconnect detection + reconnect countdown
FR27: Epic 5 — Reconnect within window, restore state
FR28: Epic 5 — Match abandon on reconnect timeout
FR28a: Epic 8 — Team surrender request
FR29: Epic 8 — In-app rules reference
FR30: Epic 6 — Global lobby chat
FR31: Epic 6 — Match-scoped chat
FR32: Epic 8 — In-game emotes
FR33: Epic 9 — XP from completed matches
FR34: Epic 9 — Level system with Level 5 gate
FR35: Epic 9 — Ranked queue with ELO matchmaking
FR36: Epic 9 — 3 placement matches per season
FR37: Epic 9 — 8-tier rank display
FR38: Epic 9 — Scaled ELO penalties for abandonment
FR39: Epic 9 — Seasonal leaderboard
FR40: Epic 9 — Quarterly seasons with rank resets
FR41: Epic 7 — Match history with scoring detail
FR42: Epic 9 — Career statistics
FR43: Epic 9 — Partial XP on casual abandonment
FR44: Epic 1 — i18n (English + Serbian Latin)
FR45: Epic 10 — Additional languages (Macedonian, Croatian)
FR46: Epic 1 — Desktop web browser support
FR47: Epic 10 — Public player profiles
FR48: Epic 11 — Spectator/observer mode
FR49: Epic 11 — Achievements and badges
FR50: Epic 11 — Cosmetic purchases
FR51: Epic 12 — Bracket-style tournaments
FR52: Epic 12 — Mobile experience (PWA/native)

## Epic List

### Epic 1: Project Foundation & Player Identity

Users can register, log in, view their profile, and access the platform in English or Serbian. The project scaffold establishes the full-stack monorepo per Architecture starter template.

**FRs covered:** FR1, FR2, FR4 (basic), FR44, FR46
**Phase:** 1

### Epic 2: Lobby & Room Management

Players can create/configure rooms, browse/search rooms, join via list or code, queue for Quick Play, self-assign to teams, and room owners can start the game.

**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21
**Phase:** 1

### Epic 3: Belot Rules Engine (Bitola Variant)

The server-side rules engine correctly enforces all Bitola variant game rules — dealing, trump bidding with reshuffle-and-rotate, declarations, Belot bonus, trick play with suit-following and trump obligations, failed contracts, last-trick bonus, Capot, and instant-win detection. Fully testable as a pure function with no side effects.

**FRs covered:** FR7, FR9, FR10, FR11, FR12, FR13
**Phase:** 1

### Epic 4: Real-Time Game Experience

Four players can play a complete real-time Belot match end-to-end — session management, WebSocket game state synchronization, per-move timer with auto-play on expiry, 1001-point match mode, and the full game UI (PlayingCard, HandCards, TrickArea, TrumpPrompt, DeclarationPrompt, ScorePanel, TimerRing, ScoreReveal).

**FRs covered:** FR14, FR23, FR25
**Phase:** 1

### Epic 5: Game Session Resilience

Games are reliable: players can pause (1 per player, stackable), room owners can override pauses, disconnections are detected with a reconnect countdown, and reconnecting players resume from preserved server state. Matches abandon gracefully on timeout.

**FRs covered:** FR22, FR24, FR26, FR27, FR28
**Phase:** 1

### Epic 6: In-Game & Lobby Communication

Players can chat in the global lobby and within active matches, creating the social card-table atmosphere.

**FRs covered:** FR30, FR31
**Phase:** 1

### Epic 7: Match History & Player Profile

Players can view their complete match history with per-match scoring detail and review their profile with username and basic stats.

**FRs covered:** FR41, FR4 (expanded)
**Phase:** 1

### Epic 8: Croatian Variant, 501 Mode & Game Enhancements

Players can play the Croatian trump variant, 501-point matches, access in-app rules reference, initiate team surrender, and express reactions via preset emotes.

**FRs covered:** FR8, FR15, FR28a, FR29, FR32
**Phase:** 2

### Epic 9: Player Progression & Competitive Ranked Play

Players earn XP, level up, unlock ranked mode at Level 5, compete in ELO-based matchmaking with placement matches, climb an 8-tier rank system across quarterly seasons, and view leaderboards and career stats.

**FRs covered:** FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR42, FR43
**Phase:** 2

### Epic 10: Social & Friend System

Players can use social login, search for other players, manage friend lists, view public profiles, and use the platform in additional languages.

**FRs covered:** FR3, FR5, FR6, FR45, FR47
**Phase:** 3

### Epic 11: Spectator Mode, Achievements & Cosmetics

Players can spectate live matches, earn and display achievements, and purchase cosmetic items with no gameplay impact.

**FRs covered:** FR48, FR49, FR50
**Phase:** 4

### Epic 12: Tournaments & Mobile

Players can compete in bracket-style tournaments and access the platform via mobile.

**FRs covered:** FR51, FR52
**Phase:** 4

---

## Epic 1: Project Foundation & Player Identity

Users can register, log in, view their profile, and access the platform in English or Serbian. The project scaffold establishes the full-stack monorepo per Architecture starter template.

### Story 1.1: Project Scaffold & Development Environment

As a developer,
I want a fully configured monorepo with React frontend, Go backend, PostgreSQL database, CI pipeline, and design system foundations,
So that I can begin building features on a solid, consistent development environment.

**Acceptance Criteria:**

**Given** the project is initialized from scratch
**When** I run the scaffold setup commands per Architecture spec
**Then** the monorepo contains `client/` (Vite react-swc-ts template) and `server/` (Go module with Echo v4, GORM, coder/websocket dependencies)
**And** `npx shadcn@latest init` has been run, with base components (Button, Dialog, Input, Tabs, Toast, Tooltip) added and themed to the Balatro design token set

**Given** the monorepo is set up
**When** I inspect the Makefile
**Then** it includes working targets: `dev` (concurrent client + server), `build`, `test`, `lint`, `migrate`, `seed`

**Given** Docker Compose is configured
**When** I run `make dev`
**Then** PostgreSQL starts in a Docker container on port 5432, Vite dev server runs on port 5173 with HMR, and the Go server runs natively on port 8080 with a `/health` endpoint returning 200

**Given** the CI pipeline is configured
**When** code is pushed to GitHub
**Then** GitHub Actions runs `make test` and `make lint` and blocks merge on failure

**Given** the Tailwind config is set up
**When** I inspect `client/src/index.css` and Tailwind configuration
**Then** the Balatro design tokens are defined: `background` (#0a0a0f), `surface` (#13131a), `surface-elevated` (#1c1c26), `border` (#2a2a38), `accent` (#00e5a0), `accent-glow`, `team-red` (#ff4d4d), `team-blue` (#4d9fff), `text-primary` (#f0f0f8), `text-secondary` (#8888a0), `text-disabled` (#44445a), `success`, `warning`, `destructive`
**And** Space Grotesk and Inter fonts are loaded from Google Fonts

**Given** i18n is configured
**When** I inspect the i18n setup
**Then** react-i18next is initialized with `en.json` and `sr.json` translation files in `shared/i18n/`, with a working translation hook (`useTranslation`)

**Given** frontend tooling is configured
**When** I run `make lint`
**Then** ESLint + Prettier run on all TypeScript files and golangci-lint runs on all Go files

**Given** the database migration system is set up
**When** I run `make migrate`
**Then** golang-migrate executes SQL migration files from `server/migrations/` against the PostgreSQL instance

**Given** React Router v7 is installed
**When** I inspect `App.tsx`
**Then** base route structure is defined with placeholder routes for `/login`, `/register`, `/lobby`, `/profile`, `/game`

### Story 1.2: User Registration

As a new player,
I want to create an account with my email, username, and password,
So that I have a persistent identity on the Belote platform.

**Acceptance Criteria:**

**Given** no account exists for the provided email
**When** a player submits valid registration data (email, username, password)
**Then** a new user record is created in the `users` table with the password stored as a bcrypt hash
**And** the player is automatically logged in (receives JWT access token + refresh cookie)
**And** the player is redirected to the lobby

**Given** the registration page is displayed
**When** the player views the form
**Then** three fields are shown: Email, Username, Password — with a submit button
**And** all labels and prompts are displayed in the player's selected language (EN or SR)

**Given** a player submits a duplicate email
**When** the server processes the request
**Then** a 409 error is returned with error code `EMAIL_TAKEN` and a user-friendly message
**And** the error displays inline below the email field

**Given** a player submits a duplicate username
**When** the server processes the request
**Then** a 409 error is returned with error code `USERNAME_TAKEN` and a user-friendly message
**And** the error displays inline below the username field

**Given** invalid input (empty fields, invalid email format, password too short)
**When** the player blurs a field or submits the form
**Then** frontend validation shows specific inline error messages below the relevant field
**And** the server rejects the request with a 400 error and structured error response if frontend validation is bypassed

**Given** the `users` migration
**When** I inspect the database schema
**Then** the `users` table contains: `id` (PK, auto-increment), `email` (unique), `username` (unique), `password_hash`, `language_preference` (default 'en'), `created_at`, `updated_at`

### Story 1.3: User Login & Session Persistence

As a registered player,
I want to log in and remain authenticated across page refreshes,
So that I don't need to re-enter my credentials every time I visit the platform.

**Acceptance Criteria:**

**Given** a player has a registered account
**When** they submit correct email and password on the login page
**Then** the server returns a JWT access token (~15 min lifetime) in the response body
**And** a refresh token (~7 day lifetime) is set as an httpOnly secure cookie
**And** the Zustand auth store is populated with the access token and user profile
**And** the player is redirected to the lobby

**Given** invalid credentials are submitted
**When** the server processes the login request
**Then** a 401 error is returned with a generic "Invalid email or password" message (no information leakage about which field is wrong)

**Given** a player is authenticated and refreshes the page
**When** the app initializes
**Then** the client calls `POST /auth/refresh` (httpOnly cookie auto-sent)
**And** the server returns a new access token
**And** the Zustand auth store is repopulated and the player remains on their current page

**Given** the refresh token has expired
**When** the client calls `/auth/refresh`
**Then** the server returns 401
**And** the player is redirected to the login page with auth store cleared

**Given** a player clicks logout
**When** the logout action is triggered
**Then** the Zustand auth store is cleared, the refresh cookie is invalidated server-side, and the player is redirected to the login page

**Given** an unauthenticated user navigates to a protected route (lobby, profile, game)
**When** the route guard evaluates
**Then** the user is redirected to the login page

### Story 1.4: Basic Player Profile & Navigation Shell

As a logged-in player,
I want to see my profile and navigate the platform using a persistent top navigation bar,
So that I can access different sections and manage my language preference.

**Acceptance Criteria:**

**Given** a player is authenticated
**When** they are in the lobby or any main view
**Then** a fixed top navigation bar is displayed with: logo/app name, tabs for Play / Leaderboard / Profile / Rules
**And** the nav uses `surface` background with `border` bottom, matching the Direction 5 UX layout
**And** the active tab is highlighted with an `accent` bottom border

**Given** a player navigates to their profile
**When** the profile page loads
**Then** it displays the player's username, "Member since" date, and placeholder sections for match history and stats (to be populated in Epic 7)
**And** the profile uses the Balatro visual register (dark background, proper typography hierarchy)

**Given** a player's profile endpoint is called
**When** `GET /users/:id/profile` is requested with a valid JWT
**Then** the server returns the user's `id`, `username`, `languagePreference`, and `createdAt`

**Given** a player wants to change their language
**When** they select a different language (EN or SR) via a language selector in the nav or profile
**Then** the UI immediately re-renders in the selected language
**And** the preference is persisted to the server via `PATCH /users/:id/preferences`
**And** subsequent page loads use the saved preference

**Given** the viewport is at least 1280x720
**When** the player views any page
**Then** the layout renders correctly without horizontal scroll on Chrome, Firefox, Edge, and Safari (latest 2 versions)

## Epic 2: Lobby & Room Management

Players can create/configure rooms, browse/search rooms, join via list or code, queue for Quick Play, self-assign to teams, and room owners can start the game.

### Story 2.1: Create Room & Room Configuration

As a player,
I want to create a game room and configure its settings,
So that I can set up a Belot game exactly how my group wants to play.

**Acceptance Criteria:**

**Given** a player is authenticated and in the lobby
**When** they click "Create Room"
**Then** a modal appears with 4 configuration controls: Room Name (text input), Variant (dropdown: Bitola only for Phase 1), Match Mode (dropdown: 1001 only for Phase 1), Timer Style (dropdown: per-move with duration selector, or relaxed)
**And** defaults are pre-filled: Bitola / 1001 / Relaxed

**Given** a player submits valid room configuration
**When** `POST /api/v1/rooms` is called
**Then** a new room record is created in the `rooms` table with the player as room owner
**And** the player is redirected to the room lobby view
**And** the room appears in the browse list for other players via WebSocket lobby broadcast

**Given** the rooms migration
**When** I inspect the database schema
**Then** the `rooms` table contains: `id`, `name` (unique active), `code` (unique, auto-generated), `owner_id` (FK to users), `variant`, `match_mode`, `timer_style`, `timer_duration_seconds` (nullable), `status` (waiting/in_progress/completed), `created_at`, `updated_at`

**Given** a player submits a room with an empty name
**When** the form validates
**Then** the Create button remains disabled until a room name is entered

**Given** the modal is open
**When** the player clicks the backdrop or Cancel button
**Then** the modal closes without creating a room

### Story 2.2: Browse & Search Rooms

As a player,
I want to browse and search available game rooms,
So that I can find a game to join.

**Acceptance Criteria:**

**Given** a player is in the lobby
**When** the lobby page loads
**Then** the Direction 5 layout is displayed: play options column on the left (Quick Play, Browse Rooms, Create Room as equal-weight cards) and a placeholder leaderboard panel on the right
**And** Quick Play card has `accent-glow` background to signal recommended default action

**Given** a player selects Browse Rooms
**When** the room list loads
**Then** `GET /api/v1/rooms?status=waiting` returns all open rooms
**And** each room is displayed as a RoomCard showing: room name, variant, mode, player count (e.g., "2/4"), timer style

**Given** a player types in the search bar
**When** text is entered
**Then** the room list live-filters by room name and room code without requiring a submit action
**And** results update as the player types

**Given** no rooms match the search query
**When** the filtered list is empty
**Then** an empty state is shown: "No rooms match '[query]' — Clear search" with a clickable clear link

**Given** rooms are created or filled by other players
**When** room state changes occur
**Then** the room list updates in real-time via WebSocket `system:room_updated` events without requiring page refresh

### Story 2.3: Join Room & Room Lobby

As a player,
I want to join a room and see who else is in the room lobby,
So that I can prepare for a game with other players.

**Acceptance Criteria:**

**Given** a player clicks "Join" on a RoomCard in the browse list
**When** `POST /api/v1/rooms/:id/join` is called
**Then** the player is added to the room and redirected to the RoomLobby view
**And** all other players in the room receive a WebSocket `system:player_joined` event and see the updated seat state

**Given** a player tries to join a full room (4/4 players)
**When** the join request is processed
**Then** a 409 error is returned with code `ROOM_FULL`
**And** a toast is shown: "Room is full — try another"

**Given** a player is in the RoomLobby view
**When** the view renders
**Then** 4 player seats are displayed showing occupied seats (player username + team color) and empty seats ("Waiting..." with dashed border)
**And** room configuration is visible (variant, mode, timer)
**And** a prominent "Copy Link" button is available that copies the room code/link to clipboard with a single click and shows a success toast

**Given** a player leaves the room lobby
**When** they navigate away or click "Leave Room"
**Then** their seat is freed and all remaining players receive a WebSocket `system:player_left` event
**And** the room list updates to reflect the new player count

**Given** a player has a room code shared externally
**When** they enter the code in the lobby search bar
**Then** the matching room appears in the filtered list and can be joined

### Story 2.4: Team Assignment & Game Start

As a player in a room lobby,
I want to pick my team and have the room owner start the game when everyone is ready,
So that we can begin playing with the teams arranged how we want.

**Acceptance Criteria:**

**Given** a player is in the RoomLobby
**When** they click an empty seat on Red or Blue team
**Then** they are assigned to that team and seat
**And** all players in the room see the updated seat assignment via WebSocket
**And** partners face each other (seats 0+2 = Red, seats 1+3 = Blue per Architecture seat mapping)

**Given** a player is already seated
**When** they click a different empty seat
**Then** they move to the new seat and their old seat becomes empty
**And** all players see the update in real-time

**Given** all 4 seats are filled
**When** the room owner views the lobby
**Then** the "Start Game" button becomes active (accent style, previously disabled at 40% opacity)

**Given** fewer than 4 seats are filled
**When** the room owner views the lobby
**Then** the "Start Game" button is disabled with `cursor-not-allowed` and a tooltip: "All 4 players must be seated"

**Given** the room owner clicks "Start Game" with 4 players seated
**When** the request is processed
**Then** the room status changes to `in_progress`
**And** all 4 players are transitioned to the game view via WebSocket `system:game_started` event
**And** the room is removed from the browse list

**Given** a non-owner player views the lobby with 4 players
**When** all seats are filled
**Then** they see a message "Waiting for [owner username] to start the game..." instead of a Start button

### Story 2.5: Quick Play Matchmaking

As a player,
I want to quickly find a game without browsing rooms,
So that I can start playing as fast as possible.

**Acceptance Criteria:**

**Given** a player clicks "Quick Play" in the lobby
**When** the matchmaking request is submitted
**Then** the player enters a matchmaking queue with a pulsing "Finding match..." indicator and player count context

**Given** an open room exists with available seats matching Quick Play defaults (Bitola, 1001, relaxed)
**When** a player is in the Quick Play queue
**Then** the server assigns them to an available seat in an existing room
**And** the player is redirected to the RoomLobby view

**Given** no suitable open room exists
**When** a player is in the Quick Play queue
**Then** the server creates a new room with default settings (Bitola, 1001, relaxed) with the player as owner
**And** the player is redirected to the RoomLobby to wait for others

**Given** a player is waiting in the Quick Play queue
**When** they want to cancel
**Then** a "Cancel" button is available that removes them from the queue and returns to the lobby

**Given** 4 players have been matched into a Quick Play room
**When** all seats are filled
**Then** the game starts automatically (no manual Start Game required for Quick Play rooms)

## Epic 3: Belot Rules Engine (Bitola Variant)

The server-side rules engine correctly enforces all Bitola variant game rules — dealing, trump bidding with reshuffle-and-rotate, declarations, Belot bonus, trick play with suit-following and trump obligations, failed contracts, last-trick bonus, Capot, and instant-win detection. Fully testable as a pure function with no side effects.

### Story 3.1: Game State Types, Card Encoding & Deck

As a developer,
I want well-defined game state types, card encoding, and dealing logic,
So that the rules engine has a solid, testable foundation for all game operations.

**Acceptance Criteria:**

**Given** the game types are defined in `server/internal/game/types.go`
**When** I inspect the type definitions
**Then** the following types exist: `Card` (Rank + Suit), `Suit` (S/H/D/C), `Rank` (7/8/9/T/J/Q/K/A), `Declaration`, `Action`, `Variant` (Bitola), `Phase` (dealing/bidding/playing/trick_resolving/hand_scoring/match_end/paused/disconnected)
**And** cards use 2-character encoding: `{Rank}{Suit}` (e.g., KS, TH, 7D, AC)

**Given** the GameState struct is defined in `server/internal/game/state.go`
**When** I inspect the struct
**Then** fields are ordered per Architecture spec: match metadata, current hand state, current trick state, player states, scoring, timer state
**And** the struct is serializable with JSON tags using camelCase

**Given** a new game is initialized
**When** `NewGame()` is called with 4 player IDs and Bitola variant
**Then** a 32-card deck is generated (7-A in all 4 suits), shuffled, and dealt in 3+2 sequence (3 cards to each player, then 2 cards to each player, counter-clockwise from dealer)
**And** each player holds exactly 8 cards
**And** a trump candidate card is set (first undealt card or per Bitola convention)
**And** the phase is set to `bidding`
**And** the dealer is seat 0 for the first hand

**Given** test fixtures are needed
**When** I inspect `server/internal/game/testfixtures/fixtures.go`
**Then** factory function `NewGameJustDealt()` exists and returns a valid GameState in `bidding` phase with all 4 players holding 8 cards

**Given** the `ApplyAction` function signature is defined in `server/internal/game/rules_engine.go`
**When** I inspect the function
**Then** the signature is `ApplyAction(state *GameState, action Action) (*GameState, error)` — pure function, no side effects

### Story 3.2: Trump Bidding (Bitola Variant)

As a player in a Belot game,
I want the trump bidding to follow authentic Bitola variant rules,
So that the game feels correct and familiar to experienced players.

**Acceptance Criteria:**

**Given** a game is in `bidding` phase with a trump candidate revealed
**When** the active bidder submits `pick_trump`
**Then** the trump suit is locked to the candidate's suit, the phase transitions to `playing`, and the first player to act is the player after the dealer (counter-clockwise)

**Given** a game is in `bidding` phase
**When** the active bidder submits `pass_trump`
**Then** the bidding moves counter-clockwise to the next player
**And** the active bidder index updates accordingly

**Given** all 4 players pass in round 1 of bidding (Bitola variant)
**When** the 4th pass is processed
**Then** round 2 begins where players can pick any suit as trump (not just the candidate)
**And** bidding restarts from the player after the dealer

**Given** all 4 players pass in round 2 of bidding (Bitola variant)
**When** the 8th total pass is processed
**Then** the deck reshuffles, the dealer rotates counter-clockwise to the next seat, cards are re-dealt in 3+2 sequence, and a new trump candidate is revealed
**And** the phase remains `bidding` with the new dealer

**Given** a player who is NOT the active bidder submits `pick_trump` or `pass_trump`
**When** `ApplyAction` processes the action
**Then** `ErrNotYourTurn` is returned and the state is unchanged

**Given** the game is NOT in `bidding` phase
**When** any player submits `pick_trump` or `pass_trump`
**Then** `ErrWrongPhase` is returned and the state is unchanged

**Given** test fixtures
**When** I inspect `testfixtures/`
**Then** `NewGameMidBidding(passCount int)` exists, returning a game state with the specified number of passes already recorded

### Story 3.3: Card Play & Trick Resolution

As a player in a Belot game,
I want card play to enforce correct suit-following and trump rules,
So that every trick resolves fairly according to Bitola rules.

**Acceptance Criteria:**

**Given** a game is in `playing` phase and it is a player's turn
**When** the player submits `play_card` with a card in their hand that is a legal play
**Then** the card is removed from their hand, added to the current trick, and the active player advances counter-clockwise

**Given** a card has been led in the current trick
**When** a player must follow suit
**Then** only cards matching the led suit are legal; if the player has no cards of the led suit, any card is legal; if trump has been led, trump must be played if held

**Given** a non-trump suit has been led and the player cannot follow suit
**When** the opponent team is currently winning the trick
**Then** the player must play trump if they hold any (trump obligation); if they have no trump, any card is legal

**Given** 4 cards have been played in a trick
**When** the trick resolves
**Then** the winner is determined: highest trump wins if any trump played; otherwise highest card of the led suit wins
**And** card point values are calculated (trump order: J=20, 9=14, A=11, T=10, K=4, Q=3, 8=0, 7=0; non-trump order: A=11, T=10, K=4, Q=3, J=2, 9=0, 8=0, 7=0)
**And** points are added to the winning team's hand score
**And** the trick winner leads the next trick

**Given** a player submits `play_card` with a card NOT in their hand
**When** `ApplyAction` processes the action
**Then** `ErrInvalidCard` is returned

**Given** a player submits `play_card` that violates suit-following or trump obligations
**When** `ApplyAction` processes the action
**Then** `ErrIllegalPlay` is returned with the state unchanged

**Given** it is NOT the player's turn
**When** they submit `play_card`
**Then** `ErrNotYourTurn` is returned

**Given** test fixtures
**When** I inspect `testfixtures/`
**Then** `NewGameMidPlay(trickNum int)` exists, returning a game in `playing` phase at the specified trick number

### Story 3.4: Declarations & Belot Bonus

As a player,
I want declarations to be detected and scored correctly at the first trick, and Belot bonus to work when I hold K+Q of trump,
So that these important scoring mechanics are authentic.

**Acceptance Criteria:**

**Given** the game is at the first trick and a player holds a declarable combination
**When** it is their turn to play
**Then** the game state indicates a pending declaration decision for that player (declare/skip)
**And** the player can submit `declare` or `skip_declare` before playing their card

**Given** declarations are submitted at the first trick
**When** the first trick resolves
**Then** declarations are compared: sequences (3=20pts, 4=50pts, 5+=100pts), four-of-a-kind (4xJ=200pts, 4x9=150pts, 4xA/T/K/Q=100pts)
**And** the highest-value declaration wins; on tie, the team that declared first in play order wins
**And** only the winning team's declarations are scored — the losing team's declarations are discarded

**Given** a player holds K and Q of the trump suit
**When** they play either the K or Q during any trick
**Then** they can announce Belot (bela), and 20 points are added to their team's score for that hand

**Given** a player tries to declare after the first trick
**When** `ApplyAction` processes a `declare` action
**Then** `ErrWrongPhase` is returned (declarations only valid at first trick)

**Given** a player submits `skip_declare`
**When** the action is processed
**Then** their declaration opportunity is waived and they proceed to play a card

**Given** test fixtures
**When** I inspect `testfixtures/`
**Then** `NewGameFirstTrick(trump Suit)` exists with configurable hands that include declarable combinations
**And** `NewGameWithDeclarations(decls []Declaration)` exists for testing declaration resolution

### Story 3.5: Hand Scoring, Failed Contracts & Capot

As a player,
I want hand scoring to correctly calculate points including failed contracts and Capot,
So that the competitive integrity of the game is maintained.

**Acceptance Criteria:**

**Given** all 8 tricks in a hand have been resolved
**When** hand scoring is calculated
**Then** each team's hand score includes: sum of card points from won tricks + declaration points (if applicable)
**And** the team winning the last trick receives +10 bonus points
**And** the phase transitions to `hand_scoring`

**Given** one team wins all 8 tricks (Capot)
**When** hand scoring is calculated
**Then** the winning team receives +100 bonus points (replacing the +10 last-trick bonus, not in addition to it)

**Given** the team that picked trump (the contracting team) scores fewer points than the opposing team
**When** failed contract logic is applied
**Then** the contracting team scores 0 points for the hand and ALL points (both teams' card points + declarations + bonuses) are awarded to the opposing team

**Given** the team that picked trump scores equal or more points than the opposing team
**When** normal scoring is applied
**Then** each team keeps their own card points + declaration points + applicable bonuses

**Given** hand scoring is complete
**When** scores are added to the match total
**Then** the match score updates for both teams and the phase transitions to `dealing` (next hand) or `match_end` (if a team has reached the target)

**Given** test fixtures
**When** I inspect `testfixtures/`
**Then** `NewGameLastTrick()` exists, returning a game state at the 8th trick for testing hand-end scoring
**And** `NewGameCapotInProgress()` exists, returning a state where one team has won all tricks so far

### Story 3.6: Match Completion & Special Conditions

As a player,
I want the match to end correctly when a team reaches 1001 points, and instant-win to be detected,
So that match outcomes are resolved accurately.

**Acceptance Criteria:**

**Given** a hand has been scored and one team's match total reaches or exceeds 1001 points
**When** the match-end check runs
**Then** the phase transitions to `match_end` with the winning team recorded
**And** both teams' final scores are preserved in the game state

**Given** both teams exceed 1001 points in the same hand
**When** the match-end check runs
**Then** the team with the higher score wins; if tied, the contracting team (the team that picked trump) wins

**Given** a player holds all 8 trump cards in sequence (7, 8, 9, T, J, Q, K, A of the trump suit)
**When** the dealing phase completes and hands are evaluated
**Then** the instant-win condition is detected, the match ends immediately as a win for that player's team, and the phase transitions to `match_end`

**Given** the game is in `match_end` phase
**When** any player submits a game action (play_card, pick_trump, etc.)
**Then** `ErrWrongPhase` is returned

**Given** the game is in `paused` phase
**When** any player submits a game action other than `unpause` or `owner_unpause`
**Then** `ErrGamePaused` is returned

**Given** all phase error cases from the Architecture spec
**When** invalid actions are submitted for each phase
**Then** the appropriate error is returned: `ErrWrongPhase`, `ErrNotYourTurn`, `ErrInvalidCard`, `ErrIllegalPlay`, `ErrGamePaused`, `ErrPlayerDisconnected`

**Given** test fixtures
**When** I inspect `testfixtures/`
**Then** `NewGameNearEnd(redScore, blueScore int)` exists for testing match completion thresholds
**And** all 7 minimum fixture factory functions from the Architecture spec are present

## Epic 4: Real-Time Game Experience

Four players can play a complete real-time Belot match end-to-end — session management, WebSocket game state synchronization, per-move timer with auto-play on expiry, 1001-point match mode, and the full game UI (PlayingCard, HandCards, TrickArea, TrumpPrompt, DeclarationPrompt, ScorePanel, TimerRing, ScoreReveal).

### Story 4.1: WebSocket Gateway & Event Contract

As a developer,
I want a WebSocket gateway with authenticated connections and a formal event contract,
So that all real-time features have a reliable, type-safe communication layer.

**Acceptance Criteria:**

**Given** a client connects to the WebSocket endpoint
**When** the connection is established
**Then** the server expects a JWT access token in the first message as authentication handshake
**And** the server validates the token before accepting any further messages
**And** on invalid/expired token, the server closes the connection with an appropriate error

**Given** the WebSocket hub is running
**When** multiple clients connect
**Then** each client has a single multiplexed connection handled by `internal/ws/hub.go` and `internal/ws/client.go` (read/write pumps)
**And** the hub tracks all active connections by user ID

**Given** a client sends a message
**When** the message is received by the server
**Then** the message follows the wire format `{ "type": "action:event_name", "payload": { ... } }`
**And** `internal/ws/router.go` dispatches the message to the appropriate handler based on the `type` prefix (`action:` → game, `system:` → lobby/chat)

**Given** the WebSocket event contract needs to be defined
**When** I inspect both contract files
**Then** `client/src/shared/types/wsEvents.ts` and `server/internal/ws/events.go` both define the same set of event types with matching payload structures
**And** events use the 4-prefix convention: `action:` (client→server), `event:` (server→client), `error:` (server→client), `system:` (server→client)

**Given** the server sends a ping every 30 seconds
**When** the client fails to respond with a pong
**Then** the server detects a dropped connection per coder/websocket native ping/pong

**Given** a client's access token expires mid-session
**When** the WebSocket connection needs re-authentication
**Then** the client reconnects, calls `/auth/refresh` (httpOnly cookie auto-sent), receives a new access token, and authenticates the new WebSocket connection

### Story 4.2: Game Session Manager & State Sync

As a player in a game,
I want all game actions to be processed by the server and the updated state broadcast to all players instantly,
So that all four players see the same game state at all times.

**Acceptance Criteria:**

**Given** a game is started from a room
**When** the session manager initializes
**Then** `internal/session/manager.go` creates a new GameState via the rules engine, associates it with the 4 connected WebSocket clients, and broadcasts the initial state to all players via `event:game_state`

**Given** a player sends a game action (e.g., `action:play_card`)
**When** the session manager receives it
**Then** it validates the player's turn, calls `ApplyAction()` on the rules engine, and on success broadcasts the resulting state change to all 4 clients via the appropriate event (e.g., `event:card_played`)
**And** on rules engine error, sends an `error:` event only to the acting player

**Given** a player reconnects mid-game (future Epic 5 support)
**When** their WebSocket connection is re-established
**Then** the session manager sends a full `event:game_state` snapshot from the serializable GameState struct

**Given** a match completes (match_end phase)
**When** the session manager processes the final state
**Then** a match record is persisted to the `matches` table including: room_id, player IDs, team assignments, final scores, variant, mode, winner team, timestamps
**And** the Zustand gameStore is cleared on all clients

**Given** the `matches` migration
**When** I inspect the database schema
**Then** the `matches` table contains: `id`, `room_id`, `player1_id` through `player4_id`, `team_red_score`, `team_blue_score`, `winner_team`, `variant`, `match_mode`, `started_at`, `completed_at`

**Given** the frontend receives a game event
**When** `useWsDispatch.ts` processes the event
**Then** the event is routed to `gameStore` which updates and triggers a React re-render within 200ms (NFR2)

### Story 4.3: Game Table UI — Layout, Seats & Cards

As a player,
I want to see a game table with four seats, my hand of cards, and a central trick area,
So that the game feels like sitting at a real card table.

**Acceptance Criteria:**

**Given** a player enters the game view
**When** GamePage renders
**Then** the layout fills the full viewport with no scroll and no overflow
**And** four PlayerSeat components are positioned at compass points: bottom = you (South), left = West, top = North (teammate), right = East
**And** the TrickArea is centered, occupying ~25% of viewport width
**And** match chat is accessible as a collapsible sidebar on the right edge

**Given** a PlayerSeat is occupied
**When** it renders
**Then** it shows the player's username, team color border (Red or Blue), and avatar placeholder
**And** the current player's own seat (South) is slightly larger with a "You" label

**Given** it is a player's turn
**When** their seat becomes active
**Then** the seat displays an `accent` border with `accent-glow` shadow and a subtle pulse animation
**And** the counter-clockwise turn transition is visually indicated

**Given** a player's hand of cards is displayed
**When** HandCards renders
**Then** cards are fanned horizontally at the bottom edge with overlapping at a fixed offset
**And** cards spread wider as the count decreases through the hand

**Given** it is the player's turn
**When** their hand activates
**Then** playable cards lift (+4px translateY) with `accent-glow` box-shadow and cursor pointer
**And** unplayable cards dim to 40% opacity with cursor not-allowed
**And** hovering a playable card adds +2px additional lift

**Given** a player clicks a playable card
**When** the click is registered
**Then** a single click immediately sends `action:play_card` to the server (no confirmation dialog)
**And** the card animates from the hand to the TrickArea at the player's compass position (150ms ease-in)

**Given** other players' cards
**When** they are displayed
**Then** they show as face-down cards (card back design) with count visible

**Given** cards are played into the trick
**When** the TrickArea updates
**Then** up to 4 cards are displayed in their seat positions (N/S/E/W quadrants)
**And** when the 4th card is played, a brief pause (~1 second) shows all 4 cards, the winning card highlights with `accent` glow, then cards sweep to the winning team's pile

### Story 4.4: Trump Bidding & Declaration UI

As a player,
I want clear prompts for trump bidding and declarations,
So that I can make game-critical decisions confidently without confusion.

**Acceptance Criteria:**

**Given** the game enters the dealing phase
**When** the deal animation plays
**Then** cards animate from the center to each player's hand in the 3+2 sequence (3 cards, then 2 cards)
**And** the trump candidate card is revealed face-up in the center after dealing completes

**Given** a player is the active bidder
**When** the TrumpPrompt renders
**Then** it displays as a centered overlay on the table showing: "Trump Candidate" label, the large trump candidate card (size-lg), and two buttons: PICK (primary/accent) and PASS (ghost)
**And** the prompt blocks card interaction while visible

**Given** a player is NOT the active bidder
**When** another player is bidding
**Then** the non-active players see an indicator of who is currently deciding (highlighted seat)

**Given** a Bitola reshuffle-and-rotate occurs (all 8 passes)
**When** the deck reshuffles
**Then** a clear animated transition signals the reshuffle: cards return to center, shuffle animation, re-deal in 3+2, new trump candidate revealed

**Given** trump has been selected
**When** play begins
**Then** a permanent trump suit indicator appears in the HUD (accent-colored suit icon) and remains visible for the entire hand

**Given** the game is at the first trick and a player holds a declarable combination
**When** the DeclarationPrompt renders
**Then** it shows the declaration type and value (e.g., "Sequence of 4 — 50 pts") with DECLARE (primary) and SKIP (ghost) buttons
**And** the prompt must be resolved before card play is enabled for that player's turn

**Given** declarations are resolved at the end of the first trick
**When** the winning declaration is determined
**Then** the winning declaration value floats up with a brief animation and is logged in the ScorePanel

### Story 4.5: Per-Move Timer & Auto-Play

As a player,
I want a visible countdown timer on each move and automatic play when time runs out,
So that the game maintains pace and stalling is prevented.

**Acceptance Criteria:**

**Given** the room is configured with a per-move timer
**When** it becomes a player's turn
**Then** the server sends an absolute timestamp for turn expiry via the game state
**And** the TimerRing component renders on the active player's seat as a countdown overlay
**And** the timer display stays synchronized with server time within ±1 second (NFR1)

**Given** the timer has more than 10 seconds remaining
**When** TimerRing renders
**Then** it displays in `text-secondary` color with a steady countdown

**Given** the timer reaches ≤10 seconds
**When** TimerRing updates
**Then** it transitions to amber (`warning` token) with a pulse animation

**Given** the timer reaches 0
**When** the server detects expiry
**Then** `internal/session/timer.go` triggers auto-play via the rules engine's `auto_play.go`: the first eligible legal card is selected (sorted by suit then rank)
**And** the card is played automatically on behalf of the player
**And** all clients receive `event:card_played` with an auto-play indicator
**And** a toast notification appears: "Auto-played: [card]" (info style, auto-dismiss 3s)

**Given** the room is configured with relaxed timer (no per-move timer)
**When** it becomes a player's turn
**Then** no TimerRing is displayed and there is no auto-play trigger

**Given** a player plays a card before the timer expires
**When** the action is processed
**Then** the timer for their turn is cancelled and the next player's timer begins

### Story 4.6: Score Panel, Score Reveal & Match Flow

As a player,
I want to see live scores during the game and a theatrical score reveal at the end of each hand,
So that scoring feels transparent, accurate, and satisfying.

**Acceptance Criteria:**

**Given** a game is in progress
**When** the ScorePanel renders
**Then** it is fixed to the top-left of the game viewport showing: two rows (Red / Blue) with team color labels, current match scores in Space Grotesk bold (`display-xl` for scores), and current hand trick count
**And** the panel never reflows during play

**Given** a trick is won
**When** the ScorePanel updates
**Then** the trick count increments and points animate with a counter animation (300ms)
**And** last-trick bonus shows a "+10" float-up animation when applicable

**Given** all 8 tricks in a hand are complete
**When** the score reveal phase begins
**Then** a dedicated ScoreReveal overlay expands showing: points per team (card points, declaration points, last-trick bonus), any failed contract adjustment, and updated match totals
**And** numbers animate in sequentially for theatrical effect
**And** a "Continue" action becomes available after 2 seconds

**Given** a Capot occurs (one team takes all 8 tricks)
**When** the hand ends
**Then** a full-screen CapotAnimation plays (~2.5 seconds) with distinct visual treatment before transitioning to the score reveal
**And** the animation cannot be skipped

**Given** a team's match score reaches or exceeds 1001 points
**When** the match ends
**Then** a match result screen displays showing: winning team, final scores, match duration
**And** the match record is persisted to the database
**And** players can return to the lobby

**Given** the match ends
**When** players return to the lobby
**Then** the Zustand gameStore is cleared and the game view is fully unmounted

## Epic 5: Game Session Resilience

Games are reliable: players can pause (1 per player, stackable), room owners can override pauses, disconnections are detected with a reconnect countdown, and reconnecting players resume from preserved server state. Matches abandon gracefully on timeout.

### Story 5.1: Player Pause System

As a player,
I want to pause the game briefly when I need a break,
So that I don't miss my turn or disadvantage my team.

**Acceptance Criteria:**

**Given** a game is in `playing` or `bidding` phase
**When** a player submits `action:pause`
**Then** the game phase transitions to `paused`, the player's pause is recorded (1 per player per game limit), and all clients receive `event:game_paused` with the pausing player's identity

**Given** a player has already used their pause in this game
**When** they submit `action:pause` again
**Then** an `error:pause_exhausted` event is returned and the game state is unchanged

**Given** multiple players pause before any unpause occurs
**When** pauses stack
**Then** all active pauses are tracked; the game remains paused until ALL active pauses are resolved

**Given** the game is paused
**When** any player submits a game action (play_card, pick_trump, declare, etc.)
**Then** `ErrGamePaused` is returned and the state is unchanged

**Given** the player who paused submits `action:unpause`
**When** the unpause is processed
**Then** their pause is cleared; if no other active pauses remain, the game resumes to the previous phase and all clients receive `event:game_resumed`

**Given** the game is paused
**When** all clients render
**Then** a pause overlay is displayed showing who paused and that the game is temporarily on hold

### Story 5.2: Room Owner Pause Override

As a room owner,
I want to override all active pauses and resume the game,
So that I can keep the game moving if a pause is taking too long.

**Acceptance Criteria:**

**Given** the game is paused with one or more active player pauses
**When** the room owner submits `action:owner_unpause`
**Then** ALL active pauses are cleared regardless of who initiated them
**And** the game resumes to the previous phase
**And** all clients receive `event:game_resumed` with an indicator that the room owner forced the resume

**Given** a non-owner player submits `action:owner_unpause`
**When** the action is processed
**Then** an `error:not_room_owner` event is returned and the state is unchanged

**Given** the game is paused
**When** the room owner views the pause overlay
**Then** they see an additional "Resume All" button (destructive ghost style) that other players do not see

**Given** the room owner uses the override
**When** other players see the resume
**Then** a toast notification appears: "Room owner resumed the game"

### Story 5.3: Disconnect Detection & Reconnect Countdown

As a player in a game,
I want to be informed when another player disconnects and see a countdown for their return,
So that I know the game is paused and how long we're waiting.

**Acceptance Criteria:**

**Given** a player's WebSocket connection drops during an active game
**When** the server detects the disconnection (missed pong after 30s ping)
**Then** the game phase transitions to `disconnected`, the disconnected player's seat is marked accordingly, and a reconnect countdown begins (server-defined window, default 2 minutes)

**Given** a player disconnects
**When** the remaining 3 players' clients receive `event:player_disconnected`
**Then** the ReconnectOverlay renders on all 3 clients showing: disconnected player's username, "reconnecting..." status, countdown timer, and calm informational copy
**And** the disconnected player's seat dims (greyed avatar)
**And** all game interactions are disabled during the reconnect window

**Given** a player disconnects
**When** the other 3 players' WebSocket connections are evaluated
**Then** their connections remain active and unaffected (NFR17)
**And** the game state integrity is preserved for all players

**Given** the reconnect countdown is running
**When** the timer updates
**Then** the countdown is synchronized across all 3 remaining clients using the server's absolute timestamp

**Given** the WebSocket client detects its own connection drop
**When** reconnection is needed
**Then** the client begins automatic reconnection attempts within 1 second (NFR5)

### Story 5.4: Reconnection & State Restoration

As a disconnected player,
I want to reconnect and resume exactly where I left off,
So that the game continues without any lost state or unfair disadvantage.

**Acceptance Criteria:**

**Given** a player's connection was lost during an active game
**When** they reconnect within the reconnect window
**Then** the client calls `/auth/refresh` (httpOnly cookie), receives a new access token, and authenticates a new WebSocket connection

**Given** a reconnected player's WebSocket is authenticated
**When** the session manager detects the reconnection
**Then** a full `event:game_state` snapshot is sent from the serializable GameState struct
**And** the player's client restores to the exact match state: same cards in hand, same trick in progress, same scores, same phase

**Given** a player successfully reconnects
**When** the reconnection is confirmed
**Then** the game phase transitions from `disconnected` back to the previous phase (playing/bidding)
**And** all clients receive `event:player_reconnected` and the ReconnectOverlay dismisses
**And** the reconnected player's seat returns to normal (no longer dimmed)
**And** play resumes from where it left off

**Given** a player reconnects mid-trick (e.g., they disconnected after playing a card but before the trick resolved)
**When** the state snapshot is sent
**Then** the game state is identical to server-side state — no data lost, no duplicate actions

### Story 5.5: Match Abandonment on Timeout

As a player,
I want the match to end gracefully if a disconnected player doesn't return in time,
So that the remaining players aren't stuck waiting indefinitely.

**Acceptance Criteria:**

**Given** a player is disconnected and the reconnect window is active
**When** the countdown reaches 0 without reconnection
**Then** the match is abandoned and the game phase transitions to `match_end` with an abandon status

**Given** a match is abandoned
**When** the match record is persisted
**Then** the `matches` table record includes: `status: abandoned`, `abandoned_by: [player_id]`, `abandoned_at: [timestamp]`, and the game progress at time of abandonment (current scores, hand number)

**Given** a casual match is abandoned
**When** outcomes are applied
**Then** the disconnected player receives no XP (placeholder for Epic 9)
**And** the remaining 3 players are returned to the lobby with a clear explanation: "[Player] disconnected — match ended"

**Given** a match is abandoned
**When** the remaining players' clients receive `event:match_abandoned`
**Then** the ReconnectOverlay transitions to an abandonment message, a brief pause, then redirect to the lobby
**And** the Zustand gameStore is cleared

**Given** a player disconnects in a room lobby (before the game starts)
**When** their connection drops
**Then** their seat is freed after a short timeout (10 seconds), other players see the seat become available, and no match abandonment occurs

## Epic 6: In-Game & Lobby Communication

Players can chat in the global lobby and within active matches, creating the social card-table atmosphere.

### Story 6.1: Global Lobby Chat

As a logged-in player,
I want to send and receive messages in a global lobby chat,
So that I can socialize with other players and find people to play with.

**Acceptance Criteria:**

**Given** a player is authenticated and in the lobby
**When** the lobby page renders
**Then** a ChatPanel component is visible showing the global chat channel
**And** recent messages are displayed with sender username, message text, and timestamp

**Given** a player types a message and submits it
**When** the message is sent via `action:chat_message` with payload `{ "channel": "global", "text": "..." }`
**Then** the server broadcasts `system:chat_message` to all connected lobby clients
**And** the message appears in all players' ChatPanel in real-time

**Given** the Zustand chatStore receives a chat event
**When** `useWsDispatch.ts` routes the `system:chat_message` event
**Then** the message is appended to the chatStore's global messages array and the ChatPanel re-renders

**Given** a player enters the lobby after messages have been sent
**When** the lobby loads
**Then** no message history is loaded from the server (chat is ephemeral, live-only)

**Given** a player sends an empty message or whitespace-only
**When** the submit action triggers
**Then** the message is not sent (frontend validation prevents it)

**Given** a player is in a game (not in lobby)
**When** global chat messages are broadcast
**Then** they do not receive global chat events (only match-scoped chat is active during a game)

### Story 6.2: Match-Scoped Chat

As a player in an active match,
I want to chat with the other three players in my game,
So that we can banter and communicate during play, recreating the card-table atmosphere.

**Acceptance Criteria:**

**Given** a player is in an active game
**When** the game view renders
**Then** a ChatPanel is available as a collapsible sidebar on the right edge of the viewport
**And** the sidebar does not overlap the game table when expanded
**And** the sidebar can be toggled open/closed with a chat icon button

**Given** a player sends a message during a match
**When** the message is sent via `action:chat_message` with payload `{ "channel": "match", "matchId": "...", "text": "..." }`
**Then** the server broadcasts `system:chat_message` only to the 4 match participants
**And** players outside the match do not receive the message

**Given** match chat messages arrive
**When** the ChatPanel is collapsed
**Then** an unread indicator (badge count) appears on the chat toggle button

**Given** a match ends
**When** players return to the lobby
**Then** the match chat history is cleared from the chatStore
**And** the ChatPanel switches back to global lobby chat context

**Given** the chat sidebar is expanded during gameplay
**When** a player needs to play a card or respond to a prompt
**Then** the game table remains fully interactive — the sidebar does not block any game controls or card interactions

## Epic 7: Match History & Player Profile

Players can view their complete match history with per-match scoring detail and review their profile with username and basic stats.

### Story 7.1: Match History Display

As a player,
I want to view my match history with detailed scoring for each game,
So that I can review past games and track my performance.

**Acceptance Criteria:**

**Given** a player navigates to their profile
**When** the match history section loads
**Then** `GET /api/v1/users/:id/matches` returns a paginated list of completed matches ordered by most recent first

**Given** match history data is returned
**When** the MatchHistory component renders
**Then** each match entry shows: date, variant, mode, teammate username, opponent usernames, final score (Red vs Blue), win/loss/abandoned status, and match duration

**Given** a player clicks on a match entry
**When** the detail view expands
**Then** per-hand scoring breakdown is displayed: hand number, card points per team, declarations, bonuses (last trick, Capot), failed contract indicators

**Given** a player has no completed matches
**When** the match history section renders
**Then** an empty state is shown: "No games yet — Quick Play to get started" with a link to the lobby

**Given** the player has many matches
**When** they scroll the match list
**Then** additional matches load via pagination (load more button or infinite scroll)

### Story 7.2: Expanded Player Profile

As a player,
I want my profile to show real stats from my games,
So that I have a meaningful overview of my Belote career.

**Acceptance Criteria:**

**Given** a player navigates to their profile
**When** `GET /api/v1/users/:id/profile` is called
**Then** the server returns: username, createdAt, languagePreference, totalGamesPlayed, wins, losses, abandoned count

**Given** profile data is returned
**When** the ProfilePage renders
**Then** it displays: username, "Member since [date]", total games played, win/loss record, win rate percentage, and the match history section below (from Story 7.1)
**And** the profile uses the Balatro visual register with Space Grotesk for stat numbers

**Given** placeholder sections were created in Epic 1 Story 1.4
**When** Epic 7 is complete
**Then** all placeholder sections on the profile page are replaced with real data — no "coming soon" or empty placeholders remain for Phase 1 features

**Given** a player has zero games
**When** their profile renders
**Then** stats show "0 games played" with the match history empty state, not broken or missing elements

## Epic 8: Croatian Variant, 501 Mode & Game Enhancements

Players can play the Croatian trump variant, 501-point matches, access in-app rules reference, initiate team surrender, and express reactions via preset emotes.

### Story 8.1: Croatian Variant Rules Engine

As a player,
I want to play the Croatian trump variant with its authentic bidding rules,
So that the platform supports both major Balkan Belot variants.

**Acceptance Criteria:**

**Given** a game is initialized with Croatian variant
**When** the rules engine processes the bidding phase
**Then** round 1 follows the same counter-clockwise PICK/PASS pattern as Bitola
**And** in round 2, if the first 3 players pass, the last player (dealer) is FORCED to pick a trump suit — there is no reshuffle

**Given** the Croatian variant is selected
**When** card play and scoring proceed
**Then** all other rules (suit-following, trump obligations, declarations, Belot bonus, scoring, failed contracts, Capot, last-trick bonus) are identical to Bitola variant

**Given** the rules engine receives a Croatian game
**When** `ApplyAction` processes bidding actions
**Then** the variant field in GameState determines which bidding rules apply
**And** all existing Bitola tests continue to pass unchanged

**Given** a room is created
**When** the variant dropdown is configured
**Then** both Bitola and Croatian are available as options

### Story 8.2: 501-Point Match Mode

As a player,
I want to play shorter 501-point matches,
So that I can enjoy a quicker game when I don't have time for a full 1001 match.

**Acceptance Criteria:**

**Given** a room is configured with 501 match mode
**When** a game starts
**Then** the match-end threshold is set to 501 points instead of 1001

**Given** a team's score reaches or exceeds 501
**When** the match-end check runs
**Then** the match ends with the same resolution rules as 1001 (higher score wins; tie goes to contracting team)

**Given** a room is created
**When** the mode dropdown is configured
**Then** both 1001 and 501 are available as options

**Given** the ScorePanel displays during a 501 match
**When** the player views the HUD
**Then** the target score context reflects 501 (not 1001)

### Story 8.3: In-App Rules Reference

As a player,
I want to access a rules reference for both Belot variants,
So that I can look up rules without leaving the platform.

**Acceptance Criteria:**

**Given** a player is in the lobby
**When** they click the "Rules" tab in the top nav
**Then** a rules reference page loads with sections covering: card values, dealing, trump bidding (both variants), suit-following obligations, declarations, Belot bonus, scoring, failed contracts, Capot, and instant-win

**Given** a player is in an active game
**When** they click the rules icon (bottom-right persistent icon)
**Then** the rules reference opens as an overlay that does not interrupt the game
**And** the overlay can be dismissed to return to the game

**Given** the rules reference content
**When** it renders
**Then** it is displayed in the player's selected language (EN or SR) via i18n
**And** the content is structured as static markdown rendered as a React component in `features/rules/`

### Story 8.4: Team Surrender

As a player,
I want to propose surrendering a match to my teammate,
So that we can end a hopeless game without waiting for it to finish.

**Acceptance Criteria:**

**Given** a player is in an active match
**When** they initiate a surrender request via `action:surrender_request`
**Then** their teammate receives a `event:surrender_proposed` prompt: "Your teammate wants to surrender. Accept / Decline"
**And** the opponents are notified that a surrender is being considered

**Given** the teammate accepts the surrender
**When** `action:surrender_accept` is submitted
**Then** the match ends immediately as a win for the opposing team
**And** all players receive `event:match_end` with surrender status
**And** the match record is persisted with surrender outcome

**Given** the teammate declines the surrender
**When** `action:surrender_decline` is submitted
**Then** play continues normally and the proposing player's surrender attempt is consumed (each player may trigger at most once per game)

**Given** a player has already initiated a surrender request in this game
**When** they try to initiate another
**Then** an `error:surrender_exhausted` event is returned

### Story 8.5: In-Game Emotes

As a player,
I want to express reactions during a match using preset emotes,
So that I can communicate emotions and reactions beyond text chat.

**Acceptance Criteria:**

**Given** a player is in an active match
**When** they open the emote picker (button near chat toggle)
**Then** a grid of preset emote options is displayed (e.g., thumbs up, clap, laugh, thinking, facepalm, heart)

**Given** a player selects an emote
**When** `action:emote` is sent with the emote type
**Then** all 4 match participants receive `system:emote` and the emote displays briefly near the sender's seat with a pop-in animation (auto-dismiss after 2s)

**Given** emotes are sent rapidly
**When** a player sends multiple emotes
**Then** a rate limit applies (max 1 emote per 3 seconds per player) to prevent spam

## Epic 9: Player Progression & Competitive Ranked Play

Players earn XP, level up, unlock ranked mode at Level 5, compete in ELO-based matchmaking with placement matches, climb an 8-tier rank system across quarterly seasons, and view leaderboards and career stats.

### Story 9.1: XP System & Level Progression

As a player,
I want to earn XP from matches and level up,
So that I have a sense of progression and can unlock ranked mode.

**Acceptance Criteria:**

**Given** a match completes normally
**When** XP is calculated
**Then** each player earns XP proportional to the game points their team scored in the match
**And** XP is added to their profile and persisted

**Given** a player accumulates enough XP
**When** their XP crosses a level threshold
**Then** their level increments and the new level is reflected on their profile and in the lobby RankBanner

**Given** the RankBanner in the lobby
**When** a player below Level 5 views it
**Then** it shows their current level, XP progress bar to next level, and a prompt: "Reach Level 5 to unlock Ranked mode"

**Given** a player abandons a match
**When** XP outcomes are applied
**Then** the abandoning player receives 0 XP for that match

### Story 9.2: Ranked Queue & ELO Matchmaking

As a Level 5+ player,
I want to queue for ranked matches with ELO-based pairing,
So that I play against opponents of similar skill.

**Acceptance Criteria:**

**Given** a player is Level 5 or above
**When** they view the lobby play options
**Then** the "Ranked" card is active and clickable

**Given** a player below Level 5
**When** they view the Ranked card
**Then** it is disabled at 40% opacity with a tooltip: "Reach Level 5 to unlock"

**Given** a Level 5+ player clicks "Ranked"
**When** they enter the ranked queue
**Then** the server pairs them with players of similar ELO rating
**And** a matchmaking indicator shows "Finding ranked match..."

**Given** 4 players are matched
**When** the ranked game starts
**Then** the match is configured as: 1001 mode, per-move timer, ranked flag set
**And** teams are assigned by the matchmaking system (not self-selected)

### Story 9.3: Placement Matches & Rank Reveal

As a new ranked player in a season,
I want to play placement matches before receiving my rank,
So that my initial rank reflects my actual skill level.

**Acceptance Criteria:**

**Given** a player enters ranked for the first time in a season
**When** they click "Ranked"
**Then** a placement info modal appears: "3 placement matches required to receive your rank"

**Given** a player is in placement
**When** they complete a ranked match
**Then** the RankBanner updates: "Placement: X/3 complete"

**Given** all 3 placement matches are completed
**When** the rank is calculated from placement results
**Then** a full-screen rank reveal animation plays: tier badge glows in with tier-specific color (Iron=grey, Bronze=#cd7f32, Silver=#c0c0c0, Gold=#ffd700, Platinum=#e5e4e2, Diamond=#b9f2ff, Immortal=#ff6b6b, Radiant=accent+glow)
**And** the animation transitions to the updated lobby with the RankBanner showing the new rank

**Given** the placement modal
**When** it is shown
**Then** it appears once per season only — returning ranked players go straight to queue

### Story 9.4: Rank Tiers & Season System

As a ranked player,
I want to climb through rank tiers during quarterly seasons,
So that I have a long-term competitive goal.

**Acceptance Criteria:**

**Given** a player has a rank
**When** they win or lose ranked matches
**Then** their ELO adjusts accordingly and their rank tier updates if thresholds are crossed
**And** the 8 tiers are: Iron, Bronze, Silver, Gold, Platinum, Diamond, Immortal, Radiant

**Given** a player views their rank
**When** the RankBanner renders in ranked state
**Then** it shows: tier badge (tier-specific color + glow), tier name, LP/ELO value, progress bar to next tier, and season countdown

**Given** a quarterly season ends
**When** the season reset runs
**Then** all players' ranks are soft-reset (compressed toward the median)
**And** prior season rank history is preserved and viewable on the profile
**And** a new season begins with placement matches required again

**Given** the season system
**When** I inspect the database schema
**Then** a `seasons` table exists with: `id`, `name`, `started_at`, `ends_at`
**And** a `player_seasons` table exists with: `id`, `user_id`, `season_id`, `elo`, `rank_tier`, `placement_completed`, `games_played`

### Story 9.5: Seasonal Leaderboard

As a competitive player,
I want to view a leaderboard of top-ranked players,
So that I can see where I stand in the community.

**Acceptance Criteria:**

**Given** a player is in the lobby
**When** the Direction 5 layout renders
**Then** the right panel shows the seasonal leaderboard with the top players

**Given** the leaderboard loads
**When** `GET /api/v1/leaderboard?season=current` is called
**Then** it returns the top players ordered by ELO, each showing: rank position, username, tier badge, ELO value

**Given** a player clicks the "Leaderboard" tab in the top nav
**When** the full leaderboard page loads
**Then** a complete paginated leaderboard is shown with the player's own position highlighted if they are ranked

**Given** a season is active
**When** matches complete
**Then** the leaderboard updates to reflect current standings (not real-time — refreshed on page load or periodic poll)

### Story 9.6: Career Statistics & Abandonment Penalties

As a player,
I want to view detailed career stats and have competitive abandonment penalized,
So that long-term performance is tracked and ranked integrity is maintained.

**Acceptance Criteria:**

**Given** a player views their profile
**When** the career statistics section loads
**Then** it displays: total wins/losses, win rate, points scored (career total), rank history across all seasons (chart or timeline), games played per season

**Given** a player abandons a ranked match
**When** ELO penalties are applied
**Then** the abandoning player receives a scaled ELO penalty based on game progress (higher penalty for later-stage abandonment)
**And** the remaining players receive no ELO change — the match is voided

**Given** a casual match is abandoned
**When** outcomes are applied
**Then** the remaining 3 players receive partial XP based on game progress at time of abandonment
**And** the abandoning player receives 0 XP

**Given** FR38 and FR43 have undefined formulas
**When** implementing ELO penalty scaling and partial XP calculation
**Then** placeholder formulas are implemented with configurable constants that can be tuned based on product decisions

## Epic 10: Social & Friend System

Players can use social login, search for other players, manage friend lists, view public profiles, and use the platform in additional languages.

### Story 10.1: Social Login

As a player,
I want to register and log in using Google or Facebook,
So that I don't need to create a separate account.

**Acceptance Criteria:**

**Given** a player is on the registration or login page
**When** they click "Continue with Google" or "Continue with Facebook"
**Then** the OAuth flow initiates, redirecting to the provider's consent screen

**Given** the OAuth provider returns an authorization code
**When** the server exchanges it for user info
**Then** a new user account is created (if first login) or the existing account is matched
**And** the player receives JWT tokens and is redirected to the lobby

**Given** a player previously registered with email
**When** they attempt social login with the same email
**Then** the accounts are linked and the player can use either login method

### Story 10.2: Player Search

As a player,
I want to search for other players by username,
So that I can find friends and view their profiles.

**Acceptance Criteria:**

**Given** a player is in the lobby or profile section
**When** they use a player search input
**Then** `GET /api/v1/users?search=[query]` returns matching usernames with live-filtering

**Given** search results are returned
**When** the player clicks a result
**Then** they are navigated to that player's public profile

**Given** no players match the query
**When** the results render
**Then** an empty state is shown: "No players found matching '[query]'"

### Story 10.3: Friend Requests & Friend List

As a player,
I want to send friend requests and maintain a friend list,
So that I can easily find and play with people I know.

**Acceptance Criteria:**

**Given** a player views another player's profile
**When** they click "Add Friend"
**Then** a friend request is sent via `POST /api/v1/friends/request`
**And** the recipient receives a notification

**Given** a player has pending friend requests
**When** they view their friend requests
**Then** each request shows the sender's username with Accept and Decline buttons

**Given** a friend request is accepted
**When** both players view their friend list
**Then** each appears in the other's friend list with online/offline status

**Given** a player views their friend list
**When** a friend is online
**Then** their status shows as online and an "Invite to Room" action is available

### Story 10.4: Public Player Profiles

As a player,
I want to view other players' public profiles,
So that I can see their stats and rank.

**Acceptance Criteria:**

**Given** a player navigates to another player's profile
**When** `GET /api/v1/users/:id/profile` is called
**Then** public information is returned: username, level, rank tier, win/loss record, member since
**And** private information (email, language preference) is NOT included

**Given** the public profile renders
**When** viewed by another player
**Then** it shows the same visual layout as the player's own profile but without edit capabilities
**And** an "Add Friend" button is shown if not already friends

### Story 10.5: Additional Languages

As a player,
I want to use the platform in Macedonian or Croatian,
So that I can play in my native language.

**Acceptance Criteria:**

**Given** the i18n system is already configured for EN and SR
**When** Macedonian and Croatian translation files are added
**Then** `mk.json` and `hr.json` are created in `shared/i18n/` with all translated strings

**Given** a player opens the language selector
**When** they view available languages
**Then** four options are listed: English, Serbian (Latin), Macedonian, Croatian

**Given** a player selects Macedonian or Croatian
**When** the preference is saved
**Then** the UI re-renders in the selected language and the preference is persisted

## Epic 11: Spectator Mode, Achievements & Cosmetics

Players can spectate live matches, earn and display achievements, and purchase cosmetic items with no gameplay impact.

### Story 11.1: Spectator Mode

As a player,
I want to watch ongoing matches as an observer,
So that I can learn from other players or watch friends play.

**Acceptance Criteria:**

**Given** a match is in progress
**When** a player views the room in the browse list
**Then** a "Spectate" button is available alongside the room info

**Given** a player clicks "Spectate"
**When** they join the match as an observer
**Then** they see the full game table with all 4 players' cards face-down (no card peeking), the trick area, score panel, and trump indicator
**And** they receive all `event:` broadcasts in real-time

**Given** a spectator is watching
**When** they view the game
**Then** they cannot interact with any game elements (no card play, no prompts, no pause)
**And** they can access the match chat in read-only mode

### Story 11.2: Achievements & Badges

As a player,
I want to earn achievements and display badges on my profile,
So that I have additional goals beyond winning matches.

**Acceptance Criteria:**

**Given** a set of achievements is defined
**When** a player meets the criteria (e.g., "First Win", "100 Games Played", "Capot Master — win 10 Capots", "Season Veteran — complete 3 seasons")
**Then** the achievement is unlocked and the player is notified with a toast

**Given** a player has earned achievements
**When** they view their profile
**Then** earned badges are displayed in a trophy section with achievement name, icon, and date earned

**Given** another player views a public profile
**When** the profile renders
**Then** earned badges are visible to all viewers

### Story 11.3: Cosmetic Store

As a player,
I want to purchase cosmetic items like card backs and table themes,
So that I can personalize my game experience.

**Acceptance Criteria:**

**Given** a player opens the cosmetics store
**When** the store page renders
**Then** available items are displayed: card back designs, table themes, with preview images and prices

**Given** a player purchases a cosmetic item
**When** the transaction completes
**Then** the item is added to their inventory and can be equipped
**And** no gameplay advantage is gained (cosmetic only)

**Given** a player has equipped a card back or table theme
**When** they enter a game
**Then** their custom card back is visible to all players and the table theme applies to their view

## Epic 12: Tournaments & Mobile

Players can compete in bracket-style tournaments and access the platform via mobile.

### Story 12.1: Tournament System

As a competitive player,
I want to participate in bracket-style tournaments,
So that I can compete in organized events with seasonal scheduling.

**Acceptance Criteria:**

**Given** a tournament is scheduled
**When** a player views the tournaments section
**Then** they see upcoming tournaments with: name, date, format (bracket type), entry requirements, current registrations

**Given** a player registers for a tournament
**When** the tournament starts
**Then** bracket pairings are generated and matches are scheduled
**And** results advance winners through the bracket

**Given** a tournament concludes
**When** a winner is determined
**Then** results are posted with final standings, and tournament-specific rewards (badges, cosmetics) are distributed

### Story 12.2: Mobile Experience

As a player,
I want to access Belote on my phone or tablet,
So that I can play on the go.

**Acceptance Criteria:**

**Given** the platform is desktop-only
**When** mobile support is added
**Then** the platform is accessible as a PWA (progressive web app) or native client optimized for touch interaction

**Given** a player opens the platform on mobile
**When** the UI renders
**Then** the layout adapts to mobile viewport (portrait and landscape) with touch-friendly card interaction (tap to play)
**And** all core features are functional: lobby, room management, game play, chat, profile

**Given** a player installs the PWA
**When** they open it from their home screen
**Then** it launches in a standalone app-like experience with offline splash screen and push notification support for match invites
