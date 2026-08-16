import { SUITS, MIN_RANK, deckMaxRankFor } from './rules.js';

// buildDeck(playerCount, ruleset) produces the reduced deck used at that
// player count: the full 80-card deck is cut to ranks 0-10 (2-3p), 0-12 (4p),
// or left at 0-15 (5p). Marshmallow keeps the full deck for now (setup TBD).
export function buildDeck(playerCount = 5, ruleset = 'full') {
  const maxRank = deckMaxRankFor(playerCount, ruleset);
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = MIN_RANK; rank <= maxRank; rank++) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const cards = deck.slice();
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function cardId(card) {
  return `${card.suit}-${card.rank}`;
}
