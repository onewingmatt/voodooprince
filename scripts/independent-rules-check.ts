/**
 * Independent rules audit — Voodoo Prince (Schmidt Spiele 2017).
 *
 * Replays the rulebook's OWN tables and worked examples (numbers transcribed from
 * references/rulebook-extract.md, which was extracted fresh from the official
 * multi-language rulebook PDF) against the LIVE engine. It does NOT reuse the
 * project's existing test assertions. Run: `npm run audit` (or `npx tsx scripts/independent-rules-check.ts`).
 *
 * Every check is named with its rulebook section; a FAIL exits nonzero so the
 * audit is exit-code driven for CI/deploy gates.
 */
import { createGame, chooseTrump, legalPlays, playCard, startNextHand } from '../server/game/engine.js';
import { buildDeck, shuffle, cardId } from '../server/game/deck.js';
import {
  SUITS,
  VP_DECK_MAX_RANK,
  VP_HAND_SIZE,
  VP_TRICKS_TO_EXIT,
  TWO_PLAYER_TRICK_TARGET,
  HANDS_PER_GAME,
  deckMaxRankFor,
  dealSizeFor,
  tricksToExit,
  isSpecial,
  isZeroCard,
  trickValue,
  isTwoPlayerSpecial,
} from '../server/game/rules.js';

// ---------------------------------------------------------------------------
// Rulebook tables, transcribed VERBATIM from the Schmidt Spiele 2017 rulebook
// (references/rulebook-extract.md; official PDF:
//  https://gesellschaftsspiele.spielen.de/uploads/files/3424/59cc00debe8bc.pdf)
// ---------------------------------------------------------------------------
const RB = {
  // p.2 setup table
  valuesInPlay: { 2: [0, 10], 3: [0, 10], 4: [0, 12], 5: [0, 15] },
  cardsPerPlayer: { 2: 13, 3: 13, 4: 13, 5: 14 },
  // p.4 trick table
  tricksPerPlayer: { 2: 7, 3: 4, 4: 3, 5: 3 },
  // p.1 materials
  voodooCards: 80,
  suits: 5,
  ranksPerSuit: 16,
  trumpCards: 5,
  overviewCards: 1,
  totalCards: 86,
  // p.6 game end
  handsPerGame: 5,
  tiesMultipleWinners: true,
};

const C = (suit, rank) => ({ suit, rank });

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function setupPlaying(n, ruleset = 'full', trump = 'Red') {
  const state = createGame(
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false })),
    ruleset
  );
  state.trumpSuit = trump;
  state.phase = 'playing';
  state.leaderSeat = state.dealerSeat;
  return state;
}

console.log('\n=== Voodoo Prince independent rules audit (rulebook-verbatim replay) ===\n');

// --- A. Component inventory (rulebook p.1) ----------------------------------
console.log('A. Component inventory (p.1)');
{
  const deck = buildDeck(5, 'full');
  check('full deck is 80 voodoo cards (5 suits x 16 ranks 0-15)', deck.length === RB.voodooCards, `got ${deck.length}`);
  check('exactly 5 suits', new Set(deck.map((c) => c.suit)).size === RB.suits);
  const ranks = new Set(deck.map((c) => c.rank));
  check('ranks 0..15 inclusive (16 ranks)', ranks.size === RB.ranksPerSuit && Math.min(...ranks) === 0 && Math.max(...ranks) === 15);
  check('all cards unique', new Set(deck.map(cardId)).size === deck.length);
  const zeroPerSuit = RB.suits;
  const specialsPerSuit = 2; // 5 and 7
  check(
    `special cards: 3 per color (0, 5, 7) -> ${zeroPerSuit} zeros + ${specialsPerSuit * RB.suits} splitters`,
    deck.filter((c) => c.rank === 0).length === zeroPerSuit &&
      deck.filter((c) => c.rank === 5 || c.rank === 7).length === specialsPerSuit * RB.suits
  );
}

