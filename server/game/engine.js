import { buildDeck, shuffle, cardId } from './deck.js';
import {
  SUITS,
  dealSizeFor,
  tricksToExit,
  isSpecial,
  isZeroCard,
  trickValue,
  deckMaxRankFor,
  isTwoPlayerSpecial,
  TWO_PLAYER_TRICK_TARGET,
  HANDS_PER_GAME,
  MARSHMALLOW_TARGET_SCORE,
} from './rules.js';

// players: [{id, name, isBot}], ruleset: 'full' | 'marshmallow'
export function createGame(players, ruleset) {
  const state = {
    ruleset,
    playerCount: players.length,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      hand: [],
      tricksWon: 0,
      exited: false,
      score: 0,
    })),
    dealerSeat: 0,
    lastStandingSeat: null, // the player left when a hand ends; deals + chooses trump next hand
    handNumber: 0,
    phase: 'between_hands',
    trumpSuit: null,
    activePlayers: [],
    leaderSeat: null,
    currentTrick: [],
    log: [],
  };
  startNextHand(state);
  return state;
}

function log(state, message) {
  state.log.push(message);
  if (state.log.length > 200) state.log.shift();
}

export function startNextHand(state) {
  state.handNumber += 1;
  const dealSize = dealSizeFor(state.playerCount, state.ruleset);
  const deck = shuffle(buildDeck(state.playerCount, state.ruleset));
  state.players.forEach((p, i) => {
    p.hand = deck.slice(i * dealSize, (i + 1) * dealSize);
    p.tricksWon = 0;
    p.exited = false;
  });
  state.activePlayers = state.players.map((_, i) => i);
  state.currentTrick = [];

  if (state.ruleset === 'marshmallow') {
    state.trumpSuit = SUITS[(state.handNumber - 1) % SUITS.length];
    state.leaderSeat = state.dealerSeat;
    state.phase = 'playing';
    log(state, `Hand ${state.handNumber}: trump is ${state.trumpSuit}.`);
  } else if (state.handNumber === 1) {
    // Hand 1: shuffle the five suit cards, flip one for trump. The dealer leads.
    state.trumpSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
    state.leaderSeat = state.dealerSeat;
    state.phase = 'playing';
    log(state, `Hand ${state.handNumber}: ${state.trumpSuit} is trump (drawn at random).`);
  } else {
    // Hands 2+: the last-standing player from the previous hand deals and,
    // after looking at their hand, chooses the trump suit.
    state.dealerSeat = state.lastStandingSeat ?? state.dealerSeat;
    state.trumpSuit = null;
    state.leaderSeat = state.dealerSeat;
    state.phase = 'choosing_trump';
    log(state, `Hand ${state.handNumber}: ${state.players[state.dealerSeat].name} is choosing trump.`);
  }
  return state;
}

export function chooseTrump(state, seat, suit) {
  if (state.phase !== 'choosing_trump') throw new Error('Not choosing trump right now.');
  if (seat !== state.dealerSeat) throw new Error('Only the dealer chooses trump.');
  if (!SUITS.includes(suit)) throw new Error('Invalid suit.');
  state.trumpSuit = suit;
  state.phase = 'playing';
  log(state, `${state.players[seat].name} chose ${suit} as trump.`);
  return state;
}

// The voodoo doll (0) is the weakest card of its suit unless the suit's highest
// card (10/12/15 depending on player count) is in the SAME trick — then the 0
// outranks it. Trump still beats a non-trump 0 (it's compared inside its own
// suit pool only).
function effectiveRank(card, state) {
  if (isZeroCard(card, state.ruleset)) {
    const top = deckMaxRankFor(state.playerCount, state.ruleset);
    const topPlayed = state.currentTrick.some(
      (p) => p.card.suit === card.suit && p.card.rank === top
    );
    return topPlayed ? top + 1 : 0;
  }
  return card.rank;
}

export function legalPlays(state, seat) {
  const player = state.players[seat];
  const trick = state.currentTrick;
  if (trick.length === 0) return player.hand.slice();

  const leadSuit = trick[0].card.suit;
  const leadSuitCards = player.hand.filter((c) => c.suit === leadSuit);
  const trumpAlreadyPlayed =
    state.ruleset === 'marshmallow' && trick.some((p) => p.card.suit === state.trumpSuit);

  if (trumpAlreadyPlayed) {
    const trumpCards = player.hand.filter((c) => c.suit === state.trumpSuit);
    if (leadSuitCards.length || trumpCards.length) {
      const map = new Map();
      [...leadSuitCards, ...trumpCards].forEach((c) => map.set(cardId(c), c));
      return [...map.values()];
    }
    return player.hand.slice();
  }

  if (leadSuitCards.length) return leadSuitCards;
  return player.hand.slice();
}

export function nextToPlay(state) {
  const { activePlayers, leaderSeat, currentTrick } = state;
  const leaderPos = activePlayers.indexOf(leaderSeat);
  const pos = (leaderPos + currentTrick.length) % activePlayers.length;
  return activePlayers[pos];
}

function resolveTrickWinner(trick, state) {
  const leadSuit = trick[0].card.suit;
  const trumpPlays = trick.filter((p) => p.card.suit === state.trumpSuit);
  const pool = trumpPlays.length ? trumpPlays : trick.filter((p) => p.card.suit === leadSuit);
  let best = pool[0];
  for (const p of pool) {
    if (effectiveRank(p.card, state) > effectiveRank(best.card, state)) best = p;
  }
  return best;
}

