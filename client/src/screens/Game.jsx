import { useEffect, useMemo, useRef, useState } from 'react';
import Card from '../components/Card.jsx';
import PlayerSeat from '../components/PlayerSeat.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import { ClientAction } from '../net/protocol.js';
import { legalPlays } from '../net/legalPlays.js';
import { sound } from '../net/sound.js';
import { screenShake } from '../net/particles.js';
import { loadSettings, saveSettings } from '../net/settings.js';

const SORT_KEY = 'voodoo-prince-hand-sort';
const HANDS_PER_GAME = 5;

const SUIT_META = {
  Red: { icon: '♦', color: '#b23a2e' },
  Blue: { icon: '♣', color: '#2760c4' },
  Green: { icon: '♠', color: '#1e7a53' },
  Yellow: { icon: '☀', color: '#a97f2f' },
  Purple: { icon: '♥', color: '#7a4397' },
};

function sortHand(hand, mode, trumpSuit, suits) {
  const sorted = [...hand];
  if (mode === 'rank') {
    sorted.sort((a, b) => a.rank - b.rank);
    return sorted;
  }
  const suitOrder = [...suits].sort((a, b) => {
    if (a === trumpSuit) return 1;
    if (b === trumpSuit) return -1;
    return suits.indexOf(a) - suits.indexOf(b);
  });
  sorted.sort((a, b) => {
    const d = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (d !== 0) return d;
    return a.rank - b.rank;
  });
  return sorted;
}

function groupBySuit(sortedHand, trumpSuit, suits) {
  if (!sortedHand.length) return [];
  const suitOrder = [...suits].sort((a, b) => {
    if (a === trumpSuit) return 1;
    if (b === trumpSuit) return -1;
    return suits.indexOf(a) - suits.indexOf(b);
  });
  const buckets = new Map(suitOrder.map((s) => [s, []]));
  for (const c of sortedHand) {
    if (!buckets.has(c.suit)) buckets.set(c.suit, []);
    buckets.get(c.suit).push(c);
  }
  return [...buckets.entries()].filter(([, arr]) => arr.length > 0);
}

function exitThresholdFor(playerCount, ruleset) {
  if (ruleset === 'marshmallow') {
    const m = { 2: 6, 3: 4, 4: 3, 5: 3 };
    return m[playerCount] ?? 3;
  }
  const v = { 3: 4, 4: 3, 5: 3 };
  return v[playerCount] ?? null; // 2p full: no exits, first to 7
}

function actionNote(game, isYourTurn, isYourTrumpChoice, leadSuit, turnName) {
  if (game.phase === 'choosing_trump') {
    return isYourTrumpChoice ? { text: 'Your call', strong: 'choose trump' } : { text: 'Waiting', strong: `${game.players[game.dealerSeat]?.name ?? 'dealer'} chooses` };
  }
  if (game.phase === 'playing') {
    if (isYourTurn) {
      return leadSuit
        ? { text: 'Your turn', strong: `follow ${leadSuit}`, you: true }
        : { text: 'Your turn', strong: 'lead any card', you: true };
    }
    return { text: 'Waiting', strong: turnName ? `on ${turnName}` : '…' };
  }
  if (game.phase === 'between_hands') return { text: 'Hand done', strong: 'next deal soon' };
  return { text: 'Game over', strong: 'see standings' };
}

