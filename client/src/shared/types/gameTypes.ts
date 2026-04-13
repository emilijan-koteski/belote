// Card ID format: two-character strings (rank + suit)
// Rank: 7, 8, 9, T (ten), J, Q, K, A
// Suit: S (spades), H (hearts), D (diamonds), C (clubs)
// Examples: KS = King of Spades, TH = Ten of Hearts

export type Suit = "S" | "H" | "D" | "C";
export type Rank = "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type CardId = `${Rank}${Suit}`;

export type Variant = "bitola";

export type Phase =
  | "dealing"
  | "bidding"
  | "playing"
  | "trick_resolving"
  | "hand_scoring"
  | "match_end"
  | "paused"
  | "disconnected";

export type ActionType =
  | "play_card"
  | "pick_trump"
  | "pass_trump"
  | "declare"
  | "skip_declare"
  | "announce_belot"
  | "decline_belot"
  | "pause"
  | "unpause"
  | "owner_unpause";

export type DeclarationType = "sequence" | "four_of_a_kind";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Declaration {
  type: DeclarationType;
  cards: Card[];
  playerSeat: number;
  value: number;
}

export interface TrickCard {
  card: Card;
  playerSeat: number;
}

export interface PlayerState {
  hand: Card[];
  seat: number;
  userId: number;
  username: string;
  team: string;
  declarations: Declaration[];
  connected: boolean;
}

export interface HandResult {
  redCardPoints: number;
  blueCardPoints: number;
  redDeclPoints: number;
  blueDeclPoints: number;
  lastTrickTeam: number;
  lastTrickBonus: number;
  capot: boolean;
  capotTeam: number | null;
  capotBonus: number;
  failedContract: boolean;
  contractingTeam: number;
  redHandTotal: number;
  blueHandTotal: number;
}

export interface GameState {
  id: number;
  roomId: number;
  variant: Variant;
  matchMode: string;
  phase: Phase;
  handNumber: number;
  dealerSeat: number;
  trumpSuit: Suit | null;
  trumpCallerSeat: number | null;
  trumpCandidate: Card | null;
  biddingRound: number;
  biddingPassCount: number;
  activePlayerSeat: number;
  trickNumber: number;
  currentTrick: TrickCard[];
  leadSuit: Suit | null;
  trickWinnerSeat: number | null;
  awaitingDeclaration: boolean;
  declarationsResolved: boolean;
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  teamScores: [number, number];
  handPoints: [number, number];
  declarationPoints: [number, number];
  tricksWon: [number, number];
  pendingBelotSeat: number | null;
  belotAnnounced: boolean;
  winnerTeam: number | null;
  lastHandResult: HandResult | null;
  turnExpiresAt: string | null;
  timerDurationSec: number;
  previousPhase: Phase;
  pausedPlayers: [boolean, boolean, boolean, boolean];
  pauseUsed: [boolean, boolean, boolean, boolean];
  turnTimeRemaining: number;
}
