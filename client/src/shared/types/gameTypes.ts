// Card ID format: two-character strings (rank + suit)
// Rank: 7, 8, 9, T (ten), J, Q, K, A
// Suit: S (spades), H (hearts), D (diamonds), C (clubs)
// Examples: KS = King of Spades, TH = Ten of Hearts

export type Suit = "S" | "H" | "D" | "C";
export type Rank = "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type CardId = `${Rank}${Suit}`;
