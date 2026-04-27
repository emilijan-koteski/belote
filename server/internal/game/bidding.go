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
//
// Stage-2 distribution (real-table rotation): walk seats from (Dealer+1)%4,
// taking cards off the front of newState.Deck — 3 per non-picker seat, 2 in
// the picker's slot. After the rotation, append the public TrumpCandidate to
// the picker's hand. Then run instant-win detection against the final 8-card
// hands and transition to PhasePlaying (or PhaseMatchEnd on instant-win).
func handlePickTrump(state *GameState, action Action) (*GameState, error) {
	// Defensive: stage-2 distribution requires both a public candidate and a
	// full 11-card Deck. Either being missing means the state has skipped or
	// already completed stage-1 — reject as wrong phase rather than panicking
	// on a slice index later in the rotation.
	if state.TrumpCandidate == nil || len(state.Deck) != 11 {
		return nil, apperr.ErrWrongPhase
	}

	newState := cloneGameState(state)

	if newState.BiddingRound == 1 {
		// Round 1: trump is the candidate card's suit (action.Suit ignored).
		suit := newState.TrumpCandidate.Suit
		newState.TrumpSuit = &suit
	} else {
		// Round 2: player picks any suit — action.Suit is required.
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

	// Stage-2 distribution.
	deck := newState.Deck
	idx := 0
	for i := 0; i < 4; i++ {
		s := (newState.DealerSeat + 1 + i) % 4
		n := 3
		if s == seat {
			n = 2
		}
		newState.Players[s].Hand = append(newState.Players[s].Hand, deck[idx:idx+n]...)
		idx += n
	}
	newState.Players[seat].Hand = append(newState.Players[seat].Hand, *newState.TrumpCandidate)
	newState.Deck = nil
	newState.TrumpCandidate = nil

	// Instant-win check against final 8-card hands.
	if winnerTeam := checkInstantWin(newState); winnerTeam != nil {
		newState.WinnerTeam = winnerTeam
		newState.Phase = PhaseMatchEnd
		return newState, nil
	}

	newState.Phase = PhasePlaying
	newState.ActivePlayerSeat = (newState.DealerSeat + 1) % 4
	newState.TrickNumber = 1
	newState.CurrentTrick = []TrickCard{}

	// Check if first player has declarable combinations
	checkDeclarationPrompt(newState)

	return newState, nil
}

// reshuffleAndRedeal pools all 32 cards (hands + Deck + TrumpCandidate),
// shuffles, rotates the dealer counter-clockwise, and re-runs stage-1.
// Instant-win cannot be detected here — only stage-2 (post-pick) produces
// the final 8-card hands needed for that check.
func reshuffleAndRedeal(state *GameState) *GameState {
	// Pool 32 cards: hands + remaining deck + visible candidate. If the pool
	// is malformed (an upstream code path mishandled state and dropped cards),
	// rebuild from a fresh deck instead of silently re-dealing a short pool —
	// dealCards's stage-1 indexing assumes exactly 32 cards.
	deck := make([]Card, 0, 32)
	for i := range state.Players {
		deck = append(deck, state.Players[i].Hand...)
		state.Players[i].Hand = []Card{}
	}
	deck = append(deck, state.Deck...)
	if state.TrumpCandidate != nil {
		deck = append(deck, *state.TrumpCandidate)
	}
	if len(deck) != 32 {
		deck = NewDeck()
	}

	// Reset bidding/trump artifacts before re-dealing.
	state.Deck = nil
	state.TrumpCandidate = nil
	state.TrumpSuit = nil
	state.TrumpCallerSeat = nil

	// Shuffle and rotate dealer
	ShuffleDeck(deck)
	state.DealerSeat = (state.DealerSeat + 1) % 4

	// Re-deal stage-1 (5 cards per seat + new candidate + 11-card Deck).
	dealCards(state, deck)

	// Reset bidding state
	state.Phase = PhaseDealing
	state.BiddingRound = 1
	state.BiddingPassCount = 0
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
	if state.LastHandResult != nil {
		v := *state.LastHandResult
		newState.LastHandResult = &v
	}
	if state.SurrenderProposerSeat != nil {
		v := *state.SurrenderProposerSeat
		newState.SurrenderProposerSeat = &v
	}

	// Deep clone slice fields
	newState.CurrentTrick = slices.Clone(state.CurrentTrick)
	newState.Deck = slices.Clone(state.Deck)

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
