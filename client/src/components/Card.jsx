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
  return (
    <button
      className={`card${disabled ? ' card--disabled' : ''}${small ? ' card--small' : ''}${illegal ? ' card--illegal' : ''}${justPlayed ? ' card--played' : ''}`}
      style={{ '--suit-color': color }}
      onClick={onClick}
      disabled={disabled}
      title={illegal ? `${card.rank} of ${card.suit} (not legal to play)` : `${card.rank} of ${card.suit}`}
    >
      <span className="card__corner card__corner--tl">{card.rank}</span>
      <span className="card__icon">{icon}</span>
      <span className="card__corner card__corner--br">{card.rank}</span>
      {trump && <span className="card__trump">★</span>}
    </button>
  );
}
