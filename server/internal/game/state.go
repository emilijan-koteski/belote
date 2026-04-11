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
	Team         string        `json:"team"`
	Declarations []Declaration `json:"declarations"`
	Connected    bool          `json:"connected"`
}

// TrickCard represents a single card played in a trick, with the player who played it.
type TrickCard struct {
	Card       Card `json:"card"`
	PlayerSeat int  `json:"playerSeat"`
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

	// Current hand state
	HandNumber       int   `json:"handNumber"`
	DealerSeat       int   `json:"dealerSeat"`
	TrumpSuit        *Suit `json:"trumpSuit"`
	TrumpCallerSeat  *int  `json:"trumpCallerSeat"`
	TrumpCandidate   *Card `json:"trumpCandidate"`
	BiddingRound     int   `json:"biddingRound"`
	BiddingPassCount int   `json:"biddingPassCount"`

	// Current trick state
	TrickNumber     int         `json:"trickNumber"`
	CurrentTrick    []TrickCard `json:"currentTrick"`
	LeadSuit        *Suit       `json:"leadSuit"`
	TrickWinnerSeat *int        `json:"trickWinnerSeat"`

	// Player states
	Players [4]PlayerState `json:"players"`

	// Scoring (index 0=Red team, 1=Blue team)
	TeamScores        [2]int `json:"teamScores"`
	HandPoints        [2]int `json:"handPoints"`
	DeclarationPoints [2]int `json:"declarationPoints"`
	TricksWon         [2]int `json:"tricksWon"`

	// Timer state
	ActivePlayerSeat int        `json:"activePlayerSeat"`
	TurnExpiresAt    *time.Time `json:"turnExpiresAt"`
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
func NewGame(playerIDs [4]uint, variant Variant, matchMode string, roomID uint) *GameState {
	gs := &GameState{
		RoomID:           roomID,
		Variant:          variant,
		MatchMode:        matchMode,
		Phase:            PhaseBidding,
		HandNumber:       1,
		DealerSeat:       0,
		ActivePlayerSeat: 1, // player after dealer (counter-clockwise)
		BiddingRound:     1,
		BiddingPassCount: 0,
		TrickNumber:      0,
		CurrentTrick:     []TrickCard{},
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
			Team:         team,
			Declarations: []Declaration{},
			Connected:    true,
		}
	}

	// Generate, shuffle, and deal
	deck := NewDeck()
	ShuffleDeck(deck)
	dealCards(gs, deck)

	return gs
}

// dealCards deals cards from the deck using the Bitola 3+2+3 sequence:
// Round 1: 3 cards to each player counter-clockwise from dealer (12 cards)
// Trump candidate is revealed (next card after round 1, at deck index 12)
// Round 2: 2 cards to each player (8 cards, 20 total)
// Round 3: 3 cards to each player (12 cards, 32 total)
// Each player ends with 8 cards. The trump candidate is a card that ends up
// in a player's hand — its suit is the proposed trump for bidding.
func dealCards(gs *GameState, deck []Card) {
	cardIdx := 0
	dealer := gs.DealerSeat

	// Round 1: 3 cards to each player
	for i := 0; i < 4; i++ {
		seat := (dealer + 1 + i) % 4 // start from player after dealer
		gs.Players[seat].Hand = append(gs.Players[seat].Hand, slices.Clone(deck[cardIdx:cardIdx+3])...)
		cardIdx += 3
	}

	// Trump candidate: the next card in the deck after round 1 (deck[12]).
	// In Bitola Belote, this card is revealed face-up during dealing to show
	// the proposed trump suit, then dealt normally to a player in round 2.
	// The card exists both as TrumpCandidate (for bidding reference) and in
	// a player's hand — this is intentional and matches the real game.
	candidate := deck[cardIdx]
	gs.TrumpCandidate = &candidate

	// Round 2: 2 cards to each player
	for i := 0; i < 4; i++ {
		seat := (dealer + 1 + i) % 4
		gs.Players[seat].Hand = append(gs.Players[seat].Hand, slices.Clone(deck[cardIdx:cardIdx+2])...)
		cardIdx += 2
	}

	// Round 3: 3 cards to each player
	for i := 0; i < 4; i++ {
		seat := (dealer + 1 + i) % 4
		gs.Players[seat].Hand = append(gs.Players[seat].Hand, slices.Clone(deck[cardIdx:cardIdx+3])...)
		cardIdx += 3
	}
}
