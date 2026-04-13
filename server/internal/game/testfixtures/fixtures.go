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

// NewGameMidPlay returns a GameState in the playing phase at the specified
// trick number. Trump is Hearts, trump caller is seat 1. Hands contain mixed
// suits for testing suit-following, trump obligation, and partner exemption.
//
// trickNum 1: 8 cards per player (fresh playing state)
// trickNum 2-7: reduced hand sizes (8 - (trickNum-1) cards each)
// trickNum 8: 1 card per player (final trick)
//
// Hand distribution for trickNum=1 (trump=Hearts):
//
//	Seat 0 (Red):  AS TS KS QS AH TH KD 7C  (4S, 2H-trump, 1D, 1C)
//	Seat 1 (Blue): JS 9S 8S 7S JH 9H QD 8C  (4S, 2H-trump, 1D, 1C)
//	Seat 2 (Red):  AD TD KH QH 8H 7H AC TC  (2D, 4H-trump, 2C)
//	Seat 3 (Blue): JD 9D 8D 7D KC QC JC 9C  (4D, 0H-trump, 4C)
//
// Active player: seat 0, dealer: seat 0.
func NewGameMidPlay(trickNum int) *game.GameState {
	if trickNum < 1 {
		trickNum = 1
	}
	if trickNum > 8 {
		trickNum = 8
	}

	trumpSuit := game.SuitHearts
	callerSeat := 1

	gs := &game.GameState{
		RoomID:               1,
		Variant:              game.VariantBitola,
		MatchMode:            "1001",
		Phase:                game.PhasePlaying,
		HandNumber:           1,
		DealerSeat:           0,
		TrumpSuit:            &trumpSuit,
		TrumpCallerSeat:      &callerSeat,
		BiddingRound:         1,
		TrickNumber:          trickNum,
		CurrentTrick:         []game.TrickCard{},
		DeclarationsResolved: true, // declarations already handled (for card play testing)
		BelotAnnounced:       true, // Belot already handled (for card play testing)
		Players: [4]game.PlayerState{
			{Seat: 0, UserID: 10, Team: "red", Declarations: []game.Declaration{}, Connected: true},
			{Seat: 1, UserID: 20, Team: "blue", Declarations: []game.Declaration{}, Connected: true},
			{Seat: 2, UserID: 30, Team: "red", Declarations: []game.Declaration{}, Connected: true},
			{Seat: 3, UserID: 40, Team: "blue", Declarations: []game.Declaration{}, Connected: true},
		},
		ActivePlayerSeat: 0,
	}

	// Full hands for trick 1 — mixed suits for rule testing
	fullHands := [4][]game.Card{
		{ // Seat 0: 4 Spades, 2 trump Hearts, 1 Diamond, 1 Club
			{Rank: game.RankAce, Suit: game.SuitSpades},
			{Rank: game.RankTen, Suit: game.SuitSpades},
			{Rank: game.RankKing, Suit: game.SuitSpades},
			{Rank: game.RankQueen, Suit: game.SuitSpades},
			{Rank: game.RankAce, Suit: game.SuitHearts},
			{Rank: game.RankTen, Suit: game.SuitHearts},
			{Rank: game.RankKing, Suit: game.SuitDiamonds},
			{Rank: game.Rank7, Suit: game.SuitClubs},
		},
		{ // Seat 1: 4 Spades, 2 trump Hearts, 1 Diamond, 1 Club
			{Rank: game.RankJack, Suit: game.SuitSpades},
			{Rank: game.Rank9, Suit: game.SuitSpades},
			{Rank: game.Rank8, Suit: game.SuitSpades},
			{Rank: game.Rank7, Suit: game.SuitSpades},
			{Rank: game.RankJack, Suit: game.SuitHearts},
			{Rank: game.Rank9, Suit: game.SuitHearts},
			{Rank: game.RankQueen, Suit: game.SuitDiamonds},
			{Rank: game.Rank8, Suit: game.SuitClubs},
		},
		{ // Seat 2: 2 Diamonds, 4 trump Hearts, 2 Clubs
			{Rank: game.RankAce, Suit: game.SuitDiamonds},
			{Rank: game.RankTen, Suit: game.SuitDiamonds},
			{Rank: game.RankKing, Suit: game.SuitHearts},
			{Rank: game.RankQueen, Suit: game.SuitHearts},
			{Rank: game.Rank8, Suit: game.SuitHearts},
			{Rank: game.Rank7, Suit: game.SuitHearts},
			{Rank: game.RankAce, Suit: game.SuitClubs},
			{Rank: game.RankTen, Suit: game.SuitClubs},
		},
		{ // Seat 3: 4 Diamonds, 0 trump Hearts, 4 Clubs
			{Rank: game.RankJack, Suit: game.SuitDiamonds},
			{Rank: game.Rank9, Suit: game.SuitDiamonds},
			{Rank: game.Rank8, Suit: game.SuitDiamonds},
			{Rank: game.Rank7, Suit: game.SuitDiamonds},
			{Rank: game.RankKing, Suit: game.SuitClubs},
			{Rank: game.RankQueen, Suit: game.SuitClubs},
			{Rank: game.RankJack, Suit: game.SuitClubs},
			{Rank: game.Rank9, Suit: game.SuitClubs},
		},
	}

	// For trickNum > 1, trim hands from the end to simulate previous tricks
	cardsPerPlayer := 8 - (trickNum - 1)
	for i := range gs.Players {
		if cardsPerPlayer < len(fullHands[i]) {
			gs.Players[i].Hand = make([]game.Card, cardsPerPlayer)
			copy(gs.Players[i].Hand, fullHands[i][:cardsPerPlayer])
		} else {
			gs.Players[i].Hand = make([]game.Card, len(fullHands[i]))
			copy(gs.Players[i].Hand, fullHands[i])
		}
	}

	// Simulate accumulated scores from previous tricks
	if trickNum > 1 {
		gs.HandPoints = [2]int{10 * (trickNum - 1), 5 * (trickNum - 1)}
		gs.TricksWon = [2]int{(trickNum - 1 + 1) / 2, (trickNum - 1) / 2}
	}

	return gs
}

