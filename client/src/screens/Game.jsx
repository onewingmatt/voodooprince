import { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import PlayerSeat from '../components/PlayerSeat.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import { ClientAction } from '../net/protocol.js';

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

export default function Game({ send, game, error }) {
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

  return (
    <div className="game">
      <div className="game__header">
        <h2>Hand {game.handNumber}</h2>
        <div className="game__meta">
          <span>Ruleset: {game.ruleset === 'full' ? 'Full Voodoo Prince' : 'Marshmallow Test'}</span>
          {game.trumpSuit && <span>Trump: {game.trumpSuit}</span>}
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
        {game.currentTrick.length === 0 && <p className="muted">Trick is empty.</p>}
        {game.currentTrick.map(({ seat, card }) => (
          <div key={seat} className="table__play">
            <div className="table__name">{game.players[seat].name}</div>
            <Card card={card} disabled trump={card.suit === game.trumpSuit} />
          </div>
        ))}
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
          {sortedHand.map((card) => (
            <Card
              key={`${card.suit}-${card.rank}`}
              card={card}
              trump={card.suit === game.trumpSuit}
              disabled={!isYourTurn || game.phase !== 'playing'}
              onClick={() => send(ClientAction.PLAY_CARD, { card })}
            />
          ))}
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
