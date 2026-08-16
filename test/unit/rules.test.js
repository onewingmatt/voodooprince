import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITS,
  MIN_RANK,
  MAX_RANK,
  VP_DECK_MAX_RANK,
  VP_HAND_SIZE,
  VP_TRICKS_TO_EXIT,
  TWO_PLAYER_TRICK_TARGET,
  HANDS_PER_GAME,
  MARSHMALLOW_TARGET_SCORE,
  deckMaxRankFor,
  dealSizeFor,
  tricksToExit,
  isTwoPlayerSpecial,
  isSpecial,
  isZeroCard,
  trickValue,
} from '../../server/game/rules.js';

test('suit and rank constants', () => {
  assert.equal(SUITS.length, 5);
  assert.deepEqual(SUITS, ['Red', 'Blue', 'Green', 'Yellow', 'Purple']);
  assert.equal(MIN_RANK, 0);
  assert.equal(MAX_RANK, 15);
  assert.equal(HANDS_PER_GAME, 5);
  assert.equal(MARSHMALLOW_TARGET_SCORE, 20);
  assert.equal(TWO_PLAYER_TRICK_TARGET, 7);
});

test('official setup table: deck cut by player count', () => {
  assert.deepEqual(VP_DECK_MAX_RANK, { 2: 10, 3: 10, 4: 12, 5: 15 });
  assert.equal(deckMaxRankFor(2), 10);
  assert.equal(deckMaxRankFor(3), 10);
  assert.equal(deckMaxRankFor(4), 12);
  assert.equal(deckMaxRankFor(5), 15);
  // Marshmallow keeps the full deck until its own setup is verified.
  assert.equal(deckMaxRankFor(4, 'marshmallow'), 15);
});

test('deal size: 13 at 2-4 players, 14 at 5', () => {
  assert.deepEqual(VP_HAND_SIZE, { 2: 13, 3: 13, 4: 13, 5: 14 });
  assert.equal(dealSizeFor(2), 13);
  assert.equal(dealSizeFor(3), 13);
  assert.equal(dealSizeFor(4), 13);
  assert.equal(dealSizeFor(5), 14);
  // Marshmallow keeps the legacy flat 14 for now.
  assert.equal(dealSizeFor(4, 'marshmallow'), 14);
});

test('exit thresholds: 4th trick at 3p, 3rd at 4p/5p; 2p has none', () => {
  assert.deepEqual(VP_TRICKS_TO_EXIT, { 3: 4, 4: 3, 5: 3 });
  assert.equal(tricksToExit(3), 4);
  assert.equal(tricksToExit(4), 3);
  assert.equal(tricksToExit(5), 3);
  assert.equal(tricksToExit(2), null); // 2p special mode, no exit
  assert.equal(isTwoPlayerSpecial(2), true);
  assert.equal(isTwoPlayerSpecial(3), false);
  assert.equal(isTwoPlayerSpecial(2, 'marshmallow'), false);
  // Marshmallow keeps its legacy threshold table for now.
  assert.equal(tricksToExit(2, 'marshmallow'), 6);
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
