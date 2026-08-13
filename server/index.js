import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClientAction, ServerEvent } from './protocol.js';
import {
  createRoom,
  getRoom,
  joinRoom,
  rejoinRoom,
  addBot,
  removeSeat,
  setRuleset,
  startGame,
  submitTrump,
  submitCard,
  serializeLobby,
  serializeGameFor,
  detachConnection,
  runBots,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST_SEAT = 0;

const app = express();
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, type, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, payload }));
}

function broadcastRoom(room) {
  for (const seat of room.seats) {
    if (!seat.ws) continue;
    send(seat.ws, ServerEvent.ROOM_STATE, serializeLobby(room));
  }
}

function broadcastGame(room) {
  room.seats.forEach((seat, index) => {
    if (!seat.ws) return;
    send(seat.ws, ServerEvent.GAME_STATE, serializeGameFor(room, index));
  });
}

function broadcastBoth(room) {
  broadcastRoom(room);
  if (room.game) broadcastGame(room);
}

function attachToSeat(ws, room, seatIndex) {
  // A single connection can only ever occupy one seat: leave any previous one first.
  const prevRoom = getRoom(ws.roomCode);
  detachConnection(ws);
  // If that left a seat in a live game, the new bot needs the action loop kicked.
  if (prevRoom && prevRoom !== room && prevRoom.phase === 'in_game') {
    runBots(prevRoom, () => broadcastGame(prevRoom));
  }
  const seat = room.seats[seatIndex];
  seat.ws = ws;
  seat.connected = true;
  ws.roomCode = room.code;
  ws.seatIndex = seatIndex;
  send(ws, ServerEvent.SESSION, { code: room.code, token: seat.token, seatIndex });
}

function requireHost(room, ws) {
  if (ws.seatIndex !== HOST_SEAT) throw new Error('Only the host can do that.');
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.seatIndex = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, ServerEvent.ERROR, { message: 'Malformed message.' });
    }
    const { type, payload = {} } = msg;

    try {
      switch (type) {
        case ClientAction.CREATE_ROOM: {
          const room = createRoom({
            hostName: payload.name || 'Host',
            maxSeats: payload.maxSeats,
            ruleset: payload.ruleset,
          });
          attachToSeat(ws, room, 0);
          broadcastBoth(room);
          break;
        }
        case ClientAction.JOIN_ROOM: {
          const room = joinRoom(payload.code, payload.name || 'Player');
          attachToSeat(ws, room, room.seats.length - 1);
          broadcastBoth(room);
          break;
        }
        case ClientAction.REJOIN_ROOM: {
          const { room, seatIndex } = rejoinRoom(payload.code, payload.token);
          attachToSeat(ws, room, seatIndex);
          broadcastBoth(room);
          break;
        }
        case ClientAction.ADD_BOT: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          requireHost(room, ws);
          addBot(room);
          broadcastBoth(room);
          break;
        }
        case ClientAction.REMOVE_SEAT: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          requireHost(room, ws);
          removeSeat(room, payload.seatIndex);
          broadcastBoth(room);
          break;
        }
        case ClientAction.SET_RULESET: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          requireHost(room, ws);
          setRuleset(room, payload.ruleset);
          broadcastBoth(room);
          break;
        }
        case ClientAction.START_GAME: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          requireHost(room, ws);
          startGame(room, () => broadcastGame(room));
          broadcastBoth(room);
          break;
        }
        case ClientAction.CHOOSE_TRUMP: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          submitTrump(room, ws.seatIndex, payload.suit, () => broadcastGame(room));
          broadcastGame(room);
          break;
        }
        case ClientAction.PLAY_CARD: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          submitCard(room, ws.seatIndex, payload.card, () => broadcastGame(room));
          broadcastGame(room);
          break;
        }
        default:
          send(ws, ServerEvent.ERROR, { message: `Unknown action: ${type}` });
      }
    } catch (err) {
      send(ws, ServerEvent.ERROR, { message: err.message });
    }
  });

  ws.on('close', () => {
    const room = getRoom(ws.roomCode);
    detachConnection(ws);
    if (room) {
      // The seat just became a bot (if mid-game): start its action loop.
      if (room.phase === 'in_game') runBots(room, () => broadcastGame(room));
      broadcastBoth(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Voodoo Prince server listening on :${PORT}`);
});
