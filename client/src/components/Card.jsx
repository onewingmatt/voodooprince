const SUIT_COLOR = {
  Red: '#d9435e',
  Blue: '#2f6fed',
  Green: '#28a35c',
  Yellow: '#d6a419',
  Purple: '#8a4fd6',
};

export default function Card({ card, onClick, disabled, trump, small }) {
  const color = SUIT_COLOR[card.suit] ?? '#333';
  return (
    <button
      className={`card${disabled ? ' card--disabled' : ''}${small ? ' card--small' : ''}`}
      style={{ '--suit-color': color }}
      onClick={onClick}
      disabled={disabled}
      title={`${card.rank} of ${card.suit}`}
    >
      <span className="card__rank">{card.rank}</span>
      <span className="card__suit">{card.suit}</span>
      {trump && <span className="card__trump">★</span>}
    </button>
  );
}