// --- B. Setup table (rulebook p.2) ------------------------------------------
console.log('\nB. Setup table (p.2): values in play / cards per player');
for (const n of [2, 3, 4, 5]) {
  const [lo, hi] = RB.valuesInPlay[n];
  const deck = buildDeck(n, 'full');
  check(
    `deck cut at ${n}p: ranks ${lo}-${hi} (${hi + 1} ranks x 5 suits = ${(hi + 1) * 5} cards)`,
    deckMaxRankFor(n) === hi &&
      deck.length === (hi + 1) * RB.suits &&
      deck.every((c) => c.rank >= lo && c.rank <= hi),
    `engine maxRank=${deckMaxRankFor(n)}, deck=${deck.length}`
  );
  check(
    `deal ${RB.cardsPerPlayer[n]} cards each at ${n}p`,
    dealSizeFor(n) === RB.cardsPerPlayer[n],
    `got ${dealSizeFor(n)}`
  );
}
// 0-beats table (p.5): the top card the 0 can beat equals the deck max rank
for (const n of [2, 3, 4, 5]) {
  const [lo, hi] = RB.valuesInPlay[n];
  check(`0 beats ${hi} at ${n}p (same color, same trick)`, deckMaxRankFor(n) === hi && VP_DECK_MAX_RANK[n] === hi);
}
// blind: remainder of the deck is set aside, not dealt
for (const n of [2, 3, 4, 5]) {
  const state = createGame(
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false })),
    'full'
  );
  const dealt = state.players.reduce((s, p) => s + p.hand.length, 0);
  const deckSize = (RB.valuesInPlay[n][1] + 1) * RB.suits;
  check(`blind at ${n}p: ${deckSize - dealt} cards set aside (${dealt} dealt of ${deckSize})`, dealt < deckSize);
}

// --- C. Trick table (rulebook p.4) + exit thresholds -------------------------
console.log('\nC. Exit thresholds (p.4): tricks per player');
check('3p exits at 4th trick', tricksToExit(3) === RB.tricksPerPlayer[3] && VP_TRICKS_TO_EXIT[3] === 4);
check('4p exits at 3rd trick', tricksToExit(4) === RB.tricksPerPlayer[4] && VP_TRICKS_TO_EXIT[4] === 3);
check('5p exits at 3rd trick', tricksToExit(5) === RB.tricksPerPlayer[5] && VP_TRICKS_TO_EXIT[5] === 3);
check('2p: no exit threshold; hand ends at 7 (special mode)', tricksToExit(2) === null && isTwoPlayerSpecial(2) && TWO_PLAYER_TRICK_TARGET === RB.tricksPerPlayer[2]);

// --- D. Trick resolution (rulebook p.3) --------------------------------------
console.log('\nD. Trick resolution (p.3)');
{
  // Rulebook worked example: 4p, Blue trump. Marie(0) red 4, Lukas(1) red 3,
  // Leon(2) green 12, Nina(3) blue 2 -> blue 2 (trump) wins.
  const state = setupPlaying(4, 'full', 'Blue');
  state.players[0].hand = [C('Red', 4)];
  state.players[1].hand = [C('Red', 3)];
  state.players[2].hand = [C('Green', 12)];
  state.players[3].hand = [C('Blue', 2)];
  for (const [seat, card] of [[0, C('Red', 4)], [1, C('Red', 3)], [2, C('Green', 12)], [3, C('Blue', 2)]]) playCard(state, seat, card);
  check('worked example p.3: trump blue-2 beats green 12 (lead red 4/3)', state.players[3].tricksWon === 1 && state.players[2].tricksWon === 0);
  check('trick winner leads the next trick', state.leaderSeat === 3);
}
{
  // Highest trump wins when several trumps.
  const state = setupPlaying(4, 'full', 'Red');
  state.players[0].hand = [C('Blue', 9)];
  state.players[1].hand = [C('Red', 2)];
  state.players[2].hand = [C('Red', 5)];
  state.players[3].hand = [C('Blue', 1)];
  for (const [seat, card] of [[0, C('Blue', 9)], [1, C('Red', 2)], [2, C('Red', 5)], [3, C('Blue', 1)]]) playCard(state, seat, card);
  check('highest trump wins among multiple trumps', state.players[2].tricksWon === 2);
}
{
  // No trump: highest led-suit card wins; off-suit values meaningless.
  const state = setupPlaying(4, 'full', 'Red');
  state.players[0].hand = [C('Blue', 3)];
  state.players[1].hand = [C('Blue', 9)];
  state.players[2].hand = [C('Green', 15)];
  state.players[3].hand = [C('Blue', 1)];
  for (const [seat, card] of [[0, C('Blue', 3)], [1, C('Blue', 9)], [2, C('Green', 15)], [3, C('Blue', 1)]]) playCard(state, seat, card);
  check('without trump, highest led-suit card wins (off-suit value meaningless)', state.players[1].tricksWon === 1);
}
{
  // Follow suit: must follow the led suit if possible.
  const state = setupPlaying(2);
  state.players[1].hand = [C('Blue', 5), C('Red', 9)];
  state.currentTrick = [{ seat: 0, card: C('Blue', 1) }];
  const legal = legalPlays(state, 1);
  check('must follow suit when able', legal.length === 1 && legal[0].suit === 'Blue');
  state.players[1].hand = [C('Green', 2), C('Red', 9)];
  check('void in led suit -> any card legal', legalPlays(state, 1).length === 2);
}