function nextActiveSeatAfter(seatOrder, activePlayers, afterSeat) {
  const pos = seatOrder.indexOf(afterSeat);
  for (let step = 1; step <= seatOrder.length; step++) {
    const candidate = seatOrder[(pos + step) % seatOrder.length];
    if (activePlayers.includes(candidate)) return candidate;
  }
  return afterSeat;
}

export function playCard(state, seat, card) {
  if (state.phase !== 'playing') throw new Error('Not currently playing.');
  if (seat !== nextToPlay(state)) throw new Error('Not your turn.');

  const player = state.players[seat];
  const legal = legalPlays(state, seat);
  const match = legal.find((c) => c.suit === card.suit && c.rank === card.rank);
  if (!match) throw new Error('Illegal card.');

  player.hand = player.hand.filter((c) => !(c.suit === card.suit && c.rank === card.rank));
  state.currentTrick.push({ seat, card: match });
  log(state, `${player.name} plays ${match.rank} of ${match.suit}.`);

  if (state.currentTrick.length === state.activePlayers.length) {
    resolveTrick(state);
  }
  return state;
}

function resolveTrick(state) {
  const winner = resolveTrickWinner(state.currentTrick, state);
  const winningPlayer = state.players[winner.seat];
  const value = trickValue(winner.card, state.ruleset);
  winningPlayer.tricksWon += value;
  log(state, `${winningPlayer.name} wins the trick${value === 2 ? ' (counts double!)' : ''}.`);

  const seatOrder = state.players.map((_, i) => i);

  // 2-player special mode: no exits. The hand ends the moment someone reaches
  // 7 tricks. They score one point per trick their opponent won; the opponent
  // scores one point per trick they would still need to reach 7.
  if (isTwoPlayerSpecial(state.playerCount, state.ruleset)) {
    state.currentTrick = [];
    if (winningPlayer.tricksWon >= TWO_PLAYER_TRICK_TARGET) {
      const otherSeat = seatOrder.find((s) => s !== winner.seat);
      const other = state.players[otherSeat];
      winningPlayer.score += other.tricksWon;
      other.score += Math.max(0, TWO_PLAYER_TRICK_TARGET - other.tricksWon);
      log(
        state,
        `${winningPlayer.name} reached ${TWO_PLAYER_TRICK_TARGET} tricks. ` +
          `Scores ${other.tricksWon}; ${other.name} scores ${Math.max(0, TWO_PLAYER_TRICK_TARGET - other.tricksWon)}.`
      );
      // The player who didn't reach the target is the "last standing" analog
      // and deals + chooses trump next hand (inferred for 2p; the card-sized
      // rules only spell out the multi-player end-of-hand flow).
      state.lastStandingSeat = otherSeat;
      finishHand(state);
      return;
    }
    state.leaderSeat = winner.seat;
    return;
  }

  const threshold = tricksToExit(state.playerCount);

  if (winningPlayer.tricksWon >= threshold) {
    // Score = tricks held by every other player, including those who already
    // exited earlier this hand (their trick count is frozen but still counts) —
    // not just the currently-still-in players.
    const others = seatOrder.filter((s) => s !== winner.seat);
    const scoreGain = others.reduce((sum, s) => sum + state.players[s].tricksWon, 0);
    winningPlayer.score += scoreGain;
    winningPlayer.exited = true;
    state.activePlayers = state.activePlayers.filter((s) => s !== winner.seat);
    log(state, `${winningPlayer.name} is out of the hand, scoring ${scoreGain}.`);
  }

  state.currentTrick = [];

  if (state.activePlayers.length === 1) {
    const lastSeat = state.activePlayers[0];
    const lastPlayer = state.players[lastSeat];
    lastPlayer.score += lastPlayer.tricksWon;
    log(state, `${lastPlayer.name} is last standing, scoring ${lastPlayer.tricksWon}.`);
    state.lastStandingSeat = lastSeat;
    finishHand(state);
    return;
  }

  state.leaderSeat = state.activePlayers.includes(winner.seat)
    ? winner.seat
    : nextActiveSeatAfter(seatOrder, state.activePlayers, winner.seat);
}

function finishHand(state) {
  if (state.ruleset === 'marshmallow') {
    state.dealerSeat = (state.dealerSeat + 1) % state.playerCount;
  } else {
    // The last-standing player deals the next round.
    state.dealerSeat = state.lastStandingSeat;
  }

  const gameOver =
    state.ruleset === 'marshmallow'
      ? state.players.some((p) => p.score >= MARSHMALLOW_TARGET_SCORE)
      : state.handNumber >= HANDS_PER_GAME;

  if (gameOver) {
    state.phase = 'game_over';
    const winner = state.players.reduce((a, b) => (b.score > a.score ? b : a));
    log(state, `Game over! ${winner.name} wins with ${winner.score} points.`);
  } else {
    state.phase = 'between_hands';
  }
}

export function advanceToNextHand(state) {
  if (state.phase !== 'between_hands') throw new Error('Not between hands.');
  startNextHand(state);
  return state;
}
