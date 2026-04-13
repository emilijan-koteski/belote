package game

import (
	"fmt"
	"sort"
)

// suitOrder maps suits to their sort priority for auto-play card selection.
// Order: Spades(0) > Hearts(1) > Diamonds(2) > Clubs(3)
var suitOrder = map[Suit]int{
	SuitSpades:   0,
	SuitHearts:   1,
	SuitDiamonds: 2,
	SuitClubs:    3,
}

// rankOrder maps ranks to their sort priority for auto-play card selection.
// Order: 7(0) > 8(1) > 9(2) > T(3) > J(4) > Q(5) > K(6) > A(7)
var rankOrder = map[Rank]int{
	Rank7:     0,
	Rank8:     1,
	Rank9:     2,
	RankTen:   3,
	RankJack:  4,
	RankQueen: 5,
	RankKing:  6,
	RankAce:   7,
}

// AutoPlay selects the first legal card for the active player, sorted by
// suit (S, H, D, C) then rank (7, 8, 9, T, J, Q, K, A).
// This is a pure function — no side effects.
func AutoPlay(state *GameState) (string, error) {
	seat := state.ActivePlayerSeat
	legal := legalCards(state, seat)
	if len(legal) == 0 {
		return "", fmt.Errorf("auto-play: no legal cards for seat %d", seat)
	}

	sort.Slice(legal, func(i, j int) bool {
		si, sj := suitOrder[legal[i].Suit], suitOrder[legal[j].Suit]
		if si != sj {
			return si < sj
		}
		return rankOrder[legal[i].Rank] < rankOrder[legal[j].Rank]
	})

	return legal[0].String(), nil
}