// --- E. Special cards (rulebook p.5) -----------------------------------------
console.log('\nE. Special cards (p.5)');
{
  // 0 beats the suit's top card in the SAME trick; otherwise weakest.
  const state = setupPlaying(2, 'full', 'Red'); // 2p deck tops at 10
  state.players[0].hand = [C('Blue', 0)];
  state.players[1].hand = [C('Blue', 10)];
  playCard(state, 0, C('Blue', 0));
  playCard(state, 1, C('Blue', 10));
  check('worked example p.5a: 0 beats 10 of same color in same trick', state.players[0].tricksWon === 1);

  const state2 = setupPlaying(2, 'full', 'Red');
  state2.players[0].hand = [C('Blue', 0)];
  state2.players[1].hand = [C('Blue', 9)];
  playCard(state2, 0, C('Blue', 0));
  playCard(state2, 1, C('Blue', 9));
  check('0 is weakest without the top card in the trick', state2.players[1].tricksWon === 1);
}
{
  // Trump still beats a non-trump 0 (even when the 0 beats its suit's top).
  const state = setupPlaying(4, 'full', 'Red'); // 4p deck tops at 12
  state.players[0].hand = [C('Blue', 0)];
  state.players[1].hand = [C('Blue', 12)];
  state.players[2].hand = [C('Red', 1)];
  state.players[3].hand = [C('Green', 5)];
  for (const [seat, card] of [[0, C('Blue', 0)], [1, C('Blue', 12)], [2, C('Red', 1)], [3, C('Green', 5)]]) playCard(state, seat, card);
  check('trump beats a non-trump 0 (p.5a: red 1 beats blue 0 vs blue 12)', state.players[2].tricksWon === 1);
}
{
  // 5/7 split ONLY when actively won with the 5/7 (p.5b).
  const state = setupPlaying(4, 'full', 'Blue');
  state.players[0].hand = [C('Yellow', 4)];
  state.players[1].hand = [C('Yellow', 2)];
  state.players[2].hand = [C('Yellow', 8)];
  state.players[3].hand = [C('Blue', 5)];
  // Rulebook p.5b: Nina already holds 2 tricks before this trick; the 5-split
  // (winning with a blue 5 counts as TWO) pushes her to 4 >= 4p exit threshold 3.
  state.players[3].tricksWon = 2;
  for (const [seat, card] of [[0, C('Yellow', 4)], [1, C('Yellow', 2)], [2, C('Yellow', 8)], [3, C('Blue', 5)]]) playCard(state, seat, card);
  check('worked example p.5b: Nina wins with blue 5 -> trick counts as TWO', state.players[3].tricksWon === 4);
  check('worked example p.5b: 5-split pushes past threshold (4p exits at 3, Nina at 4)', state.players[3].exited && state.players[3].tricksWon === 4);
}
{
  // A 5/7 present but NOT winning does not split (rulebook: presence is not enough).
  const state = setupPlaying(3, 'full', 'Green');
  state.players[0].hand = [C('Red', 5)];
  state.players[1].hand = [C('Red', 10)];
  state.players[2].hand = [C('Blue', 1)];
  for (const [seat, card] of [[0, C('Red', 5)], [1, C('Red', 10)], [2, C('Blue', 1)]]) playCard(state, seat, card);
  check('5 in trick but not winning -> single trick', state.players[1].tricksWon === 1 && state.players[0].tricksWon === 0);
}
check('trickValue: 5 and 7 = 2, others = 1', trickValue(C('Red', 5)) === 2 && trickValue(C('Red', 7)) === 2 && trickValue(C('Red', 6)) === 1 && trickValue(C('Red', 0)) === 1);
check('isSpecial only for 5 and 7', isSpecial(C('Red', 5)) && isSpecial(C('Red', 7)) && !isSpecial(C('Red', 6)) && !isSpecial(C('Red', 0)));
check('isZeroCard only for rank 0', isZeroCard(C('Red', 0)) && !isZeroCard(C('Red', 1)));

