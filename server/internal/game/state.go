package game

import (
	"math/rand/v2"
	"slices"
	"time"
)

// PlayerState represents the state of a single player in the game.
type PlayerState struct {
	Hand         []Card        `json:"hand"`
	Seat         int           `json:"seat"`
	UserID       uint          `json:"userId"`
	Username     string        `json:"username"`
	Team         string        `json:"team"`
	Declarations []Declaration `json:"declarations"`
	Connected    bool          `json:"connected"`
}

// TrickCard represents a single card played in a trick, with the player who played it.
type TrickCard struct {
	Card       Card `json:"card"`
	PlayerSeat int  `json:"playerSeat"`
}

// HandResult captures the scoring breakdown for a completed hand.
// Populated by scoreHand() before startNewHand() or PhaseMatchEnd,
// so the session manager can broadcast the full breakdown to clients.
type HandResult struct {
	RedCardPoints   int  `json:"redCardPoints"`   // Trick-taking card points (Red) before bonus
	BlueCardPoints  int  `json:"blueCardPoints"`  // Trick-taking card points (Blue) before bonus
	RedDeclPoints   int  `json:"redDeclPoints"`   // Declaration points (Red)
	BlueDeclPoints  int  `json:"blueDeclPoints"`  // Declaration points (Blue)
	LastTrickTeam   int  `json:"lastTrickTeam"`   // Team that won last trick (0=Red, 1=Blue)
	LastTrickBonus  int  `json:"lastTrickBonus"`  // 10 (normal) or 0 (capot replaces it)
	Capot           bool `json:"capot"`           // One team took all 8 tricks
	CapotTeam       *int `json:"capotTeam"`       // Team with capot (nil if no capot)
	CapotBonus      int  `json:"capotBonus"`      // 100 or 0
	FailedContract  bool `json:"failedContract"`  // Contracting team lost the hand
	ContractingTeam int  `json:"contractingTeam"` // Team that called trump (0=Red, 1=Blue)
	RedHandTotal    int  `json:"redHandTotal"`    // Points actually awarded to Red this hand
	BlueHandTotal   int  `json:"blueHandTotal"`   // Points actually awarded to Blue this hand
}

// GameState is the complete, serializable game state.
// Fields are ordered per Architecture spec:
// 1. Match metadata
// 2. Current hand state
// 3. Current trick state
// 4. Player states
// 5. Scoring
// 6. Timer state
type GameState struct {
	// Match metadata
	ID        uint    `json:"id"`
	RoomID    uint    `json:"roomId"`
	Variant   Variant `json:"variant"`
	MatchMode string  `json:"matchMode"`
	Phase     Phase   `json:"phase"`
	OwnerSeat int     `json:"ownerSeat"` // Seat index of the room owner (for pause override)

	// Current hand state
	HandNumber       int    `json:"handNumber"`
	DealerSeat       int    `json:"dealerSeat"`
	TrumpSuit        *Suit  `json:"trumpSuit"`
	TrumpCallerSeat  *int   `json:"trumpCallerSeat"`
	TrumpCandidate   *Card  `json:"trumpCandidate"`
	BiddingRound     int    `json:"biddingRound"`
	BiddingPassCount int    `json:"biddingPassCount"`
	Deck             []Card `json:"deck"` // Undealt remainder during bidding (11 cards); empty once bidding resolves.

	// Current trick state
	TrickNumber          int         `json:"trickNumber"`
	CurrentTrick         []TrickCard `json:"currentTrick"`
	LeadSuit             *Suit       `json:"leadSuit"`
	TrickWinnerSeat      *int        `json:"trickWinnerSeat"`
	AwaitingDeclaration  bool        `json:"awaitingDeclaration"`
	DeclarationsResolved bool        `json:"declarationsResolved"`

	// Player states
	Players [4]PlayerState `json:"players"`

	// Scoring (index 0=Red team, 1=Blue team)
	TeamScores        [2]int      `json:"teamScores"`
	HandPoints        [2]int      `json:"handPoints"`
	DeclarationPoints [2]int      `json:"declarationPoints"`
	TricksWon         [2]int      `json:"tricksWon"`
	PendingBelotSeat  *int        `json:"pendingBelotSeat"`
	BelotAnnounced    bool        `json:"belotAnnounced"`
	WinnerTeam        *int        `json:"winnerTeam"`
	LastHandResult    *HandResult `json:"lastHandResult"`

	// Timer state
	ActivePlayerSeat int        `json:"activePlayerSeat"`
	TurnExpiresAt    *time.Time `json:"turnExpiresAt"`
	TimerDurationSec int        `json:"timerDurationSec"`

	// Pause state
	PreviousPhase     Phase   `json:"previousPhase"`     // Phase before pause/disconnect (for resume)
	PausedPlayers     [4]bool `json:"pausedPlayers"`     // Which seats have active pauses
	PauseUsed         [4]bool `json:"pauseUsed"`         // Which seats have used their one-time pause
	TurnTimeRemaining int64   `json:"turnTimeRemaining"` // Milliseconds remaining on turn timer when paused/disconnected

	// Surrender state (Story 8.2)
	SurrenderProposerSeat *int    `json:"surrenderProposerSeat"` // nil when no proposal pending; seat of the proposer otherwise
	SurrenderUsed         [4]bool `json:"surrenderUsed"`         // each seat may initiate a surrender at most once per match

	// Disconnect state
	DisconnectedSeat   int        `json:"disconnectedSeat"`   // Seat index of disconnected player (-1 if none)
	ReconnectExpiresAt *time.Time `json:"reconnectExpiresAt"` // Absolute timestamp when reconnect window closes
}

