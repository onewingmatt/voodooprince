export default function Scoreboard({ players, title = 'Standings' }) {
  const maxScore = Math.max(1, ...players.map((p) => p.score));
  const ranked = players.map((p, i) => ({ ...p, seatIndex: i })).sort((a, b) => b.score - a.score);
  return (
    <div className="panel panel--score">
      <h3>{title}</h3>
      <table className="scoreboard">
        <tbody>
          {ranked.map((p, i) => (
            <tr key={p.seatIndex}>
              <td>
                <div className="scoreboard__name">
                  {i === 0 && <span className="dot" aria-hidden="true" />}
                  <span>{p.name}{p.isBot ? ' · bot' : ''}</span>
                </div>
                <div className="scoreboard__bar" aria-hidden="true">
                  <div className="scoreboard__fill" style={{ width: `${(p.score / maxScore) * 100}%` }} />
                </div>
              </td>
              <td className={`scoreboard__pts${i === 0 ? ' scoreboard__pts--lead' : ''}`}>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}