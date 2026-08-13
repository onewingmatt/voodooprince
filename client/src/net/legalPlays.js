// Mirrors server/game/engine.js legalPlays() — client-side only, purely for
// UI hinting. The server is still the source of truth and re-validates.
export function legalPlays(hand, currentTrick, trumpSuit, ruleset) {
  if (currentTrick.length === 0) return hand.slice();

  const leadSuit = currentTrick[0].card.suit;
  const leadSuitCards = hand.filter((c) => c.suit === leadSuit);
  const trumpAlreadyPlayed =
    ruleset === 'marshmallow' && currentTrick.some((p) => p.card.suit === trumpSuit);

  if (trumpAlreadyPlayed) {
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);
    if (leadSuitCards.length || trumpCards.length) {
      const map = new Map();
      [...leadSuitCards, ...trumpCards].forEach((c) => map.set(`${c.suit}-${c.rank}`, c));
      return [...map.values()];
    }
    return hand.slice();
  }

  if (leadSuitCards.length) return leadSuitCards;
  return hand.slice();
}