// NewGameFirstTrick returns a GameState at trick 1 designed for testing
// declarations and Belot bonus. DeclarationsResolved and BelotAnnounced
// are false. AwaitingDeclaration is NOT pre-set (caller controls flow).
//
// Hand distribution (trump = Hearts always, parameter reserved for future use):
//
//	Seat 0 (Red):  KH QH 7S 8S 9S 7C 8C 9C   → Belot (KH+QH), tierce 7S-8S-9S (20pts), tierce 7C-8C-9C (20pts)
//	Seat 1 (Blue): JD QD KD AD QS 8D 9D TC    → quarte JD-QD-KD-AD (50pts)
//	Seat 2 (Red):  JH 9H AH TH KS AS QC JC   → tierce 9H-TH-JH in trump (20pts)
//	Seat 3 (Blue): 7H 8H TD 7D TS AC KC       → no declarations (max 2 consecutive per suit, no four-of-a-kind)
//
// Wait - seat 3 has 7 cards above. Let me add JS... no that's at seat 2.
// Corrected seat 3: 7H 8H TD 7D TS JS AC KC = 8 cards. JS(4),TS(3) = 2 consecutive spades.
//
// All 32 cards verified: H(KH QH JH 9H AH TH 7H 8H) S(7S 8S 9S QS JS KS AS TS)
// D(JD QD KD AD 8D 9D TD 7D) C(7C 8C 9C TC AC KC QC JC)... wait, QC and JC are missing.
//
// FINAL verified distribution (all 32 unique cards, 8 per player):
//
//	Seat 0 (Red):  KH QH 7S 8S 9S 7C 8C 9C   → Belot, tierce 7S-8S-9S, tierce 7C-8C-9C
//	Seat 1 (Blue): JD QD KD AD QS 8D 9D TC    → quarte JD-QD-KD-AD
//	Seat 2 (Red):  JH 9H AH TH KS AS JC QC   → tierce 9H-TH-JH (trump, 20pts)
//	Seat 3 (Blue): 7H 8H TD 7D TS JS AC KC   → no declarations
//
// Active player: seat 1 (player after dealer). Dealer: seat 0.
func NewGameFirstTrick(trump game.Suit) *game.GameState {
	trumpSuit := trump
	callerSeat := 1

	gs := &game.GameState{
		RoomID:           1,
		Variant:          game.VariantBitola,
		MatchMode:        "1001",
		Phase:            game.PhasePlaying,
		HandNumber:       1,
		DealerSeat:       0,
		TrumpSuit:        &trumpSuit,
		TrumpCallerSeat:  &callerSeat,
		BiddingRound:     1,
		TrickNumber:      1,
		CurrentTrick:     []game.TrickCard{},
		ActivePlayerSeat: 1, // player after dealer
		Players: [4]game.PlayerState{
			{ // Seat 0 (Red): KH QH 7S 8S 9S 7C 8C 9C → Belot + 2 tierces
				Hand: []game.Card{
					{Rank: game.RankKing, Suit: game.SuitHearts},
					{Rank: game.RankQueen, Suit: game.SuitHearts},
					{Rank: game.Rank7, Suit: game.SuitSpades},
					{Rank: game.Rank8, Suit: game.SuitSpades},
					{Rank: game.Rank9, Suit: game.SuitSpades},
					{Rank: game.Rank7, Suit: game.SuitClubs},
					{Rank: game.Rank8, Suit: game.SuitClubs},
					{Rank: game.Rank9, Suit: game.SuitClubs},
				},
				Seat: 0, UserID: 10, Team: "red", Declarations: []game.Declaration{}, Connected: true,
			},
			{ // Seat 1 (Blue): JD QD KD AD QS 8D 9D TC → quarte JD-QD-KD-AD
				Hand: []game.Card{
					{Rank: game.RankJack, Suit: game.SuitDiamonds},
					{Rank: game.RankQueen, Suit: game.SuitDiamonds},
					{Rank: game.RankKing, Suit: game.SuitDiamonds},
					{Rank: game.RankAce, Suit: game.SuitDiamonds},
					{Rank: game.RankQueen, Suit: game.SuitSpades},
					{Rank: game.Rank8, Suit: game.SuitDiamonds},
					{Rank: game.Rank9, Suit: game.SuitDiamonds},
					{Rank: game.RankTen, Suit: game.SuitClubs},
				},
				Seat: 1, UserID: 20, Team: "blue", Declarations: []game.Declaration{}, Connected: true,
			},
			{ // Seat 2 (Red): JH 9H AH TH KS AS QC JC → tierce 9H-TH-JH (trump)
				Hand: []game.Card{
					{Rank: game.RankJack, Suit: game.SuitHearts},
					{Rank: game.Rank9, Suit: game.SuitHearts},
					{Rank: game.RankAce, Suit: game.SuitHearts},
					{Rank: game.RankTen, Suit: game.SuitHearts},
					{Rank: game.RankKing, Suit: game.SuitSpades},
					{Rank: game.RankAce, Suit: game.SuitSpades},
					{Rank: game.RankQueen, Suit: game.SuitClubs},
					{Rank: game.RankJack, Suit: game.SuitClubs},
				},
				Seat: 2, UserID: 30, Team: "red", Declarations: []game.Declaration{}, Connected: true,
			},
			{ // Seat 3 (Blue): 7H 8H TD 7D TS JS AC KC → no declarations
				Hand: []game.Card{
					{Rank: game.Rank7, Suit: game.SuitHearts},
					{Rank: game.Rank8, Suit: game.SuitHearts},
					{Rank: game.RankTen, Suit: game.SuitDiamonds},
					{Rank: game.Rank7, Suit: game.SuitDiamonds},
					{Rank: game.RankTen, Suit: game.SuitSpades},
					{Rank: game.RankJack, Suit: game.SuitSpades},
					{Rank: game.RankAce, Suit: game.SuitClubs},
					{Rank: game.RankKing, Suit: game.SuitClubs},
				},
				Seat: 3, UserID: 40, Team: "blue", Declarations: []game.Declaration{}, Connected: true,
			},
		},
	}

	return gs
}

