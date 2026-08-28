# Voodoo Prince — RULES-AUDIT

Status: **AUDITED — engine faithful to the official Schmidt Spiele 2017 Voodoo Prince (Reiner Knizia);
59/59 independent rulebook checks PASS.**
Run: `npm run audit` → **59 PASS / 0 FAIL** (rulebook-verbatim replay).
Source: `references/rulebook-extract.md` (fresh extraction from official Schmidt Spiele 2017 PDF
`gesellschaftsspiele.spielen.de/uploads/files/3424/59cc00debe8bc.pdf`, cross-checked card-sized rules,
huzonfirst's VP-vs-Marshmallow-Test notes, Taylor Reiner how-to-play video).

## Real game identity
**Voodoo Prince (2017, Reiner Knizia, Schmidt Spiele)** — "Das trickreiche Voodoospiel von Reiner Knizia
für 2-5 Personen ab 8 Jahren". 86 cards: 80 Voodoo cards (5 suits × 16 ranks 0–15) + 5 trump indicators +
1 overview card. Reimplements Marshmallow Test.

## Engine fidelity (59 checks, all PASS)
- **Setup tables (p.2):** values in play 0–10/0–10/0–12/0–15 for 2/3/4/5p; cards/player 13/13/13/14;
  decks 55/55/65/80; "0 beats" 10/10/12/15. ✅
- **Trick play (p.3):** lead any, follow suit, trump beats, highest trump among multiple trumps wins,
  trick winner leads, off-suit values meaningless without trump. ✅
- **Special cards (p.5):** 0 beats the suit's top in the same trick; trump still beats a non-trump 0;
  5 and 7 count double when won (5-split); a 5/7 present but not winning does NOT split. ✅
- **Exit & scoring (p.4/6):** 4p exits at 3 tricks, 3p at 4, 5p at 3; exiting player scores all others'
  tricks; last player scores only their own; 2p special (7-trick target, both score). ✅
- **Worked examples:** p.3 trump blue-2 beats green 12; p.5a 0 beats 10; p.5b Nina 5-split pushes 2→4
  (exits at threshold 3); p.6 7-trick winner scores opponent tricks 2, opponent scores 5. ✅
- **Game end (p.6):** 5 hands, tie keeps equal scores. ✅
- **Deck bookkeeping (p.2):** exact deck sizes per player count, shuffle identity. ✅

## Divergences
**None.** The two audit failures initially found were bugs in the audit script itself (the engine was
correct): (1) the "highest trump" check asserted `tricksWon === 1` for a Red-5 win, but 5 counts double
so `=== 2` is right; (2) the p.5b example needed Nina seeded at 2 tricks before the 5-split (the rulebook
example assumes prior tricks). Fixed in `scripts/independent-rules-check.ts`; engine untouched.

## Done-gate features (monorepo bar)
| Feature | Status |
|---|---|
| Server-authoritative rules | ✅ (server/game/engine.js, client sends intents) |
| Leave in lobby AND in-game | ✅ (has Leave; see client) |
| Reconnect | ✅ (localStorage + room reconnect) |
| Pan/zoom | N/A (no map/board — card table only) |
| CVD-safe palette + symbols | ✅ (suits have distinct symbols + colors) |
| Legal-move highlight | ✅ (legalPlays highlights) |
| Scoreboard + named log | ✅ |
| How-to-play with REAL rules | ✅ (RULES.md verified + in-app) |
| Working bots | ✅ |
| cache-bust | ⚠️ (Vite hashed assets) |

## Verification
`npm run audit` → 59 PASS / 0 FAIL, exit 0. `npm test` + `npm run test:gameplay` also green (existing
suite). Engine untouched by this audit.
