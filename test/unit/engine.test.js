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
import { dealSizeFor, SUITS, TWO_PLAYER_TRICK_TARGET } from '../../server/game/rules.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false }));
const C = (suit, rank) => ({ suit, rank });

// Hand 1 trump is drawn at random (no chooser); these helpers pin a known
// trump and enter the playing phase directly so the trick tests are
// deterministic.
function setupPlaying(n, ruleset = 'full', trump = 'Red') {
  const state = createGame(players(n), ruleset);
  state.trumpSuit = trump;
  state.phase = 'playing';
  state.leaderSeat = state.dealerSeat;
  return state;
}

test('createGame hand 1 deals a full reduced hand, no duplicates, random trump', () => {
  const state = createGame(players(4), 'full');
  assert.equal(state.handNumber, 1);
  assert.equal(state.phase, 'playing'); // no trump chooser on hand 1
  assert.ok(SUITS.includes(state.trumpSuit)); // random suit-card flip
  const all = state.players.flatMap((p) => p.hand);
  assert.equal(all.length, 4 * dealSizeFor(4));
  assert.equal(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size, all.length);
  // 4p deals from the reduced 0-12 deck
  assert.ok(all.every((c) => c.rank <= 12));
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

test('hands 2+: the last-standing player deals, chooses trump, and leads', () => {
  const state = createGame(players(3), 'full');
  state.phase = 'between_hands';
  state.lastStandingSeat = 2;
  advanceToNextHand(state);
  assert.equal(state.handNumber, 2);
  assert.equal(state.phase, 'choosing_trump');
  assert.equal(state.dealerSeat, 2);
  assert.equal(state.leaderSeat, 2);
  assert.throws(() => chooseTrump(state, 1, 'Red'), /Only the dealer/);
  assert.throws(() => chooseTrump(state, 2, 'Pink'), /Invalid suit/);
  chooseTrump(state, 2, 'Blue');
  assert.equal(state.trumpSuit, 'Blue');
  assert.equal(state.phase, 'playing');
  assert.throws(() => chooseTrump(state, 2, 'Red'), /Not choosing trump/);
});

test('legalPlays: leading is free, then follow suit', () => {
  const state = setupPlaying(2);
  state.players[1].hand = [C('Blue', 5), C('Red', 9)];
  assert.equal(legalPlays(state, 1).length, 2);
  state.currentTrick = [{ seat: 0, card: C('Blue', 1) }];
  assert.deepEqual(legalPlays(state, 1), [C('Blue', 5)]);
  state.players[1].hand = [C('Green', 2), C('Red', 9)];
  assert.deepEqual(legalPlays(state, 1).sort((a, b) => a.rank - b.rank), [C('Green', 2), C('Red', 9)]);
});

test('legalPlays: marshmallow forces trump/lead when trump was already played', () => {
  const state = setupPlaying(2, 'marshmallow'); // trump = Red
  state.players[1].hand = [C('Blue', 3), C('Red', 7)];
  state.currentTrick = [{ seat: 0, card: C('Red', 1) }]; // trump already played
  assert.deepEqual(legalPlays(state, 1), [C('Red', 7)]);
  state.players[1].hand = [C('Blue', 3)];
  assert.deepEqual(legalPlays(state, 1), [C('Blue', 3)]);
});

test('playCard enforces turn, phase, and legality', () => {
  const state = setupPlaying(2);
  assert.throws(() => playCard(state, 1, C('Red', 1)), /Not your turn/);
  assert.throws(() => playCard(state, 0, C('Blue', 12)), /Illegal card/); // 12 > 2p deck max (10)
  state.phase = 'choosing_trump';
  assert.throws(() => playCard(state, 0, C('Red', 1)), /Not currently playing/);
});

test('higher card of the lead suit wins the trick', () => {
  const state = setupPlaying(2);
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
  const state = setupPlaying(2); // trump Red
  state.players[0].hand = [C('Blue', 9)];
  state.players[1].hand = [C('Red', 2)];
  playCard(state, 0, C('Blue', 9));
  playCard(state, 1, C('Red', 2));
  assert.equal(state.players[1].tricksWon, 1);
});

test('rank-0 (voodoo doll) is weakest unless the suit top card is in the trick', () => {
  // Top card for 2p is rank 10.
  const state = setupPlaying(2);
  state.players[0].hand = [C('Red', 0)];
  state.players[1].hand = [C('Red', 10)];
  playCard(state, 0, C('Red', 0));
  playCard(state, 1, C('Red', 10));
  assert.equal(state.players[0].tricksWon, 1, '0 outranks the suit top card when both are played');

  const state2 = setupPlaying(2);
  state2.players[0].hand = [C('Red', 0)];
  state2.players[1].hand = [C('Red', 9)];
  playCard(state2, 0, C('Red', 0));
  playCard(state2, 1, C('Red', 9));
  assert.equal(state2.players[1].tricksWon, 1, '0 is the weakest card without the top card in the trick');
});

test('a non-trump 0 still loses to any trump', () => {
  const state = setupPlaying(2); // trump Red
  state.players[0].hand = [C('Blue', 0)];
  state.players[1].hand = [C('Red', 2)];
  playCard(state, 0, C('Blue', 0));
  playCard(state, 1, C('Red', 2));
  assert.equal(state.players[1].tricksWon, 1);
});

test('specials (5/7) count double for tricksWon', () => {
  const state = setupPlaying(2);
  state.players[0].hand = [C('Red', 5)];
  state.players[1].hand = [C('Red', 1)];
  playCard(state, 0, C('Red', 5));
  playCard(state, 1, C('Red', 1));
  assert.equal(state.players[0].tricksWon, 2);
});

test('exiting player scores the others` frozen tricks; last standing scores their own', () => {
  const state = setupPlaying(3); // 3p exits at 4 tricks
  state.players[0].tricksWon = 3;
  state.players[1].tricksWon = 2;
  state.players[2].tricksWon = 1;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  state.players[2].hand = [C('Blue', 3)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 3));
  playCard(state, 2, C('Blue', 3));
  // p0 wins -> reaches 4 -> exits, scoring others' frozen tricks (2+1=3)
  assert.equal(state.players[0].exited, true);
  assert.equal(state.players[0].score, 3);
  assert.deepEqual(state.activePlayers, [1, 2]);
  assert.equal(state.leaderSeat, 1); // player to the left of the exiting winner leads
});

test('last standing scores their own tricks and deals + chooses trump next hand', () => {
  const state = setupPlaying(3);
  state.players[0].tricksWon = 4; // already out
  state.players[1].tricksWon = 3;
  state.players[2].tricksWon = 1;
  state.players[0].exited = true;
  state.activePlayers = [1, 2];
  state.leaderSeat = 1;
  state.players[1].hand = [C('Red', 10)];
  state.players[2].hand = [C('Red', 3)];
  playCard(state, 1, C('Red', 10));
  playCard(state, 2, C('Red', 3));
  // p1 wins their 4th trick -> exits scoring ALL other players' tricks
  // (p0's frozen 4 + p2's 1 = 5); p2 is last standing scoring their own 1.
  assert.equal(state.players[1].score, 5);
  assert.equal(state.players[2].score, 1);
  assert.equal(state.lastStandingSeat, 2);
  assert.equal(state.phase, 'between_hands');
  assert.equal(state.dealerSeat, 2); // last standing deals next round
});

test('2-player mode: first to 7 ends the hand with the special scoring', () => {
  const state = setupPlaying(2);
  state.players[0].tricksWon = 6;
  state.players[1].tricksWon = 4;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 3));
  // p0 hits 7: scores p1's tricks (4); p1 scores tricks needed to reach 7 (3).
  assert.equal(state.players[0].score, 4);
  assert.equal(state.players[1].score, 3);
  assert.equal(state.phase, 'between_hands');
  assert.equal(state.lastStandingSeat, 1); // the non-winner deals + chooses next
  assert.equal(state.dealerSeat, 1);
  assert.equal(state.players[0].tricksWon, 7);
});