// NewGameWithDeclarations returns a GameState at trick 1 with pre-populated
// declarations on the given player seats. Used for testing resolveDeclarations
// without going through the full declare flow.
func NewGameWithDeclarations(decls []game.Declaration) *game.GameState {
	gs := NewGameFirstTrick(game.SuitHearts)

	// Store declarations on respective player seats
	for _, d := range decls {
		gs.Players[d.PlayerSeat].Declarations = append(
			gs.Players[d.PlayerSeat].Declarations, d,
		)
	}

	return gs
}

// NewGameLastTrick returns a GameState at trick 8 (the final trick) for testing
// hand-end scoring: last-trick bonus, Capot detection, failed contracts, and
// match score updates.
//
// Trump = Hearts, TrumpCallerSeat = seat 1 (Blue team).
// TricksWon = [4, 3] — Red won 4 tricks, Blue won 3 (7 total, 8th pending).
// HandPoints = [70, 61] — realistic card point distribution from 7 tricks.
// DeclarationPoints = [0, 0] — no declarations (simplifies scoring tests).
//
// Remaining cards (1 per player):
//
//	Seat 0 (Red):  AS — Ace of Spades (11 pts non-trump)
//	Seat 1 (Blue): 8D — 8 of Diamonds (0 pts)
//	Seat 2 (Red):  TD — Ten of Diamonds (10 pts non-trump)
//	Seat 3 (Blue): 7H — 7 of Hearts (0 pts trump — can win if Hearts led)
//
// Remaining card points: 11 + 0 + 10 + 0 = 21. Total from 7 tricks: 152 - 21 = 131.
// HandPoints 70 + 61 = 131 ✓
//
// ActivePlayerSeat = 0 (Red, winner of trick 7 — leads trick 8).
func NewGameLastTrick() *game.GameState {
	trumpSuit := game.SuitHearts
	callerSeat := 1  // Blue team called trump
	trickWinner := 0 // Seat 0 won trick 7

	return &game.GameState{
		RoomID:               1,
		Variant:              game.VariantBitola,
		MatchMode:            "1001",
		Phase:                game.PhasePlaying,
		HandNumber:           1,
		DealerSeat:           0,
		TrumpSuit:            &trumpSuit,
		TrumpCallerSeat:      &callerSeat,
		TrickNumber:          8,
		CurrentTrick:         []game.TrickCard{},
		TrickWinnerSeat:      &trickWinner,
		DeclarationsResolved: true,
		BelotAnnounced:       true,
		ActivePlayerSeat:     0,
		Players: [4]game.PlayerState{
			{ // Seat 0 (Red): AS — strong non-trump
				Hand:         []game.Card{{Rank: game.RankAce, Suit: game.SuitSpades}},
				Seat:         0,
				UserID:       10,
				Team:         "red",
				Declarations: nil,
				Connected:    true,
			},
			{ // Seat 1 (Blue): 8D — weak non-trump
				Hand:         []game.Card{{Rank: game.Rank8, Suit: game.SuitDiamonds}},
				Seat:         1,
				UserID:       20,
				Team:         "blue",
				Declarations: nil,
				Connected:    true,
			},
			{ // Seat 2 (Red): TD — medium non-trump (10 pts)
				Hand:         []game.Card{{Rank: game.RankTen, Suit: game.SuitDiamonds}},
				Seat:         2,
				UserID:       30,
				Team:         "red",
				Declarations: nil,
				Connected:    true,
			},
			{ // Seat 3 (Blue): 7H — low trump (can win if led suit is hearts)
				Hand:         []game.Card{{Rank: game.Rank7, Suit: game.SuitHearts}},
				Seat:         3,
				UserID:       40,
				Team:         "blue",
				Declarations: nil,
				Connected:    true,
			},
		},
		TeamScores:    [2]int{0, 0},
		HandPoints:    [2]int{70, 61},
		TricksWon:     [2]int{4, 3},
		TurnExpiresAt: nil,
	}
}

