export const SUITS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
export const MIN_RANK = 0;
export const MAX_RANK = 15;

// Official Voodoo Prince setup (card-sized rules, Schmidt Spiele 2017):
// - The 80-card deck (5 suits x 16, ranks 0-15) is cut down by player count:
//   2-3 players use ranks 0-10 (55 cards), 4 players 0-12 (60), 5 players all 80.
// - 2-4 players are dealt 13 cards each; 5 players get 14.
// - Exit threshold: 3p = 4th trick, 4p = 3rd, 5p = 3rd. Two players has no exit
//   threshold — the hand ends when someone reaches 7 tricks (special scoring,
//   handled in the engine).
export const VP_DECK_MAX_RANK = { 2: 10, 3: 10, 4: 12, 5: 15 };
export const VP_HAND_SIZE = { 2: 13, 3: 13, 4: 13, 5: 14 };
export const VP_TRICKS_TO_EXIT = { 3: 4, 4: 3, 5: 3 };
export const TWO_PLAYER_TRICK_TARGET = 7;
export const HANDS_PER_GAME = 5;
export const MARSHMALLOW_TARGET_SCORE = 20;

// Marshmallow Test setup has NOT been verified against its own rulebook yet.
// Its deck differs (ranks 1-12 in 5 suits per BGG), so these legacy values
// merely keep the existing marshmallow mode playable until that research lands.
const LEGACY_HAND_SIZE = 14;
const LEGACY_TRICKS_TO_EXIT = { 2: 6, 3: 4, 4: 3, 5: 3 };

export function deckMaxRankFor(playerCount, ruleset = 'full') {
  if (ruleset === 'marshmallow') return MAX_RANK;
  return VP_DECK_MAX_RANK[playerCount] ?? MAX_RANK;
}

export function dealSizeFor(playerCount, ruleset = 'full') {
  if (ruleset === 'marshmallow') return LEGACY_HAND_SIZE;
  return VP_HAND_SIZE[playerCount] ?? 13;
}

// null = no exit threshold (the 2-player special mode).
export function tricksToExit(playerCount, ruleset = 'full') {
  if (ruleset === 'marshmallow') return LEGACY_TRICKS_TO_EXIT[playerCount] ?? 3;
  return VP_TRICKS_TO_EXIT[playerCount] ?? null;
}

export function isTwoPlayerSpecial(playerCount, ruleset = 'full') {
  return ruleset !== 'marshmallow' && playerCount === 2;
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
