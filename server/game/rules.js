export const SUITS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
export const MIN_RANK = 0;
export const MAX_RANK = 15;

// Best-guess defaults reconstructed from secondary rules summaries (no official
// rulebook reachable from this sandbox). Kept as single named constants so they
// are a one-line fix once the real numbers are confirmed.
export const TRICKS_TO_EXIT = { 2: 6, 3: 4, 4: 3, 5: 3 };
export const HANDS_PER_GAME = 5;
export const MARSHMALLOW_TARGET_SCORE = 20;

// Rules summaries consistently cite a 13-14 card hand regardless of player
// count, with the rest of the 80-card deck set aside as an unseen blind — not
// a full deck-of-80-divided-by-players deal. Fixed at 14, capped by whatever
// the deck can actually give out at higher player counts.
export const HAND_SIZE = 14;

export function dealSizeFor(playerCount) {
  return Math.min(HAND_SIZE, Math.floor(SUITS.length * (MAX_RANK + 1) / playerCount));
}

export function tricksToExit(playerCount) {
  return TRICKS_TO_EXIT[playerCount] ?? 3;
}

export function isSpecial(card, ruleset) {
  if (ruleset === 'marshmallow') return false;
  return card.rank === 5 || card.rank === 7;
}

export function isZeroCard(card, ruleset) {
  if (ruleset === 'marshmallow') return false;
  return card.rank === 0;
}

export function trickValue(card, ruleset) {
  return isSpecial(card, ruleset) ? 2 : 1;
}
