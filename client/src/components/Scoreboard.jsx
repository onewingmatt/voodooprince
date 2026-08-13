export default function Scoreboard({ players }) {
  const ranked = players.map((p, i) => ({ ...p, seatIndex: i })).sort((a, b) => b.score - a.score);
  return (
    <table className="scoreboard">
      <thead>
        <tr>
          <th>Player</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((p) => (
          <tr key={p.seatIndex}>
            <td>{p.name}{p.isBot ? ' 🤖' : ''}</td>
            <td>{p.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
