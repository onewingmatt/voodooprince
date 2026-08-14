import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  chooseTrump,
  legalPlays,
  playCard,
  nextToPlay,
  startNextHand,
  advanceToNextHand,
} from '../../server/game/engine.js';
import { dealSizeFor, SUITS } from '../../server/game/rules.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false }));
const C = (suit, rank) => ({ suit, rank });

function setupTwoPlayer(ruleset = 'full') {
  const state = createGame(players(2), ruleset);
  if (ruleset === 'full') chooseTrump(state, 0, 'Red');
  return state;
}

test('createGame deals a full hand to everyone, no duplicate cards', () => {
  const state = createGame(players(4), 'full');
  assert.equal(state.handNumber, 1);
  assert.equal(state.phase, 'choosing_trump');
  assert.equal(state.trumpSuit, null);
  const all = state.players.flatMap((p) => p.hand);
  assert.equal(all.length, 4 * dealSizeFor(4));
  assert.equal(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size, all.length);
});

test('marshmallow starts in playing phase with rotating trump', () => {
  const state = createGame(players(2), 'marshmallow');
  assert.equal(state.phase, 'playing');
  assert.equal(state.trumpSuit, 'Red'); // SUITS[(1-1) % 5]
  state.phase = 'between_hands';
  advanceToNextHand(state);
  assert.equal(state.handNumber, 2);
  assert.equal(state.trumpSuit, 'Blue');
});

test('chooseTrump validates dealer, phase, and suit', () => {
  const state = createGame(players(2), 'full');
  assert.throws(() => chooseTrump(state, 1, 'Red'), /Only the dealer/);
  assert.throws(() => chooseTrump(state, 0, 'Pink'), /Invalid suit/);
  chooseTrump(state, 0, 'Blue');
  assert.equal(state.trumpSuit, 'Blue');
  assert.equal(state.phase, 'playing');
  assert.throws(() => chooseTrump(state, 0, 'Red'), /Not choosing trump/);
});

test('legalPlays: leading is free, then follow suit', () => {
  const state = setupTwoPlayer();
  state.players[1].hand = [C('Blue', 5), C('Red', 9)];
  assert.equal(legalPlays(state, 1).length, 2);
  state.currentTrick = [{ seat: 0, card: C('Blue', 1) }];
  assert.deepEqual(legalPlays(state, 1), [C('Blue', 5)]);
  state.players[1].hand = [C('Green', 2), C('Red', 9)];
  assert.deepEqual(legalPlays(state, 1).sort((a, b) => a.rank - b.rank), [C('Green', 2), C('Red', 9)]);
});

test('legalPlays: marshmallow forces trump/lead when trump was already played', () => {
  const state = setupTwoPlayer('marshmallow'); // trump = Red
  state.players[1].hand = [C('Blue', 3), C('Red', 7)];
  state.currentTrick = [{ seat: 0, card: C('Red', 1) }]; // trump already played
  assert.deepEqual(legalPlays(state, 1), [C('Red', 7)]);
  state.players[1].hand = [C('Blue', 3)];
  assert.deepEqual(legalPlays(state, 1), [C('Blue', 3)]);
});

test('playCard enforces turn, phase, and legality', () => {
  const state = setupTwoPlayer();
  // Deterministic hands: the random deal must not accidentally make these plays legal.
  state.players[0].hand = [C('Red', 3), C('Green', 9)];
  state.players[1].hand = [C('Red', 1)];
  assert.throws(() => playCard(state, 1, C('Red', 1)), /Not your turn/);
  assert.throws(() => playCard(state, 0, C('Blue', 12)), /Illegal card/); // Blue:12 not in hand
  state.phase = 'choosing_trump';
  assert.throws(() => playCard(state, 0, C('Red', 3)), /Not currently playing/);
});

test('higher card of the lead suit wins the trick', () => {
  const state = setupTwoPlayer();
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 5)];
  playCard(state, 0, C('Red', 10));
  assert.equal(nextToPlay(state), 1);
  playCard(state, 1, C('Red', 5));
  assert.equal(state.players[0].tricksWon, 1);
  assert.equal(state.players[1].tricksWon, 0);
  assert.deepEqual(state.currentTrick, []);
  assert.equal(state.leaderSeat, 0); // winner leads next
});

