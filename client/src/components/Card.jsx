const SUIT_COLOR = {
  Red: '#b23a2e',
  Blue: '#2760c4',
  Green: '#1e7a53',
  Yellow: '#a97f2f',
  Purple: '#7a4397',
};

const SUIT_ICON = {
  Red: '♦',
  Blue: '♣',
  Green: '♠',
  Yellow: '☀',
  Purple: '♥',
};

export default function Card({ card, onClick, disabled, trump, small, illegal, justPlayed, playable }) {
  const color = SUIT_COLOR[card.suit] ?? '#211e1a';
  const icon = SUIT_ICON[card.suit] ?? '●';
  const isSpecial = card.rank === 0 || card.rank === 5 || card.rank === 7;
  let specialLabel = null;
  let specialTitle = null;

  if (card.rank === 0) {
    specialLabel = 'VOODOO';
    specialTitle = 'Voodoo — beats the top card of its suit when both are played';
  } else if (card.rank === 5 || card.rank === 7) {
    specialLabel = '×2';
    specialTitle = 'Counts as two tricks';
  }

  let title = `${card.rank} of ${card.suit}`;
  if (specialTitle) title += ` — ${specialTitle}`;
  if (illegal) title += ' (not legal — must follow suit)';
  if (trump) title += ' — trump';

  const classes = [
    'card',
    disabled ? 'card--disabled' : '',
    small ? 'card--small' : '',
    illegal ? 'card--illegal' : '',
    playable ? 'card--playable' : '',
    justPlayed ? 'card--played' : '',
    isSpecial ? 'card--special' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      style={{ '--suit-color': color }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <span className="card__corner card__corner--tl">{card.rank}</span>
      <span className="card__icon" aria-hidden="true">{icon}</span>
      <span className="card__corner card__corner--br">{card.rank}</span>
      {trump && <span className="card__trump" aria-hidden="true">★</span>}
      {specialLabel && <span className="card__special-symbol">{specialLabel}</span>}
    </button>
  );
}