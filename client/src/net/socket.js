import { useEffect, useRef, useState, useCallback } from 'react';
import { ServerEvent, ClientAction } from './protocol.js';

const SESSION_KEY = 'voodoo-prince-session';

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useGameSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState(loadSession);
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let socket;

    function connect() {
      socket = new WebSocket(wsUrl());
      wsRef.current = socket;
      socket.addEventListener('open', () => {
        if (cancelled) return;
        setConnected(true);
        const existing = loadSession();
        if (existing) {
          socket.send(JSON.stringify({ type: ClientAction.REJOIN_ROOM, payload: existing }));
        }
      });
      socket.addEventListener('close', () => {
        if (cancelled) return;
        setConnected(false);
        setTimeout(connect, 1500);
      });
      socket.addEventListener('message', (event) => {
        if (cancelled) return;
        const { type, payload } = JSON.parse(event.data);
        if (type === ServerEvent.SESSION) {
          const next = { code: payload.code, token: payload.token, seatIndex: payload.seatIndex };
          saveSession(next);
          setSession(next);
        } else if (type === ServerEvent.ROOM_STATE) {
          setRoom(payload);
        } else if (type === ServerEvent.GAME_STATE) {
          setGame(payload);
        } else if (type === ServerEvent.ERROR) {
          setError(payload.message);
        }
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

  const leaveRoom = useCallback(() => {
    clearSession();
    setSession(null);
    setRoom(null);
    setGame(null);
    wsRef.current?.close();
  }, []);

  return {
    connected,
    session,
    room,
    game,
    error,
    clearError: () => setError(null),
    send,
    leaveRoom,
  };
}