test('2-player mode does NOT exit early before the target', () => {
  const state = setupPlaying(2);
  state.players[0].tricksWon = 3;
  state.players[1].tricksWon = 1;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 3));
  assert.equal(state.players[0].exited, false);
  assert.equal(state.players[0].score, 0);
  assert.equal(state.phase, 'playing');
});

test('game ends after 5 hands (full ruleset)', () => {
  const state = createGame(players(3), 'full');
  state.handNumber = 4;
  state.phase = 'between_hands';
  state.lastStandingSeat = 0;
  advanceToNextHand(state); // hand 5
  assert.equal(state.handNumber, 5);
  state.phase = 'playing';
  // p0 exits on trick 1 (4th trick), p1 exits on trick 2, p2 is last standing.
  state.players[0].tricksWon = 3;
  state.players[1].tricksWon = 3;
  state.players[2].tricksWon = 0;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 4), C('Red', 3)];
  state.players[2].hand = [C('Red', 2), C('Red', 1)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 4));
  playCard(state, 2, C('Red', 2)); // p0 exits at 4
  assert.equal(state.players[0].exited, true);
  playCard(state, 1, C('Red', 3)); // p1 leads trick 2
  playCard(state, 2, C('Red', 1)); // p1 exits at 4, p2 last standing -> hand 5 ends
  assert.equal(state.phase, 'game_over');
  assert.ok(state.log.some((l) => l.includes('Game over')));
});

test('marshmallow ends once someone reaches the target score', () => {
  const state = setupPlaying(2, 'marshmallow');
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

test('advanceToNextHand resets tricks/exits and keeps the deck unshared', () => {
  const state = createGame(players(3), 'full');
  assert.throws(() => advanceToNextHand(state), /Not between hands/);
  state.phase = 'between_hands';
  state.lastStandingSeat = 1;
  state.players[0].tricksWon = 4;
  state.players[0].exited = true;
  advanceToNextHand(state);
  assert.equal(state.handNumber, 2);
  assert.equal(state.players[0].tricksWon, 0);
  assert.equal(state.players[0].exited, false);
  assert.deepEqual(state.activePlayers, [0, 1, 2]);
  assert.equal(state.phase, 'choosing_trump');
  const all = state.players.flatMap((p) => p.hand);
  assert.equal(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size, all.length);
});

test('startNextHand works standalone and deals a fresh reduced deck', () => {
  const state = createGame(players(4), 'full');
  startNextHand(state);
  const all = state.players.flatMap((p) => p.hand);
  assert.equal(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size, all.length);
  assert.ok(SUITS.length === 5);
  assert.ok(all.every((c) => c.rank <= 12));
  assert.equal(state.trumpSuit, null);
  assert.equal(state.phase, 'choosing_trump');
});
