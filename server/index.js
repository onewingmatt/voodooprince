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
  addBot,
  removeSeat,
  setRuleset,
  startGame,
  submitTrump,
  submitCard,
  serializeLobby,
  serializeGameFor,
  runBots,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

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
          room.seats[0].ws = ws;
          room.seats[0].connected = true;
          ws.roomCode = room.code;
          ws.seatIndex = 0;
          broadcastBoth(room);
          break;
        }
        case ClientAction.JOIN_ROOM: {
          const room = joinRoom(payload.code, payload.name || 'Player');
          const seatIndex = room.seats.length - 1;
          room.seats[seatIndex].ws = ws;
          room.seats[seatIndex].connected = true;
          ws.roomCode = room.code;
          ws.seatIndex = seatIndex;
          broadcastBoth(room);
          break;
        }
        case ClientAction.ADD_BOT: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          addBot(room);
          broadcastBoth(room);
          break;
        }
        case ClientAction.REMOVE_SEAT: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          removeSeat(room, payload.seatIndex);
          broadcastBoth(room);
          break;
        }
        case ClientAction.SET_RULESET: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
          setRuleset(room, payload.ruleset);
          broadcastBoth(room);
          break;
        }
        case ClientAction.START_GAME: {
          const room = getRoom(ws.roomCode);
          if (!room) throw new Error('Not in a room.');
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
    if (!room) return;
    const seat = room.seats[ws.seatIndex];
    if (!seat) return;
    seat.ws = null;
    seat.connected = false;
    if (room.phase === 'in_game') {
      // Keep the game moving: a disconnected human seat plays like a bot would.
      seat.isBot = true;
      runBots(room, () => broadcastGame(room));
    }
    broadcastBoth(room);
  });
});

server.listen(PORT, () => {
  console.log(`Voodoo Prince server listening on :${PORT}`);
});
