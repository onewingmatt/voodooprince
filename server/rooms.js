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
const ABANDONED_ROOM_CLEANUP_MS = 10 * 60 * 1000;

const rooms = new Map();

function randomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function randomToken() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

const BOT_NAMES = [
  'Ace Alice', 'Bluff Bob', 'Crafty Carol', 'Daring Dan', 'Eager Eddie',
  'Fearless Fiona', 'Gambit Gary', 'Hustler Hank', 'Icy Iris', 'Joker Jake',
  'Keen Kara', 'Lucky Luke', 'Mighty Mina', 'Nimble Nate', 'Outlaw Olivia',
  'Poker Pete', 'Quick Quinn', 'Reckless Roxy', 'Sharp Stella', 'Tricky Tom',
  'Uncanny Uma', 'Vicious Vic', 'Wild Willa', 'Sly Xavier', 'Youthful Yara',
  'Zealous Zoe', 'Bold Bella', 'Clever Chloe', 'Deft Dmitri', 'Elusive Elias',
];

function botName(room) {
  // Never reuse a name already taken in this room (bots or humans): unique
  // names keep the UI and the game log unambiguous.
  const used = new Set(room.seats.map((s) => s.name));
  const available = BOT_NAMES.filter((n) => !used.has(n));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  // Extremely defensive fallback (needs >30 names in one room to trigger).
  let i = 1;
  let name;
  do {
    name = `Bot ${i++}`;
  } while (used.has(name));
  return name;
}

function newSeat(name, isBot) {
  return {
    token: isBot ? null : randomToken(),
    name,
    isBot,
    ws: null,
    connected: isBot,
    humanDisconnected: false,
  };
}

function cancelCleanup(room) {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

function scheduleCleanup(room, delayMs) {
  cancelCleanup(room);
  room.cleanupTimer = setTimeout(() => {
    rooms.delete(room.code);
  }, delayMs);
}

// Called whenever a room's connection/phase state changes, to keep an
// abandoned room (no connected humans) from lingering in memory forever.
function reviewLifecycle(room) {
  const anyHumanConnected = room.seats.some((s) => !s.isBot && s.connected);
  if (anyHumanConnected) {
    cancelCleanup(room);
    return;
  }
  if (room.phase === 'lobby') {
    rooms.delete(room.code);
    return;
  }
  scheduleCleanup(room, ABANDONED_ROOM_CLEANUP_MS);
}

export function createRoom({ hostName, maxSeats = 4, ruleset = 'full' }) {
  const code = randomCode();
  const room = {
    code,
    ruleset,
    maxSeats: Math.min(Math.max(maxSeats, MIN_SEATS), MAX_SEATS),
    seats: [newSeat(hostName, false)],
    phase: 'lobby',
    game: null,
    cleanupTimer: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase());
}

export function roomCount() {
  return rooms.size;
}

export function joinRoom(code, name) {
  const room = getRoom(code);
  if (!room) throw new Error('Room not found.');
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (room.seats.length >= room.maxSeats) throw new Error('Room is full.');
  room.seats.push(newSeat(name, false));
  return room;
}

// Reclaims a seat by its join token, whether the room is still in the lobby
// or mid-game (a disconnected human's seat becomes bot-controlled but keeps
// its token so the original player can retake it).
export function rejoinRoom(code, token) {
  const room = getRoom(code);
  if (!room) throw new Error('Room not found.');
  const seatIndex = room.seats.findIndex((s) => s.token && s.token === token);
  if (seatIndex === -1) throw new Error('That seat is no longer available.');
  const seat = room.seats[seatIndex];
  seat.isBot = false;
  seat.humanDisconnected = false;
  seat.connected = true;
  return { room, seatIndex };
}

export function addBot(room) {
  if (room.phase !== 'lobby') throw new Error('Game already started.');
  if (room.seats.length >= room.maxSeats) throw new Error('Room is full.');
  room.seats.push(newSeat(botName(room), true));
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
    room.seats.map((s) => ({ id: s.token, name: s.name, isBot: s.isBot })),
    room.ruleset
  );
  runBots(room, onBroadcast);
}

