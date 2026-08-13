const SUIT_COLOR = {
  Red: '#d9435e',
  Blue: '#2f6fed',
  Green: '#28a35c',
  Yellow: '#d6a419',
  Purple: '#8a4fd6',
};

const SUIT_ICON = {
  Red: '♦',
  Blue: '♣',
  Green: '♠',
  Yellow: '☀',
  Purple: '♥',
};

export default function Card({ card, onClick, disabled, trump, small, illegal, justPlayed }) {
  const color = SUIT_COLOR[card.suit] ?? '#333';
  const icon = SUIT_ICON[card.suit] ?? '●';
  const isSpecial = card.rank === 0 || card.rank === 5 || card.rank === 7;
  let specialSymbol = null;
  let specialTitle = null;

  if (card.rank === 0) {
    specialSymbol = '⏬';
    specialTitle = 'beats any card in its suit';
  } else if (card.rank === 5 || card.rank === 7) {
    specialSymbol = '×2';
    specialTitle = 'counts as 2 tricks';
  }

  let title = illegal ? `${card.rank} of ${card.suit} (not legal to play)` : `${card.rank} of ${card.suit}`;
  if (specialTitle) {
    title += ` — ${specialTitle}`;
  }

  return (
    <button
      className={`card${disabled ? ' card--disabled' : ''}${small ? ' card--small' : ''}${illegal ? ' card--illegal' : ''}${justPlayed ? ' card--played' : ''}${isSpecial ? ' card--special' : ''}`}
      style={{ '--suit-color': color }}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <span className="card__corner card__corner--tl">{card.rank}</span>
      <span className="card__icon">{icon}</span>
      <span className="card__corner card__corner--br">{card.rank}</span>
      {trump && <span className="card__trump">★</span>}
      {specialSymbol && <span className="card__special-symbol">{specialSymbol}</span>}
    </button>
  );
}
