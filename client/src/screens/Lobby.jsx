import { useState } from 'react';
import { ClientAction } from '../net/protocol.js';

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt('Copy this code:', code);
    }
  }
  return (
    <span className="code-row">
      <span className="code-chip" aria-label={`Room code ${code}`}>{code}</span>
      <button onClick={copy} aria-label="Copy room code">{copied ? 'Copied' : 'Copy'}</button>
    </span>
  );
}

export default function Lobby({ send, room, error, isHost, onLeave }) {
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('voodoo-prince-name') ?? ''; } catch { return ''; }
  });
  const [joinCode, setJoinCode] = useState('');
  const [maxSeats, setMaxSeats] = useState(4);
  const [ruleset, setRuleset] = useState('full');

  function persistName(v) {
    setName(v);
    try { localStorage.setItem('voodoo-prince-name', v); } catch {}
  }

  if (room) {
    const emptyCount = Math.max(0, room.maxSeats - room.seats.length);
    return (
      <div className="panel">
        <div className="panel__header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                Room <CopyCode code={room.code} />
              </h2>
              <span className="chip">{room.seats.length} / {room.maxSeats} seats</span>
              <span className="chip" style={{ textTransform: 'none', letterSpacing: 0 }}>{room.ruleset === 'full' ? 'Voodoo Prince · 5 hands' : 'Marshmallow · race to 20'}</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>Share the code — players join from the home screen.</p>
          </div>
          <button onClick={onLeave} aria-label="Leave room">Leave</button>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div>
            <h3>Players</h3>
            <ul className="seat-list">
              {room.seats.map((seat, i) => (
                <li key={i}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span className={`seat-list__avatar${i === 0 ? ' seat-list__avatar--host' : ''}`}>{(seat.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {seat.name}{i === 0 ? ' · host' : ''}{seat.isBot ? ' · bot' : ''}{!seat.isBot && !seat.connected ? ' · disconnected' : ''}
                    </span>
                  </span>
                  {isHost && i > 0 && (
                    <button onClick={() => send(ClientAction.REMOVE_SEAT, { seatIndex: i })} aria-label={`Remove ${seat.name}`}>Remove</button>
                  )}
                </li>
              ))}
              {Array.from({ length: emptyCount }).map((_, i) => (
                <li key={`empty-${i}`} className="seat-list__empty">Empty seat</li>
              ))}
            </ul>

            {isHost ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => send(ClientAction.ADD_BOT)} disabled={room.seats.length >= room.maxSeats}>Add bot</button>
                {room.seats.length >= room.maxSeats && <span className="muted">Full — remove a seat to add a bot.</span>}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Host chooses the ruleset and starts when everyone is seated.</p>
            )}
          </div>

          <div>
            <h3>Ruleset {isHost ? '' : <span style={{ fontWeight: 500, color: 'var(--muted)', textTransform: 'none' }}>· host only</span>}</h3>
            <div className="ruleset-toggle" role="radiogroup" aria-label="Ruleset">
              <label>
                <input type="radio" disabled={!isHost} checked={room.ruleset === 'full'} onChange={() => send(ClientAction.SET_RULESET, { ruleset: 'full' })} />
                <span>Full Voodoo Prince<span>0 / 5 / 7 specials · 5 hands</span></span>
              </label>
              <label>
                <input type="radio" disabled={!isHost} checked={room.ruleset === 'marshmallow'} onChange={() => send(ClientAction.SET_RULESET, { ruleset: 'marshmallow' })} />
                <span>Marshmallow Test<span>No specials · race to 20</span></span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--line)' }}>
            {isHost ? (
              <>
                <button className="primary" disabled={room.seats.length < 2} onClick={() => send(ClientAction.START_GAME)} style={{ paddingInline: 24 }}>
                  Start {room.seats.length} player{room.seats.length === 1 ? '' : 's'}
                </button>
                {room.seats.length < 2 && <span className="muted">Need at least 2 players.</span>}
              </>
            ) : (
              <span className="banner" style={{ background: 'var(--panel-soft)', color: 'var(--muted)', border: '1px solid var(--line)', boxShadow: 'none' }}>Waiting for the host…</span>
            )}
          </div>
        </div>

        {error && <p className="error" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="lobby-hero">
        <div className="lobby-hero__title">
          <h1>Voodoo <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Prince</em></h1>
          <p>Know when not to win. A trick-taking duel of dodge-and-cash-in — 2–5 players, five hands, about 30 minutes.</p>
        </div>
        <div className="lobby-hero__name">
          <label>Name<input value={name} onChange={(e) => persistName(e.target.value)} placeholder="Alex" maxLength={24} autoComplete="nickname" /></label>
        </div>
      </div>

      <div className="lobby-actions">
        <div className="panel panel--nested">
          <h3>Create a room</h3>
          <p className="muted">You host. Share the 4-letter code, add bots, deal.</p>
          <label>
            Players
            <select value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))}>
              {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} players</option>)}
            </select>
          </label>
          <label>
            Ruleset
            <select value={ruleset} onChange={(e) => setRuleset(e.target.value)}>
              <option value="full">Voodoo Prince</option>
              <option value="marshmallow">Marshmallow Test</option>
            </select>
          </label>
          <button className="primary" onClick={() => send(ClientAction.CREATE_ROOM, { name: name.trim() || 'Host', maxSeats, ruleset })}>Create room</button>
        </div>

        <div className="panel panel--nested">
          <h3>Join a room</h3>
          <p className="muted">Got a code from the host? Enter it below.</p>
          <label>
            Room code
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))} maxLength={4} placeholder="ABCD" style={{ textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, fontFamily: 'var(--font-mono)' }} autoComplete="off" inputMode="text" />
          </label>
          <button className="primary" onClick={() => send(ClientAction.JOIN_ROOM, { code: joinCode.trim(), name: name.trim() || 'Player' })} disabled={joinCode.trim().length !== 4}>Join room</button>
        </div>
      </div>

      {error && <p className="error" style={{ marginTop: 14 }}>{error}</p>}
    </>
  );
}