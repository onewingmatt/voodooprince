import { useEffect, useMemo, useRef, useState } from 'react';
import Card from '../components/Card.jsx';
import PlayerSeat from '../components/PlayerSeat.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import { ClientAction } from '../net/protocol.js';
import { legalPlays } from '../net/legalPlays.js';
import { sound } from '../net/sound.js';
import { screenShake, confetti } from '../net/particles.js';

const SORT_KEY = 'voodoo-prince-hand-sort';

function sortHand(hand, mode, trumpSuit, suits) {
  const sorted = [...hand];
  if (mode === 'rank') {
    sorted.sort((a, b) => a.rank - b.rank);
    return sorted;
  }
  // 'suit' mode: group by suit (trump suit last, so it stands out on the right), rank ascending within a suit.
  const suitOrder = [...suits].sort((a, b) => {
    if (a === trumpSuit) return 1;
    if (b === trumpSuit) return -1;
    return suits.indexOf(a) - suits.indexOf(b);
  });
  sorted.sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return a.rank - b.rank;
  });
  return sorted;
}

export default function Game({ send, game, error, onLeave }) {
  const you = game.players[game.yourSeat];
  const isYourTurn = game.turnSeat === game.yourSeat;
  const isYourTrumpChoice = game.phase === 'choosing_trump' && game.dealerSeat === game.yourSeat;
  const [sortMode, setSortMode] = useState(() => localStorage.getItem(SORT_KEY) || 'suit');

  function updateSortMode(mode) {
    setSortMode(mode);
    localStorage.setItem(SORT_KEY, mode);
  }

  const sortedHand = useMemo(
    () => sortHand(you.hand ?? [], sortMode, game.trumpSuit, game.suits),
    [you.hand, sortMode, game.trumpSuit, game.suits]
  );

  const playable = useMemo(() => {
    if (!isYourTurn || game.phase !== 'playing') return new Set();
    const legal = legalPlays(you.hand ?? [], game.currentTrick, game.trumpSuit, game.ruleset);
    return new Set(legal.map((c) => `${c.suit}-${c.rank}`));
  }, [isYourTurn, game.phase, you.hand, game.currentTrick, game.trumpSuit, game.ruleset]);

  const SWEEP_MS = 650;
  const [displayTrick, setDisplayTrick] = useState(game.currentTrick);
  const [sweeping, setSweeping] = useState(false);
  const [winnerName, setWinnerName] = useState(null);
  const prevTrickLenRef = useRef(game.currentTrick.length);
  const latestTrickRef = useRef(game.currentTrick);
  const sweepTimeoutRef = useRef(null);

  useEffect(() => {
    latestTrickRef.current = game.currentTrick;
  });

  useEffect(() => {
    const wasFull = prevTrickLenRef.current > 0;
    const nowEmpty = game.currentTrick.length === 0;
    prevTrickLenRef.current = game.currentTrick.length;

    if (wasFull && nowEmpty && !sweeping) {
      setSweeping(true);
      const winLine = [...game.log].reverse().find((l) => l.includes('wins the trick'));
      setWinnerName(winLine ? winLine.split(' wins the trick')[0] : null);
      clearTimeout(sweepTimeoutRef.current);
      sweepTimeoutRef.current = setTimeout(() => {
        setSweeping(false);
        setWinnerName(null);
        setDisplayTrick(latestTrickRef.current);
      }, SWEEP_MS);
    } else if (!sweeping) {
      setDisplayTrick(game.currentTrick);
    }
  }, [game.currentTrick, game.log, sweeping]);

  useEffect(() => () => clearTimeout(sweepTimeoutRef.current), []);

  const prevHandRef = useRef(game.handNumber);
  const [justDealt, setJustDealt] = useState(true);
  useEffect(() => {
    if (prevHandRef.current !== game.handNumber) {
      prevHandRef.current = game.handNumber;
      setJustDealt(true);
      sound.cardDeal();
      const t = setTimeout(() => setJustDealt(false), 900);
      return () => clearTimeout(t);
    }
  }, [game.handNumber]);

  const prevTrumpRef = useRef(game.trumpSuit);
  useEffect(() => {
    if (prevTrumpRef.current !== game.trumpSuit && game.trumpSuit) {
      prevTrumpRef.current = game.trumpSuit;
      sound.trumpChosen();
    }
  }, [game.trumpSuit]);

  const prevTrickLenForSoundRef = useRef(game.currentTrick.length);
  useEffect(() => {
    const wasFull = prevTrickLenForSoundRef.current > 0;
    const nowEmpty = game.currentTrick.length === 0;
    const wasEmpty = prevTrickLenForSoundRef.current === 0;
    const nowFull = game.currentTrick.length > 0;

    if (wasEmpty && nowFull) {
      sound.cardPlay();
    } else if (wasFull && nowEmpty) {
      sound.trickWin();
    }
    prevTrickLenForSoundRef.current = game.currentTrick.length;
  }, [game.currentTrick.length]);

  useEffect(() => {
    if (game.phase === 'game_over') {
      sound.gameOver();
    }
  }, [game.phase]);

  useEffect(() => {
    if (sweeping) {
      screenShake(2, 150);
    }
  }, [sweeping]);

  return (
    <div className="game">
      <div className="game__header">
        <h2>Hand {game.handNumber}</h2>
        <div className="game__meta">
          <span>Ruleset: {game.ruleset === 'full' ? 'Full Voodoo Prince' : 'Marshmallow Test'}</span>
          {game.trumpSuit && <span>Trump: {game.trumpSuit}</span>}
          <button onClick={onLeave}>Leave</button>
        </div>
      </div>

      <div className="seats">
        {game.players.map((p, i) => (
          <PlayerSeat
            key={i}
            player={p}
            isTurn={game.turnSeat === i}
            isDealer={game.dealerSeat === i}
            isLeader={game.leaderSeat === i}
          />
        ))}
      </div>

      <div className="table">
        <div className="table__felt">
          {displayTrick.length === 0 && <p className="muted table__empty">Trick is empty.</p>}
          {displayTrick.map(({ seat, card }, i) => (
            <div
              key={seat}
              className={`table__play${sweeping ? ' table__play--sweep' : ''}`}
              style={{ '--sweep-delay': `${i * 40}ms` }}
            >
              <div className="table__name">{game.players[seat].name}</div>
              <Card
                card={card}
                disabled
                trump={card.suit === game.trumpSuit}
                justPlayed={!sweeping && i === displayTrick.length - 1}
              />
            </div>
          ))}
          {winnerName && <div className="table__winner-banner">{winnerName} wins the trick!</div>}
        </div>
      </div>

      {isYourTrumpChoice && (
        <div className="panel panel--nested">
          <h3>Choose trump</h3>
          <div className="suit-picker">
            {game.suits.map((suit) => (
              <button key={suit} onClick={() => send(ClientAction.CHOOSE_TRUMP, { suit })}>
                {suit}
              </button>
            ))}
          </div>
        </div>
      )}

      {game.phase === 'between_hands' && (
        <p className="banner">Hand complete — starting the next hand shortly...</p>
      )}

      {game.phase === 'game_over' && (
        <div className="panel panel--nested">
          <h3>Game over!</h3>
          <Scoreboard players={game.players} />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="hand">
        <div className="hand__header">
          <h3>
            Your hand {you.name ? `(${you.name})` : ''}
            {isYourTurn && game.phase === 'playing' ? ' — your turn' : ''}
          </h3>
          <div className="sort-toggle">
            <span className="muted">Sort:</span>
            <button
              className={sortMode === 'suit' ? 'active' : ''}
              onClick={() => updateSortMode('suit')}
            >
              By suit
            </button>
            <button
              className={sortMode === 'rank' ? 'active' : ''}
              onClick={() => updateSortMode('rank')}
            >
              By rank
            </button>
          </div>
        </div>
        <div className="hand__cards">
          {sortedHand.map((card, i) => {
            const key = `${card.suit}-${card.rank}`;
            const canPlay = isYourTurn && game.phase === 'playing' && playable.has(key);
            return (
              <div
                key={key}
                className={justDealt ? 'card--deal-wrap' : undefined}
                style={justDealt ? { '--deal-delay': `${i * 35}ms` } : undefined}
              >
                <Card
                  card={card}
                  trump={card.suit === game.trumpSuit}
                  disabled={!canPlay}
                  illegal={isYourTurn && game.phase === 'playing' && !canPlay}
                  onClick={() => send(ClientAction.PLAY_CARD, { card })}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar">
        <Scoreboard players={game.players} />
        <div className="log">
          {game.log.map((line, i) => (
            <div key={i} className="log__line">{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
