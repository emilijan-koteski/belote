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

	// Step 6: Check match-end condition with tiebreaker logic
	target := matchTarget(state.MatchMode)
	redOver := state.TeamScores[TeamRed] >= target
	blueOver := state.TeamScores[TeamBlue] >= target

	if redOver || blueOver {
		winner := determineMatchWinner(state, redOver, blueOver)
		state.WinnerTeam = &winner
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
	state.WinnerTeam = nil
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

	// Check for instant-win (player holds all 8 trump cards)
	if winnerTeam := checkInstantWin(state); winnerTeam != nil {
		state.WinnerTeam = winnerTeam
		state.Phase = PhaseMatchEnd
		return
	}

	state.Phase = PhaseDealing
}

// checkInstantWin checks if any player holds all 8 cards of the trump suit after
// dealing. Returns the winning team index, or nil if no instant-win.
func checkInstantWin(state *GameState) *int {
	if state.TrumpCandidate == nil {
		return nil
	}
	trumpSuit := state.TrumpCandidate.Suit
	for i := range state.Players {
		trumpCount := 0
		for _, card := range state.Players[i].Hand {
			if card.Suit == trumpSuit {
				trumpCount++
			}
		}
		if trumpCount == 8 {
			team := TeamForSeat(state.Players[i].Seat)
			return &team
		}
	}
	return nil
}

// determineMatchWinner resolves which team wins when at least one team has crossed
// the match target. Handles tiebreaker: if both teams crossed, higher score wins;
// if tied, the contracting team (trump picker) wins.
func determineMatchWinner(state *GameState, redOver, blueOver bool) int {
	if redOver && blueOver {
		// Both teams crossed — higher score wins
		if state.TeamScores[TeamRed] > state.TeamScores[TeamBlue] {
			return TeamRed
		}
		if state.TeamScores[TeamBlue] > state.TeamScores[TeamRed] {
			return TeamBlue
		}
		// Tied scores — contracting team (trump picker) wins
		return TeamForSeat(*state.TrumpCallerSeat)
	}
	// Only one team crossed
	if redOver {
		return TeamRed
	}
	return TeamBlue
}

// matchTarget returns the point threshold for match completion based on the match mode.
func matchTarget(mode string) int {
	if mode == "501" {
		return 501
	}
	return 1001
}
