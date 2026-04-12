package game

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Internal tests for unexported checkInstantWin function.
// These tests use deterministic card distributions to verify instant-win detection.

func TestCheckInstantWin_AllTrumpCards(t *testing.T) {
	trumpCandidate := Card{Rank: Rank7, Suit: SuitHearts}
	gs := &GameState{
		TrumpCandidate: &trumpCandidate,
		Players: [4]PlayerState{
			{Seat: 0, Hand: []Card{
				{Rank: Rank7, Suit: SuitSpades}, {Rank: Rank8, Suit: SuitSpades},
				{Rank: Rank9, Suit: SuitSpades}, {Rank: RankTen, Suit: SuitSpades},
				{Rank: RankJack, Suit: SuitSpades}, {Rank: RankQueen, Suit: SuitSpades},
				{Rank: RankKing, Suit: SuitSpades}, {Rank: RankAce, Suit: SuitSpades},
			}},
			{Seat: 1, Hand: []Card{
				{Rank: Rank7, Suit: SuitHearts}, {Rank: Rank8, Suit: SuitHearts},
				{Rank: Rank9, Suit: SuitHearts}, {Rank: RankTen, Suit: SuitHearts},
				{Rank: RankJack, Suit: SuitHearts}, {Rank: RankQueen, Suit: SuitHearts},
				{Rank: RankKing, Suit: SuitHearts}, {Rank: RankAce, Suit: SuitHearts},
			}},
			{Seat: 2, Hand: []Card{
				{Rank: Rank7, Suit: SuitDiamonds}, {Rank: Rank8, Suit: SuitDiamonds},
				{Rank: Rank9, Suit: SuitDiamonds}, {Rank: RankTen, Suit: SuitDiamonds},
				{Rank: RankJack, Suit: SuitDiamonds}, {Rank: RankQueen, Suit: SuitDiamonds},
				{Rank: RankKing, Suit: SuitDiamonds}, {Rank: RankAce, Suit: SuitDiamonds},
			}},
			{Seat: 3, Hand: []Card{
				{Rank: Rank7, Suit: SuitClubs}, {Rank: Rank8, Suit: SuitClubs},
				{Rank: Rank9, Suit: SuitClubs}, {Rank: RankTen, Suit: SuitClubs},
				{Rank: RankJack, Suit: SuitClubs}, {Rank: RankQueen, Suit: SuitClubs},
				{Rank: RankKing, Suit: SuitClubs}, {Rank: RankAce, Suit: SuitClubs},
			}},
		},
	}

	result := checkInstantWin(gs)

	require.NotNil(t, result, "should detect instant-win")
	assert.Equal(t, TeamBlue, *result, "seat 1 (Blue) has all 8 Hearts (trump)")
}

func TestCheckInstantWin_NoInstantWin(t *testing.T) {
	trumpCandidate := Card{Rank: Rank7, Suit: SuitHearts}
	gs := &GameState{
		TrumpCandidate: &trumpCandidate,
		Players: [4]PlayerState{
			{Seat: 0, Hand: []Card{
				{Rank: Rank7, Suit: SuitHearts}, // 1 heart on seat 0
				{Rank: Rank8, Suit: SuitSpades}, {Rank: Rank9, Suit: SuitSpades},
				{Rank: RankTen, Suit: SuitSpades}, {Rank: RankJack, Suit: SuitSpades},
				{Rank: RankQueen, Suit: SuitSpades}, {Rank: RankKing, Suit: SuitSpades},
				{Rank: RankAce, Suit: SuitSpades},
			}},
			{Seat: 1, Hand: []Card{
				{Rank: Rank7, Suit: SuitSpades}, // 1 spade mixed in
				{Rank: Rank8, Suit: SuitHearts}, {Rank: Rank9, Suit: SuitHearts},
				{Rank: RankTen, Suit: SuitHearts}, {Rank: RankJack, Suit: SuitHearts},
				{Rank: RankQueen, Suit: SuitHearts}, {Rank: RankKing, Suit: SuitHearts},
				{Rank: RankAce, Suit: SuitHearts},
			}},
			{Seat: 2, Hand: []Card{
				{Rank: Rank7, Suit: SuitDiamonds}, {Rank: Rank8, Suit: SuitDiamonds},
				{Rank: Rank9, Suit: SuitDiamonds}, {Rank: RankTen, Suit: SuitDiamonds},
				{Rank: RankJack, Suit: SuitDiamonds}, {Rank: RankQueen, Suit: SuitDiamonds},
				{Rank: RankKing, Suit: SuitDiamonds}, {Rank: RankAce, Suit: SuitDiamonds},
			}},
			{Seat: 3, Hand: []Card{
				{Rank: Rank7, Suit: SuitClubs}, {Rank: Rank8, Suit: SuitClubs},
				{Rank: Rank9, Suit: SuitClubs}, {Rank: RankTen, Suit: SuitClubs},
				{Rank: RankJack, Suit: SuitClubs}, {Rank: RankQueen, Suit: SuitClubs},
				{Rank: RankKing, Suit: SuitClubs}, {Rank: RankAce, Suit: SuitClubs},
			}},
		},
	}

	result := checkInstantWin(gs)
	assert.Nil(t, result, "no player has all 8 trump cards")
}

func TestCheckInstantWin_NilTrumpCandidate(t *testing.T) {
	gs := &GameState{
		TrumpCandidate: nil,
	}

	result := checkInstantWin(gs)
	assert.Nil(t, result, "should return nil when TrumpCandidate is nil")
}

func TestCheckInstantWin_Seat0RedTeam(t *testing.T) {
	// Verify correct team is returned when seat 0 (Red) has all trump
	trumpCandidate := Card{Rank: Rank7, Suit: SuitSpades}
	gs := &GameState{
		TrumpCandidate: &trumpCandidate,
		Players: [4]PlayerState{
			{Seat: 0, Hand: []Card{
				{Rank: Rank7, Suit: SuitSpades}, {Rank: Rank8, Suit: SuitSpades},
				{Rank: Rank9, Suit: SuitSpades}, {Rank: RankTen, Suit: SuitSpades},
				{Rank: RankJack, Suit: SuitSpades}, {Rank: RankQueen, Suit: SuitSpades},
				{Rank: RankKing, Suit: SuitSpades}, {Rank: RankAce, Suit: SuitSpades},
			}},
			{Seat: 1, Hand: []Card{{Rank: Rank7, Suit: SuitHearts}}},
			{Seat: 2, Hand: []Card{{Rank: Rank7, Suit: SuitDiamonds}}},
			{Seat: 3, Hand: []Card{{Rank: Rank7, Suit: SuitClubs}}},
		},
	}

	result := checkInstantWin(gs)

	require.NotNil(t, result)
	assert.Equal(t, TeamRed, *result, "seat 0 (Red) has all 8 Spades (trump)")
}
