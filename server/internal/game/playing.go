package game

import (
	"github.com/emilijan/belote/server/internal/apperr"
)

// handlePlaying processes card play actions during the playing phase.
// Pure function — no side effects. When the 4th card is played, the trick
// is resolved atomically within the same call.
func handlePlaying(state *GameState, action Action) (*GameState, error) {
	if state.Phase != PhasePlaying {
		return nil, apperr.ErrWrongPhase
	}

	switch action.Type {
	case ActionPlayCard:
		return handlePlayCard(state, action)
	default:
		// ActionDeclare, ActionSkipDeclare handled in Story 3.4
		return nil, apperr.ErrWrongPhase
	}
}

// handlePlayCard validates and processes a play_card action.
func handlePlayCard(state *GameState, action Action) (*GameState, error) {
	// Validate turn
	if action.PlayerSeat != state.ActivePlayerSeat {
		return nil, apperr.ErrNotYourTurn
	}

	// Validate card is provided and exists in hand
	if action.Card == nil {
		return nil, apperr.ErrInvalidCard
	}
	if !playerHasCard(state, action.PlayerSeat, *action.Card) {
		return nil, apperr.ErrInvalidCard
	}

	// Validate legal play
	if !isCardLegal(state, action.PlayerSeat, *action.Card) {
		return nil, apperr.ErrIllegalPlay
	}

	// Clone state before mutation
	newState := cloneGameState(state)
	card := *action.Card

	// Remove card from player's hand
	newState.Players[action.PlayerSeat].Hand = removeCard(
		newState.Players[action.PlayerSeat].Hand, card,
	)

	// Add card to current trick
	newState.CurrentTrick = append(newState.CurrentTrick, TrickCard{
		Card:       card,
		PlayerSeat: action.PlayerSeat,
	})

	// Set lead suit on first card of trick
	if len(newState.CurrentTrick) == 1 {
		suit := card.Suit
		newState.LeadSuit = &suit
	}

	// Advance active player
	newState.ActivePlayerSeat = (newState.ActivePlayerSeat + 1) % 4

	// Resolve trick if 4 cards have been played
	if len(newState.CurrentTrick) == 4 {
		resolveTrick(newState)
	}

	return newState, nil
}

// resolveTrick determines the trick winner, calculates points, and sets up
// the next trick (or transitions to hand scoring after trick 8).
// Mutates the already-cloned state in place.
func resolveTrick(state *GameState) {
	trumpSuit := *state.TrumpSuit

	// Determine winner and calculate points
	winnerSeat := determineTrickWinner(state.CurrentTrick, trumpSuit)
	points := calculateTrickPoints(state.CurrentTrick, trumpSuit)

	// Award points and tricks to winning team
	winnerTeam := TeamForSeat(winnerSeat)
	state.HandPoints[winnerTeam] += points
	state.TricksWon[winnerTeam]++
	state.TrickWinnerSeat = &winnerSeat

	// Check if this was the last trick
	if state.TrickNumber == 8 {
		state.Phase = PhaseHandScoring
		return
	}

	// Set up next trick
	state.TrickNumber++
	state.CurrentTrick = nil
	state.LeadSuit = nil
	state.TrickWinnerSeat = nil
	state.ActivePlayerSeat = winnerSeat // winner leads next trick
}

// determineTrickWinner returns the seat index of the player who wins the trick.
// If any trump was played, the highest trump wins. Otherwise, the highest card
// of the led suit wins.
func determineTrickWinner(trick []TrickCard, trumpSuit Suit) int {
	return currentTrickWinnerSeat(trick, trumpSuit)
}

// calculateTrickPoints returns the total card point value of all cards in the trick.
func calculateTrickPoints(trick []TrickCard, trumpSuit Suit) int {
	total := 0
	for _, tc := range trick {
		if tc.Card.Suit == trumpSuit {
			total += TrumpCardPoints[tc.Card.Rank]
		} else {
			total += NonTrumpCardPoints[tc.Card.Rank]
		}
	}
	return total
}

// playerHasCard checks whether the player at the given seat holds the specified card.
func playerHasCard(state *GameState, seat int, card Card) bool {
	for _, c := range state.Players[seat].Hand {
		if c.Rank == card.Rank && c.Suit == card.Suit {
			return true
		}
	}
	return false
}

// removeCard returns a new slice with the first matching card removed.
func removeCard(hand []Card, card Card) []Card {
	c := len(hand)
	if c > 0 {
		c--
	}
	result := make([]Card, 0, c)
	removed := false
	for _, c := range hand {
		if !removed && c.Rank == card.Rank && c.Suit == card.Suit {
			removed = true
			continue
		}
		result = append(result, c)
	}
	return result
}
