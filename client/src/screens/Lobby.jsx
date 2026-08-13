import { useState } from 'react';
import { ClientAction } from '../net/protocol.js';

export default function Lobby({ send, room, error, isHost, onLeave }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [maxSeats, setMaxSeats] = useState(4);
  const [ruleset, setRuleset] = useState('full');

  if (room) {
    return (
      <div className="panel">
        <div className="panel__header">
          <h2>Room {room.code}</h2>
          <button onClick={onLeave}>Leave</button>
        </div>
        <p className="muted">Share this code with other players.</p>

        <div className="ruleset-toggle">
          <label>
            <input
              type="radio"
              disabled={!isHost}
              checked={room.ruleset === 'full'}
              onChange={() => send(ClientAction.SET_RULESET, { ruleset: 'full' })}
            />
            Full Voodoo Prince (0/5/7 specials, 5 hands)
          </label>
          <label>
            <input
              type="radio"
              disabled={!isHost}
              checked={room.ruleset === 'marshmallow'}
              onChange={() => send(ClientAction.SET_RULESET, { ruleset: 'marshmallow' })}
            />
            Marshmallow Test variant (no specials, race to 20)
          </label>
        </div>
        {!isHost && <p className="muted">Only the host can change these settings.</p>}

        <ul className="seat-list">
          {room.seats.map((seat, i) => (
            <li key={i}>
              <span>
                {i === 0 ? '👑 ' : ''}
                {seat.name}
                {seat.isBot ? ' 🤖' : ''}
                {!seat.isBot && !seat.connected ? ' (disconnected)' : ''}
              </span>
              {isHost && i > 0 && (
                <button onClick={() => send(ClientAction.REMOVE_SEAT, { seatIndex: i })}>Remove</button>
              )}
            </li>
          ))}
          {Array.from({ length: room.maxSeats - room.seats.length }).map((_, i) => (
            <li key={`empty-${i}`} className="seat-list__empty">
              empty seat
            </li>
          ))}
        </ul>

        {isHost && room.seats.length < room.maxSeats && (
          <button onClick={() => send(ClientAction.ADD_BOT)}>Add bot</button>
        )}

        {isHost ? (
          <button
            className="primary"
            disabled={room.seats.length < 2}
            onClick={() => send(ClientAction.START_GAME)}
          >
            Start game
          </button>
        ) : (
          <p className="muted">Waiting for the host to start the game...</p>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>Voodoo Prince</h1>
      <p className="muted">An online implementation of Reiner Knizia's trick-taking game.</p>

      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player" />
      </label>

      <div className="lobby-actions">
        <div className="panel panel--nested">
          <h3>Create room</h3>
          <label>
            Seats
            <select value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))}>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Ruleset
            <select value={ruleset} onChange={(e) => setRuleset(e.target.value)}>
              <option value="full">Full Voodoo Prince</option>
              <option value="marshmallow">Marshmallow Test</option>
            </select>
          </label>
          <button
            className="primary"
            onClick={() => send(ClientAction.CREATE_ROOM, { name: name || 'Host', maxSeats, ruleset })}
          >
            Create
          </button>
        </div>

        <div className="panel panel--nested">
          <h3>Join room</h3>
          <label>
            Room code
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="ABCD"
            />
          </label>
          <button
            className="primary"
            onClick={() => send(ClientAction.JOIN_ROOM, { code: joinCode, name: name || 'Player' })}
          >
            Join
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
