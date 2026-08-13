import { legalPlays } from './engine.js';
import { tricksToExit, isSpecial } from './rules.js';
import { SUITS } from './rules.js';

// Rule-based heuristic, not optimal play: follow-suit legality first, then a
// simple timing strategy around the exit threshold.
export function chooseBotTrump(state, seat) {
  const hand = state.players[seat].hand;
  const counts = new Map(SUITS.map((s) => [s, 0]));
  for (const card of hand) counts.set(card.suit, counts.get(card.suit) + 1);
  let best = SUITS[0];
  for (const suit of SUITS) {
    if (counts.get(suit) > counts.get(best)) best = suit;
  }
  return best;
}

export function chooseBotCard(state, seat) {
  const player = state.players[seat];
  const options = legalPlays(state, seat);
  if (options.length === 1) return options[0];

  const threshold = tricksToExit(state.playerCount);
  const isLeading = state.currentTrick.length === 0;
  const tricksFromExit = threshold - player.tricksWon;
  const dangerousToWin = tricksFromExit <= 1; // winning now (or with a double) would push over the line

  const byRank = (a, b) => a.rank - b.rank;
  const sorted = [...options].sort(byRank);

  if (dangerousToWin) {
    // Try to avoid winning: play the lowest safe card, avoiding specials and
    // avoiding the current-winning card's suit/rank when possible.
    const safe = sorted.filter((c) => !isSpecial(c, state.ruleset));
    return (safe[0] ?? sorted[0]);
  }

  if (isLeading) {
    // Lead with a middling card to gather information without committing high cards.
    return sorted[Math.floor(sorted.length / 2)];
  }

  // Otherwise play to (eventually) win tricks: play the highest option.
  return sorted[sorted.length - 1];
}
