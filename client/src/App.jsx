import { useEffect } from 'react';
import { useGameSocket } from './net/socket.js';
import Lobby from './screens/Lobby.jsx';
import Game from './screens/Game.jsx';

export default function App() {
  const { connected, session, room, game, error, clearError, send, leaveRoom } = useGameSocket();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const isHost = session?.seatIndex === 0;

  return (
    <div className="app">
      {!connected && <p className="banner">Connecting...</p>}
      {room?.phase === 'in_game' && game ? (
        <Game send={send} game={game} error={error} onLeave={leaveRoom} />
      ) : (
        <Lobby send={send} room={room} error={error} isHost={isHost} onLeave={leaveRoom} />
      )}
    </div>
  );
}
