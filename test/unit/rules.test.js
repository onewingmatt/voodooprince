import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITS,
  MIN_RANK,
  MAX_RANK,
  TRICKS_TO_EXIT,
  HANDS_PER_GAME,
  MARSHMALLOW_TARGET_SCORE,
  HAND_SIZE,
  dealSizeFor,
  tricksToExit,
  isSpecial,
  isZeroCard,
  trickValue,
} from '../../server/game/rules.js';

test('suit and rank constants', () => {
  assert.equal(SUITS.length, 5);
  assert.deepEqual(SUITS, ['Red', 'Blue', 'Green', 'Yellow', 'Purple']);
  assert.equal(MIN_RANK, 0);
  assert.equal(MAX_RANK, 15);
  assert.equal(HAND_SIZE, 14);
  assert.equal(HANDS_PER_GAME, 5);
  assert.equal(MARSHMALLOW_TARGET_SCORE, 20);
});

test('dealSizeFor caps at HAND_SIZE but never exceeds what the deck can give', () => {
  assert.equal(dealSizeFor(2), 14);
  assert.equal(dealSizeFor(3), 14);
  assert.equal(dealSizeFor(4), 14);
  assert.equal(dealSizeFor(5), 14);
  // With more players than suits*ranks/HAND_SIZE allows, it shrinks and the
  // deal never over-allocates the 80-card deck.
  assert.equal(dealSizeFor(6), 13);
  assert.ok(dealSizeFor(6) * 6 <= 5 * (MAX_RANK + 1));
});

test('tricksToExit matches the table and defaults', () => {
  assert.deepEqual(TRICKS_TO_EXIT, { 2: 6, 3: 4, 4: 3, 5: 3 });
  assert.equal(tricksToExit(2), 6);
  assert.equal(tricksToExit(3), 4);
  assert.equal(tricksToExit(4), 3);
  assert.equal(tricksToExit(5), 3);
  assert.equal(tricksToExit(9), 3); // default
});

test('specials/zeros only exist outside marshmallow', () => {
  assert.ok(isSpecial({ rank: 5 }, 'full'));
  assert.ok(isSpecial({ rank: 7 }, 'full'));
  assert.ok(!isSpecial({ rank: 6 }, 'full'));
  assert.ok(!isSpecial({ rank: 5 }, 'marshmallow'));
  assert.ok(isZeroCard({ rank: 0 }, 'full'));
  assert.ok(!isZeroCard({ rank: 0 }, 'marshmallow'));
});

test('trickValue: specials count double, everything else single', () => {
  assert.equal(trickValue({ rank: 5 }, 'full'), 2);
  assert.equal(trickValue({ rank: 7 }, 'full'), 2);
  assert.equal(trickValue({ rank: 0 }, 'full'), 1);
  assert.equal(trickValue({ rank: 3 }, 'full'), 1);
  assert.equal(trickValue({ rank: 5 }, 'marshmallow'), 1);
});
