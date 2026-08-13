import {
  createGame,
  chooseTrump,
  playCard,
  nextToPlay,
  advanceToNextHand,
} from './game/engine.js';
import { chooseBotTrump, chooseBotCard } from './game/bot.js';
import { SUITS } from './game/rules.js';

const MAX_SEATS = 5;
const MIN_SEATS = 2;
const BOT_DELAY_MS = 700;
const BETWEEN_HAND_DELAY_MS = 2500;

const rooms = new Map();

function randomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function botName(seatIndex) {
  return `Bot ${seatIndex + 1}`;
}

export function createRoom({ hostName, maxSeats = 4, ruleset = 'full' }) {
  const code = randomCode();
  const room = {
    code,
    ruleset,
    maxSeats: Math.min(Math.max(maxSeats, MIN_SEATS), MAX_SEATS),
    seats: [{ id: null, name: hostName, isBot: false, ws: null, connected: false }],
    phase: 'lobby',
    game: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase());
}

export function joinRoom(code, name) {
  const room = getRoom(code);
  if (!room) throw new Error('Room not found.');
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (room.seats.length >= room.maxSeats) throw new Error('Room is full.');
  room.seats.push({ id: null, name, isBot: false, ws: null, connected: false });
  return room;
}

export function addBot(room) {
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (room.seats.length >= room.maxSeats) throw new Error('Room is full.');
  room.seats.push({ id: null, name: botName(room.seats.length), isBot: true, ws: null, connected: true });
}

export function removeSeat(room, seatIndex) {
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (seatIndex <= 0 || seatIndex >= room.seats.length) throw new Error('Cannot remove that seat.');
  room.seats.splice(seatIndex, 1);
}

export function setRuleset(room, ruleset) {
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (!['full', 'marshmallow'].includes(ruleset)) throw new Error('Invalid ruleset.');
  room.ruleset = ruleset;
}

export function startGame(room, onBroadcast) {
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (room.seats.length < MIN_SEATS) throw new Error('Need at least 2 players.');
  room.phase = 'in_game';
  room.game = createGame(
    room.seats.map((s) => ({ id: s.id, name: s.name, isBot: s.isBot })),
    room.ruleset
  );
  runBots(room, onBroadcast);
}

export function runBots(room, onBroadcast) {
  const game = room.game;
  if (!game) return;

  if (game.phase === 'choosing_trump' && room.seats[game.dealerSeat]?.isBot) {
    setTimeout(() => {
      if (room.game !== game || game.phase !== 'choosing_trump') return;
      const suit = chooseBotTrump(game, game.dealerSeat);
      chooseTrump(game, game.dealerSeat, suit);
      onBroadcast();
      runBots(room, onBroadcast);
    }, BOT_DELAY_MS);
    return;
  }

  if (game.phase === 'playing') {
    const seat = nextToPlay(game);
    if (room.seats[seat]?.isBot) {
      setTimeout(() => {
        if (room.game !== game || game.phase !== 'playing') return;
        const card = chooseBotCard(game, seat);
        playCard(game, seat, card);
        onBroadcast();
        runBots(room, onBroadcast);
      }, BOT_DELAY_MS);
      return;
    }
  }

  if (game.phase === 'between_hands') {
    setTimeout(() => {
      if (room.game !== game || game.phase !== 'between_hands') return;
      advanceToNextHand(game);
      onBroadcast();
      runBots(room, onBroadcast);
    }, BETWEEN_HAND_DELAY_MS);
  }
}

export function submitTrump(room, seatIndex, suit, onBroadcast) {
  chooseTrump(room.game, seatIndex, suit);
  runBots(room, onBroadcast);
}

export function submitCard(room, seatIndex, card, onBroadcast) {
  playCard(room.game, seatIndex, card);
  runBots(room, onBroadcast);
}

export function serializeLobby(room) {
  return {
    code: room.code,
    ruleset: room.ruleset,
    maxSeats: room.maxSeats,
    phase: room.phase,
    seats: room.seats.map((s) => ({ name: s.name, isBot: s.isBot, connected: s.connected })),
  };
}

export function serializeGameFor(room, viewerSeat) {
  const game = room.game;
  if (!game) return null;
  return {
    ruleset: game.ruleset,
    handNumber: game.handNumber,
    phase: game.phase,
    trumpSuit: game.trumpSuit,
    dealerSeat: game.dealerSeat,
    leaderSeat: game.leaderSeat,
    activePlayers: game.activePlayers,
    currentTrick: game.currentTrick,
    turnSeat: game.phase === 'playing' ? nextToPlay(game) : null,
    log: game.log.slice(-30),
    suits: SUITS,
    players: game.players.map((p, i) => ({
      name: p.name,
      isBot: p.isBot,
      tricksWon: p.tricksWon,
      exited: p.exited,
      score: p.score,
      cardCount: p.hand.length,
      hand: i === viewerSeat ? p.hand : undefined,
    })),
    yourSeat: viewerSeat,
  };
}
