export default function PlayerSeat({ player, isTurn, isDealer, isLeader }) {
  return (
    <div className={`seat${isTurn ? ' seat--turn' : ''}${player.exited ? ' seat--exited' : ''}`}>
      <div className="seat__name">
        {player.name}
        {player.isBot ? ' 🤖' : ''}
        {isDealer ? ' (D)' : ''}
      </div>
      <div className="seat__stats">
        <span>Tricks: {player.tricksWon}</span>
        <span>Cards: {player.cardCount}</span>
        <span>Score: {player.score}</span>
      </div>
      {player.exited && <div className="seat__badge">OUT</div>}
      {isLeader && !player.exited && <div className="seat__badge seat__badge--lead">LEAD</div>}
    </div>
  );
}
