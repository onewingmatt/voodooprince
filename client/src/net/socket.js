import { useEffect, useRef, useState, useCallback } from 'react';
import { ServerEvent } from './protocol.js';

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export function useGameSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let socket;

    function connect() {
      socket = new WebSocket(wsUrl());
      wsRef.current = socket;
      socket.addEventListener('open', () => !cancelled && setConnected(true));
      socket.addEventListener('close', () => {
        if (cancelled) return;
        setConnected(false);
        setTimeout(connect, 1500);
      });
      socket.addEventListener('message', (event) => {
        if (cancelled) return;
        const { type, payload } = JSON.parse(event.data);
        if (type === ServerEvent.ROOM_STATE) setRoom(payload);
        else if (type === ServerEvent.GAME_STATE) setGame(payload);
        else if (type === ServerEvent.ERROR) setError(payload.message);
      });
    }
    connect();

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  const send = useCallback((type, payload = {}) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { connected, room, game, error, clearError: () => setError(null), send };
}