// NewGameCapotInProgress returns a GameState at trick 8 where one team (Red)
// has won all 7 previous tricks. Used for testing Capot detection and scoring.
//
// Trump = Hearts, TrumpCallerSeat = seat 0 (Red team — the Capot team).
// TricksWon = [7, 0] — Red has won every trick so far.
// HandPoints = [121, 0] — all card points from 7 tricks go to Red.
//
// Remaining cards (1 per player):
//
//	Seat 0 (Red):  JH — Jack of Hearts (20 pts trump, strongest card)
//	Seat 1 (Blue): 7D — 7 of Diamonds (0 pts)
//	Seat 2 (Red):  AH — Ace of Hearts (11 pts trump)
//	Seat 3 (Blue): 7C — 7 of Clubs (0 pts)
//
// Remaining card points: 20 + 0 + 11 + 0 = 31. Total from 7 tricks: 152 - 31 = 121 ✓
//
// ActivePlayerSeat = 0 (Red, winner of trick 7).
// Red team is guaranteed to win trick 8 (JH is strongest possible trump).
func NewGameCapotInProgress() *game.GameState {
	trumpSuit := game.SuitHearts
	callerSeat := 0  // Red team called trump
	trickWinner := 0 // Seat 0 won trick 7

	return &game.GameState{
		RoomID:               1,
		Variant:              game.VariantBitola,
		MatchMode:            "1001",
		Phase:                game.PhasePlaying,
		HandNumber:           1,
		DealerSeat:           0,
		TrumpSuit:            &trumpSuit,
		TrumpCallerSeat:      &callerSeat,
		TrickNumber:          8,
		CurrentTrick:         []game.TrickCard{},
		TrickWinnerSeat:      &trickWinner,
		DeclarationsResolved: true,
		BelotAnnounced:       true,
		ActivePlayerSeat:     0,
		Players: [4]game.PlayerState{
			{ // Seat 0 (Red): JH — Jack of Hearts (trump, strongest)
				Hand:         []game.Card{{Rank: game.RankJack, Suit: game.SuitHearts}},
				Seat:         0,
				UserID:       10,
				Team:         "red",
				Declarations: nil,
				Connected:    true,
			},
			{ // Seat 1 (Blue): 7D — weakest
				Hand:         []game.Card{{Rank: game.Rank7, Suit: game.SuitDiamonds}},
				Seat:         1,
				UserID:       20,
				Team:         "blue",
				Declarations: nil,
				Connected:    true,
			},
			{ // Seat 2 (Red): AH — Ace of Hearts (trump)
				Hand:         []game.Card{{Rank: game.RankAce, Suit: game.SuitHearts}},
				Seat:         2,
				UserID:       30,
				Team:         "red",
				Declarations: nil,
				Connected:    true,
			},
			{ // Seat 3 (Blue): 7C — weakest
				Hand:         []game.Card{{Rank: game.Rank7, Suit: game.SuitClubs}},
				Seat:         3,
				UserID:       40,
				Team:         "blue",
				Declarations: nil,
				Connected:    true,
			},
		},
		TeamScores:    [2]int{0, 0},
		HandPoints:    [2]int{121, 0},
		TricksWon:     [2]int{7, 0},
		TurnExpiresAt: nil,
	}
}