// TeamRed is the index for the Red team (seats 0, 2) in score arrays.
const TeamRed = 0

// TeamBlue is the index for the Blue team (seats 1, 3) in score arrays.
const TeamBlue = 1

// TeamForSeat returns the team index (0=Red, 1=Blue) for a given seat number.
func TeamForSeat(seat int) int {
	return seat % 2
}

// ShuffleDeck randomly shuffles a deck of cards in-place.
// Uses math/rand/v2 which is automatically seeded in Go 1.22+.
func ShuffleDeck(deck []Card) {
	rand.Shuffle(len(deck), func(i, j int) {
		deck[i], deck[j] = deck[j], deck[i]
	})
}

// NewGame creates a new game state with 4 players, shuffles and deals cards
// using the Bitola 3+2 dealing sequence.
func NewGame(playerIDs [4]uint, usernames [4]string, variant Variant, matchMode string, roomID uint) *GameState {
	gs := &GameState{
		RoomID:           roomID,
		Variant:          variant,
		MatchMode:        matchMode,
		Phase:            PhaseDealing,
		HandNumber:       1,
		DealerSeat:       0,
		ActivePlayerSeat: 1, // player after dealer (counter-clockwise)
		BiddingRound:     1,
		BiddingPassCount: 0,
		TrickNumber:      0,
		CurrentTrick:     []TrickCard{},
		DisconnectedSeat: -1,
	}

	// Assign players to seats and teams
	for i, userID := range playerIDs {
		team := "red"
		if i%2 == 1 {
			team = "blue"
		}
		gs.Players[i] = PlayerState{
			Hand:         []Card{},
			Seat:         i,
			UserID:       userID,
			Username:     usernames[i],
			Team:         team,
			Declarations: []Declaration{},
			Connected:    true,
		}
	}

	// Generate, shuffle, and deal stage-1 (5 cards per seat + visible candidate + 11-card Deck).
	// Instant-win can't be determined here — final hands aren't known until the picker is decided.
	deck := NewDeck()
	ShuffleDeck(deck)
	dealCards(gs, deck)

	return gs
}

// dealCards performs the stage-1 Bitola deal:
// Round 1: 3 cards to each player counter-clockwise from dealer (12 cards)
// Round 2: 2 cards to each player (8 cards, 20 total)
// Then the next card (deck[20]) is lifted onto the table as TrumpCandidate.
// The remaining 11 cards (deck[21:32]) are stored in gs.Deck for stage-2
// distribution after a player picks trump.
//
// Each player holds 5 cards after stage-1; the candidate is public and held
// aside, not in any hand. handlePickTrump completes the deal once bidding
// resolves.
func dealCards(gs *GameState, deck []Card) {
	cardIdx := 0
	dealer := gs.DealerSeat

	// Round 1: 3 cards to each player
	for i := 0; i < 4; i++ {
		seat := (dealer + 1 + i) % 4 // start from player after dealer
		gs.Players[seat].Hand = append(gs.Players[seat].Hand, slices.Clone(deck[cardIdx:cardIdx+3])...)
		cardIdx += 3
	}

	// Round 2: 2 cards to each player
	for i := 0; i < 4; i++ {
		seat := (dealer + 1 + i) % 4
		gs.Players[seat].Hand = append(gs.Players[seat].Hand, slices.Clone(deck[cardIdx:cardIdx+2])...)
		cardIdx += 2
	}

	// Trump candidate: flipped face-up on the table — public to all players,
	// not in any hand yet. Round 1 bidding offers this exact card; round 2
	// allows free-suit choice. Picker takes it as their 8th card during stage-2.
	candidate := deck[cardIdx]
	gs.TrumpCandidate = &candidate
	cardIdx++

	// Remaining 11 cards held in the deck for stage-2 distribution.
	gs.Deck = slices.Clone(deck[cardIdx:])
}
