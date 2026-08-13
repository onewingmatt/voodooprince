import { SUITS, MIN_RANK, MAX_RANK } from './rules.js';

export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) {
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