export default function Game({ send, game, error, onLeave }) {
  const you = game.players[game.yourSeat];
  const isYourTurn = game.turnSeat === game.yourSeat;
  const isYourTrumpChoice = game.phase === 'choosing_trump' && game.dealerSeat === game.yourSeat;
  const [sortMode, setSortMode] = useState(() => localStorage.getItem(SORT_KEY) || 'suit');
  const [settings, setSettings] = useState(() => loadSettings());
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2200);
  }

  function toggleSound() {
    const next = { ...settings, soundEnabled: !settings.soundEnabled };
    setSettings(next); saveSettings(next);
  }
  function toggleEffects() {
    const next = { ...settings, effectsEnabled: !settings.effectsEnabled };
    setSettings(next); saveSettings(next);
  }
  function updateSortMode(mode) {
    setSortMode(mode);
    localStorage.setItem(SORT_KEY, mode);
  }

  const sortedHand = useMemo(
    () => sortHand(you.hand ?? [], sortMode, game.trumpSuit, game.suits),
    [you.hand, sortMode, game.trumpSuit, game.suits]
  );

  const groupedHand = useMemo(() => {
    if (sortMode === 'rank' || !sortedHand.length) return null;
    return groupBySuit(sortedHand, game.trumpSuit, game.suits);
  }, [sortedHand, sortMode, game.trumpSuit, game.suits]);

  const playable = useMemo(() => {
    if (!isYourTurn || game.phase !== 'playing') return new Set();
    const legal = legalPlays(you.hand ?? [], game.currentTrick, game.trumpSuit, game.ruleset);
    return new Set(legal.map((c) => `${c.suit}-${c.rank}`));
  }, [isYourTurn, game.phase, you.hand, game.currentTrick, game.trumpSuit, game.ruleset]);

  const playerCount = game.players.length;
  const threshold = exitThresholdFor(playerCount, game.ruleset);
  const leadSuit = game.currentTrick[0]?.card.suit ?? null;
  const turnName = game.turnSeat != null ? (game.players[game.turnSeat]?.name ?? '—') : null;

  // Trick sweep
  const SWEEP_MS = 650;
  const [displayTrick, setDisplayTrick] = useState(game.currentTrick);
  const [sweeping, setSweeping] = useState(false);
  const [winnerName, setWinnerName] = useState(null);
  const prevTrickLenRef = useRef(game.currentTrick.length);
  const latestTrickRef = useRef(game.currentTrick);
  const sweepTimeoutRef = useRef(null);
  useEffect(() => { latestTrickRef.current = game.currentTrick; });
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

  const logEndRef = useRef(null);
  useEffect(() => {
    const log = logEndRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [game.log]);

  const prevHandRef = useRef(game.handNumber);
  const [justDealt, setJustDealt] = useState(true);
  useEffect(() => {
    if (prevHandRef.current !== game.handNumber) {
      prevHandRef.current = game.handNumber;
      setJustDealt(true);
      if (settings.soundEnabled) sound.cardDeal();
      const t = setTimeout(() => setJustDealt(false), 900);
      return () => clearTimeout(t);
    }
  }, [game.handNumber, settings.soundEnabled]);

  const prevTrumpRef = useRef(game.trumpSuit);
  useEffect(() => {
    if (prevTrumpRef.current !== game.trumpSuit && game.trumpSuit) {
      prevTrumpRef.current = game.trumpSuit;
      if (settings.soundEnabled) sound.trumpChosen();
    }
  }, [game.trumpSuit, settings.soundEnabled]);

  const prevTrickLenForSoundRef = useRef(game.currentTrick.length);
  useEffect(() => {
    const wasFull = prevTrickLenForSoundRef.current > 0;
    const nowEmpty = game.currentTrick.length === 0;
    const wasEmpty = prevTrickLenForSoundRef.current === 0;
    const nowFull = game.currentTrick.length > 0;
    if (wasEmpty && nowFull && settings.soundEnabled) sound.cardPlay();
    else if (wasFull && nowEmpty && settings.soundEnabled) sound.trickWin();
    prevTrickLenForSoundRef.current = game.currentTrick.length;
  }, [game.currentTrick.length, settings.soundEnabled]);

  useEffect(() => {
    if (game.phase === 'game_over' && settings.soundEnabled) sound.gameOver();
  }, [game.phase, settings.soundEnabled]);
  useEffect(() => { if (sweeping && settings.effectsEnabled) screenShake(2, 150); }, [sweeping, settings.effectsEnabled]);
  useEffect(() => { if (error) showToast(error); }, [error]);

  const handsDots = Array.from({ length: HANDS_PER_GAME }, (_, i) => i + 1);
  const canPlayCount = playable.size;
  const mustFollow = isYourTurn && game.phase === 'playing' && canPlayCount > 0 && canPlayCount < (you.hand?.length ?? 0);
  const note = actionNote(game, isYourTurn, isYourTrumpChoice, leadSuit, turnName);

  const renderCard = (card, i) => {
    const key = `${card.suit}-${card.rank}`;
    const canPlay = isYourTurn && game.phase === 'playing' && playable.has(key);
    const blocked = isYourTurn && game.phase === 'playing' && !canPlay && playable.size > 0;
    return (
      <div key={key} className={`fan-card${justDealt ? ' card--deal-wrap' : ''}`} style={justDealt ? { '--deal-delay': `${i * 26}ms` } : undefined}>
        <Card
          card={card}
          trump={card.suit === game.trumpSuit}
          disabled={!canPlay}
          illegal={blocked}
          playable={canPlay}
          onClick={() => canPlay && send(ClientAction.PLAY_CARD, { card })}
        />
      </div>
    );
  };

  return (
    <div className="game">
      <div className="game__main">
      <div className="statusbar">
        <div className="statusbar__left">
          <div className="hand-progress" aria-label={`Hand ${game.handNumber} of ${HANDS_PER_GAME}`}>
            <span className="hand-progress__label">Hand</span>
            <div className="hand-dots">
              {handsDots.map((n) => (
                <span key={n} className={`hand-dot${n === game.handNumber ? ' hand-dot--active' : n < game.handNumber ? ' hand-dot--past' : ''}`}>{n}</span>
              ))}
            </div>
          </div>
          <span className="chip">{game.ruleset === 'full' ? 'Voodoo Prince' : 'Marshmallow'}</span>
          {game.trumpSuit ? (
            <span className="chip chip--trump"><span aria-hidden="true">{SUIT_META[game.trumpSuit]?.icon ?? '★'}</span> Trump {game.trumpSuit}</span>
          ) : (
            <span className="chip" style={{ opacity: 0.8 }}>Trump —</span>
          )}
          {threshold && <span className="chip chip--gold">Exit {threshold} tricks</span>}
          {isTwoPlayer(game) && <span className="chip chip--gold">First to 7</span>}
        </div>
        <div className="statusbar__right">
          <span className={`action-note${isYourTurn ? ' action-note--you' : ''}`}>{note.text} <strong>{note.strong}</strong></span>
          <button className={`icon-btn${settings.soundEnabled ? ' icon-btn--active' : ''}`} onClick={toggleSound} title={settings.soundEnabled ? 'Mute sound' : 'Unmute sound'} aria-label="Toggle sound">{settings.soundEnabled ? '🔊' : '🔇'}</button>
          <button className={`icon-btn${settings.effectsEnabled ? ' icon-btn--active' : ''}`} onClick={toggleEffects} title={settings.effectsEnabled ? 'Disable effects' : 'Enable effects'} aria-label="Toggle effects">{settings.effectsEnabled ? '✦' : '○'}</button>
          <button onClick={onLeave}>Leave</button>
        </div>
      </div>

      <div className="seats">
        {game.players.map((p, i) => (
          <PlayerSeat key={i} player={p} isTurn={game.turnSeat === i} isDealer={game.dealerSeat === i} isLeader={game.leaderSeat === i} exitThreshold={threshold} order={i + 1} />
        ))}
      </div>

      <div className="table">
        <div className="table__felt">
          {displayTrick.length === 0 ? (
            <p className="table__empty">
              {game.phase === 'choosing_trump'
                ? (isYourTrumpChoice ? 'Pick a suit to make trump.' : 'Trump being chosen…')
                : game.phase === 'between_hands'
                  ? 'Scoring the hand…'
                  : game.phase === 'game_over'
                    ? 'Final scores below.'
                    : `${game.players[game.leaderSeat]?.name ?? 'Leader'} leads next.`}
            </p>
          ) : (
            displayTrick.map(({ seat, card }, i) => (
              <div key={seat} className={`table__play${sweeping ? ' table__play--sweep' : ''}`} style={{ '--sweep-delay': `${i * 45}ms` }}>
                <div className="table__name">{game.players[seat].name}</div>
                <Card card={card} disabled trump={card.suit === game.trumpSuit} justPlayed={!sweeping && i === displayTrick.length - 1} />
              </div>
            ))
          )}
          {winnerName && <div className="table__winner-banner">{winnerName} wins the trick</div>}
        </div>
      </div>

      {game.phase === 'choosing_trump' && isYourTrumpChoice && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose trump suit">
          <div className="modal">
            <h2>Choose trump</h2>
            <p className="modal__sub">Trump cards win any trick they appear in. Pick the suit that best fits your hand.</p>
            <div className="suit-grid">
              {game.suits.map((suit) => {
                const m = SUIT_META[suit] ?? { icon: '●', color: '#211e1a' };
                return (
                  <button key={suit} className="suit-card" onClick={() => send(ClientAction.CHOOSE_TRUMP, { suit })}>
                    <div className="suit-card__icon" style={{ color: m.color }} aria-hidden="true">{m.icon}</div>
                    <div className="suit-card__name">{suit}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {game.phase === 'between_hands' && (
        <div className="panel" style={{ gridColumn: '1 / 2' }}>
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Hand {game.handNumber} done</h2>
          <p className="muted" style={{ margin: '0 0 16px' }}>
            Hand {Math.min(game.handNumber + 1, HANDS_PER_GAME)} of {HANDS_PER_GAME} · {game.players[game.dealerSeat]?.name ?? 'dealer'} deals next
          </p>
          <Scoreboard players={game.players} title="Running total" />
        </div>
      )}

      {game.phase === 'game_over' && (
        <div className="panel" style={{ gridColumn: '1 / 2' }}>
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Game over</h2>
          <p className="muted" style={{ margin: '0 0 16px' }}>
            {(() => {
              const w = [...game.players].reduce((a, b) => (b.score > a.score ? b : a));
              return `${w.name} wins with ${w.score} points.`;
            })()}
          </p>
          <Scoreboard players={game.players} title="Final standings" />
        </div>
      )}

      <div className="hand">
        <div className="hand__header">
          <div className="hand__title">
            <span>Your hand</span>
            <span className="hand__count">{you.name ? `· ${you.name}` : ''} · {you.hand?.length ?? 0} cards</span>
            {you.exited && <span className="hand__tag">out</span>}
          </div>
          <div className="sort-toggle" role="group" aria-label="Sort hand">
            <button className={sortMode === 'suit' ? 'active' : ''} onClick={() => updateSortMode('suit')} aria-pressed={sortMode === 'suit'}>Suit</button>
            <button className={sortMode === 'rank' ? 'active' : ''} onClick={() => updateSortMode('rank')} aria-pressed={sortMode === 'rank'}>Rank</button>
          </div>
        </div>

        {sortedHand.length === 0 ? (
          <p className="muted" style={{ fontStyle: 'italic', margin: '10px 0 8px' }}>{you.exited ? 'Out — watching the end of the hand.' : 'No cards.'}</p>
        ) : groupedHand ? (
          <div className="hand__fan">
            {groupedHand.map(([suit, cards]) => {
              const isTrumpGroup = suit === game.trumpSuit;
              const m = SUIT_META[suit] ?? { icon: '●', color: 'var(--muted)' };
              return (
                <div key={suit} className="hand__group">
                  <div className={`hand__group-label${isTrumpGroup ? ' hand__group-label--trump' : ''}`}>
                    <span aria-hidden="true" style={{ color: m.color }}>{m.icon}</span> {suit}{isTrumpGroup ? ' · trump' : ''}
                  </div>
                  {cards.map((card, j) => renderCard(card, j))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hand__fan">
            {sortedHand.map((card, i) => renderCard(card, i))}
          </div>
        )}

        <div className="hand__hint">
          {game.phase === 'playing' && !isYourTurn && <span>Waiting · {turnName}</span>}
          {mustFollow && <span><strong>Follow {leadSuit}</strong> · dashed cards are not legal</span>}
          {isYourTurn && game.phase === 'playing' && !mustFollow && canPlayCount === sortedHand.length && <span>You lead — any card</span>}
          {isYourTurn && game.phase === 'playing' && !mustFollow && canPlayCount > 0 && canPlayCount < sortedHand.length && <span>Rimmed cards are legal</span>}
          {game.ruleset === 'full' && <span className="chip" style={{ fontSize: 10.5, padding: '3px 9px' }}>VOODOO · ×2</span>}
        </div>
      </div>

      </div>{/* /game__main */}

      <div className="sidebar">
        <Scoreboard players={game.players} />
        <div className="log" role="log" aria-live="polite" aria-label="Game log" ref={logEndRef}>
          {game.log.length === 0 && <div className="muted" style={{ fontStyle: 'italic' }}>No tricks yet.</div>}
          {game.log.map((line, i) => <div key={i} className={`log__line${i === game.log.length - 1 ? ' log__line--last' : ''}`}>{line}</div>)}
        </div>
      </div>

      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  );
}

function isTwoPlayer(game) {
  return game.ruleset !== 'marshmallow' && game.players.length === 2;
}