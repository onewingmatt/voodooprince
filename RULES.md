# Voodoo Prince — Verified Rules

Source of truth for the engine. Verified 2026-08-16 against:

- The official card-sized rules (BGG filepage 249702, "Voodoo Prince Card Sized Rules")
- Taylor Reiner's rules video (co-designer of the game; "Taylor's Trick-Taking Table", YouTube)
- The Dao of Board Gaming review (detailed rules walkthrough)
- BGG forum threads (80-card deck references, Marshmallow Test differences)

Earlier drafts of this engine were built from secondary summaries and had
several rules wrong — the history of those fixes lives in the commit log.

## Deck

80 cards: 5 suits x 16 ranks (0-15). Cut down by player count:

| Players | Ranks used | Deck size | Cards dealt per player |
|---------|-----------|-----------|------------------------|
| 2-3     | 0-10      | 55        | 13                     |
| 4       | 0-12      | 65        | 13                     |
| 5       | 0-15      | 80        | 14                     |

The rest of the deck is set aside unseen (a blind), not re-dealt.

## Trump

- Hand 1: shuffle the five suit cards, draw one — that suit is trump.
- Hands 2-5: the last-standing player from the previous hand deals, looks at
  their own hand, then chooses the trump suit. They also lead the first trick.

## Play

- Dealer leads hand 1; the winner of each trick leads the next.
- Follow the lead suit if you can; otherwise play anything.
- Highest trump wins the trick; otherwise highest lead-suit card.
- When a player hits their exit threshold they discard their hand and sit out.
  The player to their left leads the next trick.

## Exiting and scoring

| Players | Exit at | 
|---------|---------|
| 2       | (special mode, see below) |
| 3       | 4th trick |
| 4       | 3rd trick |
| 5       | 3rd trick |

- On exit, score 1 point per trick won by ALL other players so far (including
  players who already exited — their trick counts are frozen but still count).
- The last player standing scores their own tricks.
- 5 hands per game; most points wins.

### 2-player special mode

No exit threshold. The hand ends the moment a player reaches 7 tricks
(5/7 splits can push them past). The first to 7 scores 1 point per trick their
opponent won; the opponent scores 1 point per trick they would still need to
reach 7. (Who deals next hand is not spelled out in the rules; this
implementation gives it to the player who did NOT reach 7, mirroring the
multi-player "last standing deals" rule.)

## Special cards

- **5 and 7**: winning a trick with a 5 or 7 splits it — counts as TWO tricks
  for going out and for scoring.
- **0 (voodoo doll)**: normally the weakest card of its suit. If the suit's
  highest card (10 at 2-3p, 12 at 4p, 15 at 5p) is in the SAME trick, the 0
  outranks it. A non-trump 0 still loses to any trump.

## Marshmallow Test variant

Playable as a separate ruleset in this implementation, but its own setup has
NOT been verified against its rulebook yet. Known difference from BGG: the
Marshmallow deck is ranks 1-12 in 5 suits (no 0s). Current implementation
keeps the legacy full-deck/14-card behavior pending that research.
