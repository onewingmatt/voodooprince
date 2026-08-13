import { useEffect } from 'react';
import { useGameSocket } from './net/socket.js';
import Lobby from './screens/Lobby.jsx';
import Game from './screens/Game.jsx';

export default function App() {
  const { connected, room, game, error, clearError, send } = useGameSocket();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  return (
    <div className="app">
      {!connected && <p className="banner">Connecting...</p>}
      {room?.phase === 'in_game' && game ? (
        <Game send={send} game={game} error={error} />
      ) : (
        <Lobby send={send} room={room} error={error} />
      )}
    </div>
  );
}
