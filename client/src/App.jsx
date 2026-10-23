import { useEffect, useState } from 'react';
import { useGameSocket } from './net/socket.js';
import Lobby from './screens/Lobby.jsx';
import Game from './screens/Game.jsx';
import { getInitialTheme, applyTheme } from './net/theme.js';

export default function App() {
  const { connected, session, room, game, error, clearError, send, leaveRoom } = useGameSocket();
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      try {
        if (!localStorage.getItem('voodoo-prince-theme')) {
          const next = e.matches ? 'dark' : 'light';
          setTheme(next);
          applyTheme(next);
        }
      } catch {}
    };
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const isHost = session?.seatIndex === 0;
  const inGame = room?.phase === 'in_game' && game;

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  return (
    <>
      <header className="app__topbar">
        <div className="app__topbar-inner">
          <a className="app__brand" href="/" onClick={(e) => { e.preventDefault(); if (inGame) leaveRoom(); }}>
            <span className="app__brand-mark">Voodoo <em>Prince</em></span>
            <span className="app__brand-sub">Online · 2–5 players</span>
          </a>
          <div className="app__actions">
            {!connected && <span className="chip">Connecting…</span>}
            <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle color theme">
              {theme === 'dark' ? '☀' : '◐'}
            </button>
          </div>
        </div>
      </header>
      <div className="app">
        {!inGame ? (
          <Lobby send={send} room={room} error={error} isHost={isHost} onLeave={leaveRoom} />
        ) : (
          <Game send={send} game={game} error={error} onLeave={leaveRoom} />
        )}
      </div>
    </>
  );
}