package testfixtures

import "github.com/emilijan/belote/server/internal/game"

// NewGameJustDealt returns a valid GameState in the bidding phase with all 4
// players holding 8 cards. Uses a deterministic card distribution (no shuffle)
// for reproducible tests.
//
// Seat 0 (Red):  7S 8S 9S TS JS QS KS AS  (all Spades)
// Seat 1 (Blue): 7H 8H 9H TH JH QH KH AH  (all Hearts)
// Seat 2 (Red):  7D 8D 9D TD JD QD KD AD  (all Diamonds)
// Seat 3 (Blue): 7C 8C 9C TC JC QC KC AC  (all Clubs)
//
// Trump candidate: 7H (Hearts)
// Dealer: seat 0, Active bidder: seat 1
func NewGameJustDealt() *game.GameState {
	trumpCandidate := game.Card{Rank: game.Rank7, Suit: game.SuitHearts}

	return &game.GameState{
		RoomID:           1,
		Variant:          game.VariantBitola,
		MatchMode:        "1001",
		Phase:            game.PhaseBidding,
		HandNumber:       1,
		DealerSeat:       0,
		TrumpCandidate:   &trumpCandidate,
		BiddingRound:     1,
		BiddingPassCount: 0,
		ActivePlayerSeat: 1,
		TrickNumber:      0,
		CurrentTrick:     []game.TrickCard{},
		Players: [4]game.PlayerState{
			{
				Hand:         spadesHand(),
				Seat:         0,
				UserID:       10,
				Team:         "red",
				Declarations: []game.Declaration{},
				Connected:    true,
			},
			{
				Hand:         heartsHand(),
				Seat:         1,
				UserID:       20,
				Team:         "blue",
				Declarations: []game.Declaration{},
				Connected:    true,
			},
			{
				Hand:         diamondsHand(),
				Seat:         2,
				UserID:       30,
				Team:         "red",
				Declarations: []game.Declaration{},
				Connected:    true,
			},
			{
				Hand:         clubsHand(),
				Seat:         3,
				UserID:       40,
				Team:         "blue",
				Declarations: []game.Declaration{},
				Connected:    true,
			},
		},
	}
}

func spadesHand() []game.Card {
	return allRanksOfSuit(game.SuitSpades)
}

func heartsHand() []game.Card {
	return allRanksOfSuit(game.SuitHearts)
}

func diamondsHand() []game.Card {
	return allRanksOfSuit(game.SuitDiamonds)
}

func clubsHand() []game.Card {
	return allRanksOfSuit(game.SuitClubs)
}

func allRanksOfSuit(suit game.Suit) []game.Card {
	cards := make([]game.Card, 0, 8)
	for _, rank := range game.AllRanks {
		cards = append(cards, game.Card{Rank: rank, Suit: suit})
	}
	return cards
}

// NewGameMidBidding returns a GameState with the specified number of passes
// already recorded. Correctly tracks BiddingRound and ActivePlayerSeat.
//
// passCount 0: same as NewGameJustDealt (round 1, seat 1 active)
// passCount 1-3: round 1 with passes applied
// passCount 4: round 2 just started (0 passes in round 2, seat 1 active)
// passCount 5-7: round 2 with passes applied
//
// Dealer is always seat 0. First bidder is seat 1.
func NewGameMidBidding(passCount int) *game.GameState {
	gs := NewGameJustDealt()

	if passCount <= 0 {
		return gs
	}

	// Clamp to valid range: max 7 (round 2 with 3 passes).
	// passCount 8 would trigger a reshuffle, not a mid-bidding state.
	if passCount > 7 {
		passCount = 7
	}

	if passCount <= 4 {
		// Round 1 passes
		passesInRound := passCount
		if passesInRound == 4 {
			// All 4 passed in round 1 — transition to round 2
			gs.BiddingRound = 2
			gs.BiddingPassCount = 0
			gs.ActivePlayerSeat = (gs.DealerSeat + 1) % 4 // reset to first bidder
		} else {
			gs.BiddingPassCount = passesInRound
			gs.ActivePlayerSeat = (1 + passesInRound) % 4 // seat 1 is first bidder
		}
	} else {
		// Round 2 passes (passCount 5-7)
		passesInRound2 := passCount - 4
		gs.BiddingRound = 2
		gs.BiddingPassCount = passesInRound2
		gs.ActivePlayerSeat = (1 + passesInRound2) % 4 // seat 1 is first bidder in round 2
	}

	return gs
}
