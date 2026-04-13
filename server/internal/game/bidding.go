package game

import (
	"slices"

	"github.com/emilijan/belote/server/internal/apperr"
)

// handleBidding processes trump bidding actions (pick_trump, pass_trump) during
// the bidding phase. Pure function — no side effects.
//
// Bitola variant bidding rules:
// Round 1: Players can pick the trump candidate's suit or pass.
// Round 2: If all 4 pass in round 1, players can pick any suit or pass.
// Reshuffle: If all 4 pass in round 2, deck reshuffles, dealer rotates, re-deal.
func handleBidding(state *GameState, action Action) (*GameState, error) {
	if state.Phase != PhaseBidding {
		return nil, apperr.ErrWrongPhase
	}

	if action.PlayerSeat != state.ActivePlayerSeat {
		return nil, apperr.ErrNotYourTurn
	}

	switch action.Type {
	case ActionPassTrump:
		return handlePassTrump(state)
	case ActionPickTrump:
		return handlePickTrump(state, action)
	default:
		return nil, apperr.ErrWrongPhase
	}
}

// handlePassTrump processes a pass action during bidding.
func handlePassTrump(state *GameState) (*GameState, error) {
	newState := cloneGameState(state)

	newState.BiddingPassCount++
	newState.ActivePlayerSeat = (newState.ActivePlayerSeat + 1) % 4

	// Check if all 4 players have passed in the current round
	if newState.BiddingPassCount == 4 {
		if newState.BiddingRound == 1 {
			// Transition to round 2
			newState.BiddingRound = 2
			newState.BiddingPassCount = 0
			newState.ActivePlayerSeat = (newState.DealerSeat + 1) % 4
		} else {
			// Round 2 complete — reshuffle and re-deal
			newState = reshuffleAndRedeal(newState)
		}
	}

	return newState, nil
}

// handlePickTrump processes a pick action during bidding.
func handlePickTrump(state *GameState, action Action) (*GameState, error) {
	newState := cloneGameState(state)

	if newState.BiddingRound == 1 {
		// Round 1: trump is the candidate card's suit
		if newState.TrumpCandidate == nil {
			return nil, apperr.ErrWrongPhase
		}
		suit := newState.TrumpCandidate.Suit
		newState.TrumpSuit = &suit
	} else {
		// Round 2: player picks any suit — action.Suit is required
		if action.Suit == nil {
			return nil, apperr.ErrInvalidBid
		}
		if !validSuits[*action.Suit] {
			return nil, apperr.ErrInvalidBid
		}
		suit := *action.Suit
		newState.TrumpSuit = &suit
	}

	seat := action.PlayerSeat
	newState.TrumpCallerSeat = &seat
	newState.Phase = PhasePlaying
	newState.ActivePlayerSeat = (newState.DealerSeat + 1) % 4
	newState.TrickNumber = 1
	newState.CurrentTrick = []TrickCard{}

	// Check if first player has declarable combinations
	checkDeclarationPrompt(newState)

	return newState, nil
}

// reshuffleAndRedeal collects all cards, shuffles, rotates the dealer, and
// re-deals using the standard 3+2+3 sequence.
func reshuffleAndRedeal(state *GameState) *GameState {
	// Collect all 32 cards from players' hands
	deck := make([]Card, 0, 32)
	for i := range state.Players {
		deck = append(deck, state.Players[i].Hand...)
		state.Players[i].Hand = []Card{}
	}

	// Shuffle and rotate dealer
	ShuffleDeck(deck)
	state.DealerSeat = (state.DealerSeat + 1) % 4

	// Re-deal using existing deal logic
	dealCards(state, deck)

	// Check for instant-win (player holds all 8 trump cards)
	if winnerTeam := checkInstantWin(state); winnerTeam != nil {
		state.WinnerTeam = winnerTeam
		state.Phase = PhaseMatchEnd
		return state
	}

	// Reset bidding state
	state.Phase = PhaseDealing
	state.BiddingRound = 1
	state.BiddingPassCount = 0
	state.TrumpSuit = nil
	state.TrumpCallerSeat = nil
	state.ActivePlayerSeat = (state.DealerSeat + 1) % 4

	return state
}

// cloneGameState creates a deep copy of the GameState to preserve immutability
// of the original state passed to ApplyAction.
func cloneGameState(state *GameState) *GameState {
	newState := *state // shallow copy of struct

	// Deep-copy pointer fields to break aliasing (D34 fix)
	if state.TrumpSuit != nil {
		v := *state.TrumpSuit
		newState.TrumpSuit = &v
	}
	if state.TrumpCallerSeat != nil {
		v := *state.TrumpCallerSeat
		newState.TrumpCallerSeat = &v
	}
	if state.TrumpCandidate != nil {
		v := *state.TrumpCandidate
		newState.TrumpCandidate = &v
	}
	if state.LeadSuit != nil {
		v := *state.LeadSuit
		newState.LeadSuit = &v
	}
	if state.TrickWinnerSeat != nil {
		v := *state.TrickWinnerSeat
		newState.TrickWinnerSeat = &v
	}
	if state.TurnExpiresAt != nil {
		v := *state.TurnExpiresAt
		newState.TurnExpiresAt = &v
	}
	if state.PendingBelotSeat != nil {
		v := *state.PendingBelotSeat
		newState.PendingBelotSeat = &v
	}
	if state.WinnerTeam != nil {
		v := *state.WinnerTeam
		newState.WinnerTeam = &v
	}
	if state.ReconnectExpiresAt != nil {
		v := *state.ReconnectExpiresAt
		newState.ReconnectExpiresAt = &v
	}

	// Deep clone slice fields
	newState.CurrentTrick = slices.Clone(state.CurrentTrick)

	// Deep clone player hands and declarations
	for i := range newState.Players {
		newState.Players[i].Hand = slices.Clone(state.Players[i].Hand)
		newDecls := slices.Clone(state.Players[i].Declarations)
		for j := range newDecls {
			newDecls[j].Cards = slices.Clone(newDecls[j].Cards)
		}
		newState.Players[i].Declarations = newDecls
	}

	return &newState
}
