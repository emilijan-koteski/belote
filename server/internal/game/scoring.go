package game

// scoreHand calculates the final hand score after all 8 tricks are resolved.
// It applies last-trick bonus (or Capot bonus), checks for failed contracts,
// updates match scores, and either starts a new hand or ends the match.
// Mutates an already-cloned state (called from within resolveTrickWithDeclarations).
func scoreHand(state *GameState) {
	// Step 1: Determine last-trick winner's team
	lastTrickTeam := TeamForSeat(*state.TrickWinnerSeat)

	// Step 2: Apply Capot bonus (+100) or last-trick bonus (+10)
	if state.TricksWon[TeamRed] == 8 {
		state.HandPoints[TeamRed] += 100
	} else if state.TricksWon[TeamBlue] == 8 {
		state.HandPoints[TeamBlue] += 100
	} else {
		state.HandPoints[lastTrickTeam] += 10
	}

	// Step 3: Calculate total hand score per team
	redTotal := state.HandPoints[TeamRed] + state.DeclarationPoints[TeamRed]
	blueTotal := state.HandPoints[TeamBlue] + state.DeclarationPoints[TeamBlue]

	// Step 4: Failed contract check
	contractingTeam := TeamForSeat(*state.TrumpCallerSeat)
	opposingTeam := 1 - contractingTeam

	var contractingTotal, opposingTotal int
	if contractingTeam == TeamRed {
		contractingTotal = redTotal
		opposingTotal = blueTotal
	} else {
		contractingTotal = blueTotal
		opposingTotal = redTotal
	}

	// Step 5: Award points — failed contract or normal scoring
	if contractingTotal < opposingTotal {
		// Failed contract: contracting team gets 0, opponent gets ALL points
		state.TeamScores[opposingTeam] += redTotal + blueTotal
	} else {
		// Normal scoring: each team keeps their own points
		state.TeamScores[TeamRed] += redTotal
		state.TeamScores[TeamBlue] += blueTotal
	}

	// Step 6: Check match-end condition
	target := matchTarget(state.MatchMode)
	if state.TeamScores[TeamRed] >= target || state.TeamScores[TeamBlue] >= target {
		state.Phase = PhaseMatchEnd
		return
	}

	// Step 7: Start new hand
	startNewHand(state)
}

// startNewHand resets all per-hand state, rotates the dealer, shuffles and deals
// a fresh deck, and transitions to PhaseBidding for the next hand.
func startNewHand(state *GameState) {
	// Advance hand metadata
	state.HandNumber++
	state.DealerSeat = (state.DealerSeat + 1) % 4

	// Reset bidding state
	state.TrumpSuit = nil
	state.TrumpCallerSeat = nil
	state.TrumpCandidate = nil
	state.BiddingRound = 1
	state.BiddingPassCount = 0

	// Reset trick state
	state.TrickNumber = 0
	state.CurrentTrick = []TrickCard{}
	state.LeadSuit = nil
	state.TrickWinnerSeat = nil
	state.AwaitingDeclaration = false
	state.DeclarationsResolved = false

	// Reset per-hand scoring
	state.HandPoints = [2]int{0, 0}
	state.DeclarationPoints = [2]int{0, 0}
	state.TricksWon = [2]int{0, 0}
	state.PendingBelotSeat = nil
	state.BelotAnnounced = false
	state.TurnExpiresAt = nil

	// Clear player hands and declarations
	for i := range state.Players {
		state.Players[i].Hand = []Card{}
		state.Players[i].Declarations = nil
	}

	// Generate fresh deck, shuffle, and deal
	deck := NewDeck()
	ShuffleDeck(deck)
	dealCards(state, deck)

	// Set active player and phase
	state.ActivePlayerSeat = (state.DealerSeat + 1) % 4
	state.Phase = PhaseBidding
}

// matchTarget returns the point threshold for match completion based on the match mode.
func matchTarget(mode string) int {
	if mode == "501" {
		return 501
	}
	return 1001
}
