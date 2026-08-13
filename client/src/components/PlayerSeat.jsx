export default function PlayerSeat({ player, isTurn, isDealer, isLeader }) {
  const initial = (player.name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className={`seat${isTurn ? ' seat--turn' : ''}${player.exited ? ' seat--exited' : ''}`}>
      <div className="seat__avatar">{initial}</div>
      <div className="seat__body">
        <div className="seat__name">
          {player.name}
          {player.humanDisconnected ? ' 📡' : player.isBot ? ' 🤖' : ''}
          {isDealer ? ' (D)' : ''}
        </div>
        <div className="seat__stats">
          <span>Tricks: {player.tricksWon}</span>
          <span>Cards: {player.cardCount}</span>
          <span>Score: {player.score}</span>
          {player.humanDisconnected && <span className="seat__disconnected">Disconnected — bot playing</span>}
        </div>
      </div>
      {player.exited && <div className="seat__badge">OUT</div>}
      {isLeader && !player.exited && <div className="seat__badge seat__badge--lead">LEAD</div>}
    </div>
  );
}