export function runBots(room, onBroadcast) {
  const game = room.game;
  if (!game) return;

  if (game.phase === 'game_over') {
    reviewLifecycle(room);
    return;
  }

  if (game.phase === 'choosing_trump' && room.seats[game.dealerSeat]?.isBot) {
    const dealerSeat = game.dealerSeat;
    setTimeout(() => {
      try {
        if (room.game !== game || game.phase !== 'choosing_trump' || game.dealerSeat !== dealerSeat) return;
        if (!room.seats[dealerSeat]?.isBot) return;
        const suit = chooseBotTrump(game, dealerSeat);
        chooseTrump(game, dealerSeat, suit);
        onBroadcast();
        runBots(room, onBroadcast);
      } catch (err) {
        console.error('Bot trump-choice error:', err);
      }
    }, BOT_DELAY_MS);
    return;
  }

  if (game.phase === 'playing') {
    const seat = nextToPlay(game);
    if (room.seats[seat]?.isBot) {
      setTimeout(() => {
        try {
          // Re-validate everything at fire time: a disconnect/rejoin racing
          // this timer may have already advanced the turn or reclaimed the seat.
          if (room.game !== game || game.phase !== 'playing') return;
          if (nextToPlay(game) !== seat) return;
          if (!room.seats[seat]?.isBot) return;
          const card = chooseBotCard(game, seat);
          playCard(game, seat, card);
          onBroadcast();
          runBots(room, onBroadcast);
        } catch (err) {
          console.error('Bot play error:', err);
        }
      }, BOT_DELAY_MS);
      return;
    }
  }

  if (game.phase === 'between_hands') {
    const handNumber = game.handNumber;
    setTimeout(() => {
      try {
        if (room.game !== game || game.phase !== 'between_hands' || game.handNumber !== handNumber) return;
        advanceToNextHand(game);
        onBroadcast();
        runBots(room, onBroadcast);
      } catch (err) {
        console.error('Bot hand-advance error:', err);
      }
    }, BETWEEN_HAND_DELAY_MS);
  }
}

export function submitTrump(room, seatIndex, suit, onBroadcast) {
  if (!room.game) throw new Error("The game hasn't started yet.");
  chooseTrump(room.game, seatIndex, suit);
  runBots(room, onBroadcast);
}

export function submitCard(room, seatIndex, card, onBroadcast) {
  if (!room.game) throw new Error("The game hasn't started yet.");
  playCard(room.game, seatIndex, card);
  runBots(room, onBroadcast);
}

// Detaches a websocket from whatever seat it currently occupies (used both on
// disconnect and before attaching to a different/new room, so one connection
// can never hold two seats at once).
export function detachConnection(ws) {
  const room = getRoom(ws.roomCode);
  if (!room) return;
  const seat = room.seats[ws.seatIndex];
  if (!seat || seat.ws !== ws) return;
  seat.ws = null;
  seat.connected = false;
  if (room.phase === 'in_game' && !seat.isBot) {
    seat.isBot = true;
    seat.humanDisconnected = true;
  }
  ws.roomCode = null;
  ws.seatIndex = null;
  reviewLifecycle(room);
}

export function serializeLobby(room) {
  return {
    code: room.code,
    ruleset: room.ruleset,
    maxSeats: room.maxSeats,
    phase: room.phase,
    seats: room.seats.map((s) => ({
      name: s.name,
      isBot: s.isBot,
      connected: s.connected,
      humanDisconnected: s.humanDisconnected,
    })),
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
      humanDisconnected: room.seats[i]?.humanDisconnected ?? false,
      tricksWon: p.tricksWon,
      exited: p.exited,
      score: p.score,
      cardCount: p.hand.length,
      hand: i === viewerSeat ? p.hand : undefined,
    })),
    yourSeat: viewerSeat,
  };
}