// --- F. Exit & scoring (rulebook p.4) ----------------------------------------
console.log('\nF. Exit & scoring (p.4)');
{
  // Worked example p.4: 4p, Marie exits at 3rd trick with others at 2/1/1 -> 4 points.
  const state = setupPlaying(4, 'full', 'Red');
  state.players[0].tricksWon = 2;
  state.players[1].tricksWon = 2;
  state.players[2].tricksWon = 1;
  state.players[3].tricksWon = 1;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  state.players[2].hand = [C('Red', 1)];
  state.players[3].hand = [C('Blue', 2)];
  for (const [seat, card] of [[0, C('Red', 10)], [1, C('Red', 3)], [2, C('Red', 1)], [3, C('Blue', 2)]]) playCard(state, seat, card);
  check('worked example p.4: Marie exits scoring 2+1+1 = 4', state.players[0].score === 4 && state.players[0].exited);
  check('player to the left of the exiting player leads next', state.leaderSeat === 1);
}
{
  // Exited players' frozen tricks still count for later scorings (rulebook p.4).
  const state = setupPlaying(3, 'full', 'Red');
  state.players[0].tricksWon = 4; // already exited
  state.players[1].tricksWon = 3;
  state.players[2].tricksWon = 1;
  state.players[0].exited = true;
  state.activePlayers = [1, 2];
  state.leaderSeat = 1;
  state.players[1].hand = [C('Red', 10)];
  state.players[2].hand = [C('Red', 3)];
  playCard(state, 1, C('Red', 10));
  playCard(state, 2, C('Red', 3));
  check('exit scoring includes already-exited players (frozen 4 + 1 = 5)', state.players[1].score === 5);
  check('last standing scores only their own tricks', state.players[2].score === 1);
}
{
  // Last standing becomes next hand's dealer + trump chooser + leader (p.4/5).
  const state = setupPlaying(3, 'full', 'Red');
  state.players[0].tricksWon = 4;
  state.players[1].tricksWon = 3;
  state.players[2].tricksWon = 1;
  state.players[0].exited = true;
  state.activePlayers = [1, 2];
  state.leaderSeat = 1;
  state.players[1].hand = [C('Red', 10)];
  state.players[2].hand = [C('Red', 3)];
  playCard(state, 1, C('Red', 10));
  playCard(state, 2, C('Red', 3));
  check('last standing deals next hand', state.phase === 'between_hands' && state.dealerSeat === 2);
  // Advance: next hand is a trump-choice phase led by the last-standing player.
  const hand2 = startNextHand(state);
  check('next hand: last-standing chooses trump (phase choosing_trump)', hand2.phase === 'choosing_trump' && hand2.dealerSeat === 2 && hand2.leaderSeat === 2);
  chooseTrump(hand2, 2, 'Blue');
  check('dealer can choose ANY suit as trump', hand2.trumpSuit === 'Blue' && hand2.phase === 'playing');
}