// NewGameNearEnd returns a GameState at trick 8 (like NewGameLastTrick) but with
// configurable team scores, for testing match completion thresholds and tiebreakers.
//
// Trump = Hearts, TrumpCallerSeat = seat 1 (Blue team).
// TricksWon = [4, 3] — Red won 4 tricks, Blue won 3 (7 total, 8th pending).
// HandPoints = [70, 61] — realistic card point distribution from 7 tricks.
//
// Remaining cards are identical to NewGameLastTrick:
//
//	Seat 0 (Red):  AS — Ace of Spades (11 pts non-trump)
//	Seat 1 (Blue): 8D — 8 of Diamonds (0 pts)
//	Seat 2 (Red):  TD — Ten of Diamonds (10 pts non-trump)
//	Seat 3 (Blue): 7H — 7 of Hearts (0 pts trump)
//
// After trick 8 resolves (Seat 0 leads AS, wins trick):
//   - Red gets: 70 + 21(trick) + 10(last-trick) = 101 hand points
//   - Blue gets: 61 hand points
//   - Blue called trump so if 61 < 101 → failed contract → Red gets 162 total
//
// Use redScore/blueScore to position teams near the 1001 threshold.
func NewGameNearEnd(redScore, blueScore int) *game.GameState {
	gs := NewGameLastTrick()
	gs.TeamScores = [2]int{redScore, blueScore}
	return gs
}

// NewGamePaused returns a GameState in PhasePaused, transitioned from PhasePlaying.
// The specified seat has an active pause (PausedPlayers and PauseUsed set).
// PreviousPhase is set to PhasePlaying so unpause restores to playing.
func NewGamePaused(pausedBySeat int) *game.GameState {
	gs := NewGameMidPlay(1)
	gs.Phase = game.PhasePaused
	gs.PreviousPhase = game.PhasePlaying
	gs.PausedPlayers[pausedBySeat] = true
	gs.PauseUsed[pausedBySeat] = true
	return gs
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
