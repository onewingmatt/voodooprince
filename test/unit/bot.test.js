import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, chooseTrump, legalPlays } from '../../server/game/engine.js';
import { chooseBotCard, chooseBotTrump } from '../../server/game/bot.js';

const C = (suit, rank) => ({ suit, rank });

test('chooseBotTrump returns the most common suit in hand', () => {
  const state = createGame(
    [{ id: 'b', name: 'Bot', isBot: true }, { id: 'p', name: 'P', isBot: false }],
    'full'
  );
  state.players[0].hand = [
    C('Red', 1), C('Red', 2), C('Red', 3), C('Red', 4), C('Red', 5),
    C('Blue', 1), C('Blue', 2),
    C('Green', 1),
  ];
  assert.equal(chooseBotTrump(state, 0), 'Red');
});

test('chooseBotCard always returns a legal play (fuzz over many random hands/tricks)', () => {
  const rulesets = ['full', 'marshmallow'];
  const suits = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
  for (let iter = 0; iter < 200; iter++) {
    const ruleset = rulesets[iter % 2];
    const state = createGame(
      [{ id: 'b', name: 'Bot', isBot: true }, { id: 'p', name: 'P', isBot: false }],
      ruleset
    );
    if (ruleset === 'full') chooseTrump(state, 0, suits[iter % suits.length]);
    // random hand of random size with random cards
    const hand = [];
    const seen = new Set();
    while (hand.length < 3 + (iter % 10)) {
      const s = suits[Math.floor(Math.random() * suits.length)];
      const r = Math.floor(Math.random() * 16);
      const key = `${s}:${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hand.push(C(s, r));
    }
    state.players[0].hand = hand;
    // random current trick
    const trick = [];
    const n = iter % 3;
    for (let i = 0; i < n; i++) trick.push({ seat: 1, card: C(suits[(iter + i) % suits.length], (iter + i) % 16) });
    state.currentTrick = trick;
    const legal = legalPlays(state, 0);
    const pick = chooseBotCard(state, 0);
    assert.ok(
      legal.some((c) => c.suit === pick.suit && c.rank === pick.rank),
      `bot played ${pick.suit}:${pick.rank} which is not legal (ruleset=${ruleset}, trick=${JSON.stringify(trick)}, hand=${JSON.stringify(hand)})`
    );
  }
});
