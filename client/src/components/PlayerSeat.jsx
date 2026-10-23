export default function PlayerSeat({ player, isTurn, isDealer, isLeader, exitThreshold, order }) {
  const initial = (player.name || '?').trim().charAt(0).toUpperCase() || '?';
  const threshold = exitThreshold ?? null;
  const progress = threshold ? Math.min(1, (player.tricksWon || 0) / threshold) : 0;
  const nearExit = threshold && !player.exited && player.tricksWon >= threshold - 1;

  let dot = null;
  if (player.exited) dot = 'seat__dot--out';
  else if (isLeader) dot = 'seat__dot--lead';
  else if (isTurn) dot = 'seat__dot--turn';
  else if (player.humanDisconnected) dot = 'seat__dot--disconnected';

  return (
    <div className={`seat${isTurn && !player.exited ? ' seat--turn' : ''}${player.exited ? ' seat--exited' : ''}`}>
      <div className="seat__top">
        <div className="seat__order" aria-hidden="true">{order}</div>
        <div className="seat__avatar" aria-hidden="true">{initial}</div>
        <div className="seat__body">
          <div className="seat__name">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</span>
            {dot && <span className={`seat__dot ${dot}`} aria-hidden="true" />}
          </div>
          <div className="seat__stats">
            <span><b>{player.tricksWon}</b> tricks</span>
            <span><b>{player.cardCount}</b> cards</span>
            {player.isBot && <span className="seat__tag">bot</span>}
            {isDealer && <span className="seat__tag">deal</span>}
          </div>
        </div>
      </div>
      <div className="seat__score" title="Total score">{player.score}</div>
      {threshold && !player.exited && (
        <div className={`seat__progress${nearExit ? ' seat__progress--danger' : ''}`} aria-hidden="true">
          <div className="seat__progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}