test('trump beats the lead suit even with a lower rank', () => {
  const state = setupTwoPlayer(); // trump Red
  state.players[0].hand = [C('Blue', 9)];
  state.players[1].hand = [C('Red', 2)];
  playCard(state, 0, C('Blue', 9));
  playCard(state, 1, C('Red', 2));
  assert.equal(state.players[1].tricksWon, 1);
});

test('rank-0 (zero card) plays as 16', () => {
  const state = setupTwoPlayer();
  state.players[0].hand = [C('Red', 0)];
  state.players[1].hand = [C('Red', 15)];
  playCard(state, 0, C('Red', 0));
  playCard(state, 1, C('Red', 15));
  assert.equal(state.players[0].tricksWon, 1);
});

test('specials (5/7) count double for tricksWon', () => {
  const state = setupTwoPlayer();
  state.players[0].hand = [C('Red', 5)];
  state.players[1].hand = [C('Red', 1)];
  playCard(state, 0, C('Red', 5));
  playCard(state, 1, C('Red', 1));
  assert.equal(state.players[0].tricksWon, 2);
});

test('exiting player scores the others` frozen tricks; last standing scores their own', () => {
  const state = setupTwoPlayer();
  state.players[0].tricksWon = 5; // threshold for 2p is 6
  state.players[1].tricksWon = 2;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, 0, C('Red', 10));
  // p0 wins -> reaches threshold -> exits, scoring p1's frozen tricks; with
  // only one active player left, the hand finishes immediately and p1 is the
  // last standing, scoring their own tricks.
  playCard(state, 1, C('Red', 3));
  assert.equal(state.players[0].exited, true);
  assert.equal(state.players[0].score, 2); // = player 1's frozen tricks
  assert.equal(state.players[1].score, 2); // = player 1's own tricks
  assert.deepEqual(state.activePlayers, [1]);
  assert.equal(state.phase, 'between_hands');
  assert.equal(state.dealerSeat, 1);
});

test('game ends after 5 hands (full ruleset)', () => {
  const state = createGame(players(2), 'full');
  state.dealerSeat = 0;
  state.handNumber = 4;
  state.phase = 'between_hands';
  advanceToNextHand(state); // hand 5
  assert.equal(state.handNumber, 5);
  chooseTrump(state, state.dealerSeat, 'Red');
  state.players[0].tricksWon = 5;
  state.players[1].tricksWon = 1;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, state.dealerSeat, C('Red', 10));
  playCard(state, 1 - state.dealerSeat, C('Red', 3)); // p0 exits, p1 last standing, hand 5 ends
  assert.equal(state.phase, 'game_over');
  assert.ok(state.log.some((l) => l.includes('Game over')));
});

test('marshmallow ends once someone reaches the target score', () => {
  const state = createGame(players(2), 'marshmallow');
  state.players[0].score = 19;
  state.players[0].tricksWon = 5;
  state.players[1].tricksWon = 1;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 3)); // p0 exits at 20 -> p1 last standing -> game over
  assert.equal(state.phase, 'game_over');
  assert.ok(state.players.some((p) => p.score >= 20));
});

test('advanceToNextHand resets tricks/exits and rotates nothing until finish', () => {
  const state = createGame(players(2), 'full');
  assert.throws(() => advanceToNextHand(state), /Not between hands/);
  state.phase = 'between_hands';
  state.players[0].tricksWon = 4;
  state.players[0].exited = true;
  advanceToNextHand(state);
  assert.equal(state.handNumber, 2);
  assert.equal(state.players[0].tricksWon, 0);
  assert.equal(state.players[0].exited, false);
  assert.deepEqual(state.activePlayers, [0, 1]);
  assert.equal(state.phase, 'choosing_trump');
});

test('startNextHand leaves the deck untouched across players (no shared cards)', () => {
  const state = createGame(players(3), 'full');
  startNextHand(state);
  const all = state.players.flatMap((p) => p.hand);
  assert.equal(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size, all.length);
  assert.equal(state.trumpSuit, null);
  assert.equal(state.phase, 'choosing_trump');
  assert.ok(SUITS.length === 5);
});
