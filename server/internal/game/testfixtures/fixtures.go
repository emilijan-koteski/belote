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
