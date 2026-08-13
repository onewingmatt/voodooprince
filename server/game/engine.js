import { buildDeck, shuffle, cardId } from './deck.js';
import {
  SUITS,
  dealSizeFor,
  tricksToExit,
  isSpecial,
  trickValue,
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
  const dealSize = dealSizeFor(state.playerCount);
  let deck = shuffle(buildDeck());
  state.players.forEach((p, i) => {
    p.hand = deck.slice(i * dealSize, (i + 1) * dealSize);
    p.tricksWon = 0;
    p.exited = false;
  });
  state.activePlayers = state.players.map((_, i) => i);
  state.leaderSeat = state.dealerSeat;
  state.currentTrick = [];

  if (state.ruleset === 'marshmallow') {
    state.trumpSuit = SUITS[(state.handNumber - 1) % SUITS.length];
    state.phase = 'playing';
    log(state, `Hand ${state.handNumber}: trump is ${state.trumpSuit}.`);
  } else {
    state.trumpSuit = null;
    state.phase = 'choosing_trump';
    log(state, `Hand ${state.handNumber}: dealer ${state.players[state.dealerSeat].name} is choosing trump.`);
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

function effectiveRank(card, ruleset) {
  if (ruleset !== 'marshmallow' && card.rank === 0) return 16;
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

function resolveTrickWinner(trick, trumpSuit, ruleset) {
  const leadSuit = trick[0].card.suit;
  const trumpPlays = trick.filter((p) => p.card.suit === trumpSuit);
  const pool = trumpPlays.length ? trumpPlays : trick.filter((p) => p.card.suit === leadSuit);
  let best = pool[0];
  for (const p of pool) {
    if (effectiveRank(p.card, ruleset) > effectiveRank(best.card, ruleset)) best = p;
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
  const winner = resolveTrickWinner(state.currentTrick, state.trumpSuit, state.ruleset);
  const winningPlayer = state.players[winner.seat];
  const value = trickValue(winner.card, state.ruleset);
  winningPlayer.tricksWon += value;
  log(state, `${winningPlayer.name} wins the trick${value === 2 ? ' (counts double!)' : ''}.`);

  const seatOrder = state.players.map((_, i) => i);
  const threshold = tricksToExit(state.playerCount);

  if (winningPlayer.tricksWon >= threshold) {
    const others = state.activePlayers.filter((s) => s !== winner.seat);
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
    finishHand(state);
    return;
  }

  state.leaderSeat = state.activePlayers.includes(winner.seat)
    ? winner.seat
    : nextActiveSeatAfter(seatOrder, state.activePlayers, winner.seat);
}

function finishHand(state) {
  state.dealerSeat = (state.dealerSeat + 1) % state.playerCount;

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