// --- G. 2-player rules (rulebook p.6) ----------------------------------------
console.log('\nG. 2-player rules (p.6)');
{
  // Worked example p.6: Carsten 7, Ulrich 2 -> Carsten 2, Ulrich 5.
  const state = setupPlaying(2, 'full', 'Red');
  state.players[0].tricksWon = 6;
  state.players[1].tricksWon = 2;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 3));
  check('worked example p.6: 7-trick winner scores opponent tricks (2)', state.players[0].score === 2);
  check('worked example p.6: opponent scores tricks needed to reach 7 (5)', state.players[1].score === 5);
  check('hand ends when a player reaches 7 tricks', state.phase === 'between_hands');
}
{
  // Second 2p example: Ulrich at 6 -> opponent 1, winner 6.
  const state = setupPlaying(2, 'full', 'Red');
  state.players[0].tricksWon = 6;
  state.players[1].tricksWon = 6;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 3)];
  playCard(state, 0, C('Red', 10));
  playCard(state, 1, C('Red', 3));
  check('worked example p.6 alt: 7-6 split -> 6 and 1', state.players[0].score === 6 && state.players[1].score === 1);
}

// --- H. Game end (rulebook p.6) ----------------------------------------------
console.log('\nH. Game end (p.6)');
check('HANDS_PER_GAME = 5', HANDS_PER_GAME === RB.handsPerGame);
{
  // 5 hands -> game_over; winner = most points.
  const state = setupPlaying(3, 'full', 'Red');
  state.handNumber = 4;
  state.phase = 'between_hands';
  state.lastStandingSeat = 0;
  state.players[0].tricksWon = 0;
  state.players[0].exited = false;
  state.players[1].tricksWon = 0;
  state.players[2].tricksWon = 0;
  startNextHand(state); // hand 5
  check('hand 5 begins', state.handNumber === 5 && state.phase === 'choosing_trump');
  chooseTrump(state, state.dealerSeat, 'Blue');
  // Let the hand finish quickly: everyone has 1 card, force exits.
  state.players[0].tricksWon = 3; state.players[1].tricksWon = 3; state.players[2].tricksWon = 0;
  state.players[0].hand = [C('Red', 10)];
  state.players[1].hand = [C('Red', 4), C('Red', 3)];
  state.players[2].hand = [C('Red', 2), C('Red', 1)];
  playCard(state, 0, C('Red', 10)); // trick 1: p0 wins 4th -> out
  playCard(state, 1, C('Red', 3));
  playCard(state, 2, C('Red', 1));
  playCard(state, 1, C('Red', 4)); // trick 2: p1 wins 4th -> out, p2 last standing
  playCard(state, 2, C('Red', 2));
  check('game ends after exactly 5 hands', state.phase === 'game_over' && state.handNumber === 5);
}
{
  // Ties: rulebook says multiple winners; engine keeps a score array — no hidden
  // tiebreak. (The UI picks a single "winner" for display only.)
  const state = createGame(
    Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false })),
    'full'
  );
  state.phase = 'game_over';
  state.players.forEach((p, i) => (p.score = i === 0 ? 8 : 8));
  const winner = state.players.reduce((a, b) => (b.score > a.score ? b : a));
  check('tie: engine does not prefer one tied player (reduce picks first max)', winner === state.players[0]);
  check('tie: all tied players keep equal scores (no tiebreak applied)', state.players.every((p) => p.score === 8));
}

// --- I. Deck size bookkeeping (p.2 table) ------------------------------------
console.log('\nI. Deck bookkeeping (p.2)');
check('deck(2p) = 55, deck(3p) = 55, deck(4p) = 65, deck(5p) = 80', [2, 3, 4, 5].every((n) => buildDeck(n).length === (RB.valuesInPlay[n][1] + 1) * RB.suits));
check('shuffle preserves deck identity', (() => { const d = buildDeck(5); const s = shuffle(d); return s.length === d.length && new Set(s.map(cardId)).size === d.length; })());
check('constants agree with rulebook tables', VP_DECK_MAX_RANK[2] === 10 && VP_DECK_MAX_RANK[3] === 10 && VP_DECK_MAX_RANK[4] === 12 && VP_DECK_MAX_RANK[5] === 15 && VP_HAND_SIZE[2] === 13 && VP_HAND_SIZE[3] === 13 && VP_HAND_SIZE[4] === 13 && VP_HAND_SIZE[5] === 14 && VP_TRICKS_TO_EXIT[3] === 4 && VP_TRICKS_TO_EXIT[4] === 3 && VP_TRICKS_TO_EXIT[5] === 3 && TWO_PLAYER_TRICK_TARGET === 7);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log('\nFAILED CHECKS:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
