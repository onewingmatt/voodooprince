import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, shuffle, cardId } from '../../server/game/deck.js';

test('buildDeck(5) produces the full 80 cards (5 suits x 16 ranks)', () => {
  const deck = buildDeck(5);
  assert.equal(deck.length, 80);
  const ids = new Set(deck.map(cardId));
  assert.equal(ids.size, 80);
  const suits = new Set(deck.map((c) => c.suit));
  assert.deepEqual([...suits].sort(), ['Blue', 'Green', 'Purple', 'Red', 'Yellow']);
  const ranks = new Set(deck.map((c) => c.rank));
  assert.equal(ranks.size, 16);
});

test('buildDeck cuts the deck by player count (official setup)', () => {
  assert.equal(buildDeck(4).length, 65); // ranks 0-12 = 13 ranks x 5 suits
  assert.equal(buildDeck(4).every((c) => c.rank <= 12), true);
  assert.equal(buildDeck(3).length, 55); // ranks 0-10 = 11 ranks x 5 suits
  assert.equal(buildDeck(2).length, 55);
  assert.equal(buildDeck(2).every((c) => c.rank <= 10), true);
  // Marshmallow keeps the full deck until its own setup is verified.
  assert.equal(buildDeck(2, 'marshmallow').length, 80);
});

test('shuffle keeps the same cards, changes order (probabilistically)', () => {
  const deck = buildDeck(5);
  const ids = deck.map(cardId);
  const shuffled = shuffle([...deck]);
  assert.deepEqual(shuffled.map(cardId).sort(), [...ids].sort());
  // Over 10 shuffles of a 80-card deck, at least one should differ from sorted
  // input order — practically certain unless shuffle is broken.
  const differs = Array.from({ length: 10 }, () => {
    const s = shuffle([...deck]);
    return s.some((c, i) => cardId(c) !== cardId(deck[i]));
  });
  assert.ok(differs.some(Boolean), 'shuffle never changed order');
});
