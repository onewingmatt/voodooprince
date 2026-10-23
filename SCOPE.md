# Voodoo Prince — Implementation Scope

*Game:* **Voodoo Prince** (2017), a push-your-luck trick-taking card game by **Reiner Knizia**,
published by **Schmidt Spiele** (DE, stock #75049). Art: Stephanie Böhm.
*Port:* `voodoo-prince-online` — Node/Express + `ws` server, React/Vite client, no accounts,
room-code multiplayer with bots. Standalone repo at `/home/onewing/voodooprince`.

This document is the live scope record for the port. It supersedes `RULES.md` as the rules
source-of-truth pointer; the verbatim rules extraction lives in `references/rulebook-extract.md`
and the fidelity audit in `RULES-AUDIT.md`.

## Game Summary

- **Players:** 2–5 (best 4–5; BGG community: best with 5). **Age:** 8+. **Play time:** ~20 min.
- **Elevator pitch:** a plain-vanilla follow-suit trick-taker (one trump suit per hand, highest
  trump wins, otherwise highest of the led suit) with a single delicious twist: the *timing of
  your exit*. Each hand, every player aims to reach their exit threshold (N tricks), because on
  exiting you score **1 point per trick every other player has taken so far** — and when the
  last player is left standing they only score their own tricks. Go out too early and you score
  scraps; wait too long and you're last, scoring almost nothing. You want to be *second-last*.
- **One hand, in one line:** deal 13/14 cards from a player-count-cut deck (0–10 / 0–10 / 0–12 /
  0–15 for 2/3/4/5 players), play tricks (follow suit; trump beats all), and when you win your
  3rd/4th trick (3p: 4th, 4p/5p: 3rd) you're out and score everyone else's trick count; the
  last player standing scores only their own tricks and deals + names trump next hand.
- **Special cards (Voodoo Prince only):** the **0** (voodoo doll) is the weakest card of its
  suit unless the suit's top card (10/12/15 by player count) is in the *same trick*, in which
  case the 0 outranks it (trump still beats a non-trump 0); the **5 and 7** split any trick they
  *win* — it counts as **two** tricks toward exit and scoring, so a player can bust past the
  exit threshold (rulebook explicitly allows ending a hand "with one trick more than the
  maximum").
- **2-player mode:** no exit threshold — the hand ends when a player reaches **7 tricks**; the
  winner scores the opponent's trick count, the opponent scores the tricks they'd still need to
  reach 7.
- **Game end:** exactly **5 hands**; most points wins (ties = multiple winners, rulebook
  verbatim). Note: the rulebook's German/English text says "5 Runden" — the "5 rounds" phrasing
  in the current `RULES.md` is correct.
- **Marshmallow Test** (Gamewright 2020 reimplementation, "designer's version") is playable as a
  separate ruleset in this port. Its own setup is **NOT yet verified against its rulebook**
  (deck, trump, exit thresholds, deal size, no-special-cards, race-to-20, no-tiebreak). See
  `RULES-AUDIT.md` §Marshmallow.

## Why This Game

- Reiner Knizia is a first-class preference for this user; trick-taking is a first-class
  mechanic alongside it (see `board-game-scoping` notes).
- Complementary to the existing trick-takers in the portfolio: Schadenfreude/Stick 'Em
  (pain-suit drafting), BottleImp, Sechs Nimmt. Voodoo Prince is the *timing/exit* trick-taker —
  no bidding, no pain suits, pure push-your-luck trick timing.
- Tiny rules surface (one page), deep timing decisions: ideal for a fast, bots-first web port.
- Won the Trick-Taking Guild's **Golden Trickster award (2017)** and was Fairplay À la carte
  runner-up (2018) — high-signal pedigree.

## Existing Digital Versions

- No official app, no BGA implementation (BGA has Marshmallow Test). Tabletop Simulator mods
  exist. This port (room-code multiplayer + bots, self-hosted) fills a real gap.
- Note for honesty: **Marshmallow Test is on Board Game Arena**; Voodoo Prince itself has no
  polished digital presence.

## What We'd Build (as-built)

- **Stack:** Node (Express + `ws`) realtime server; React 19 + Vite client; plain JS (no
  TypeScript in app code — audit tooling is TS). Room-code lobbies; bots fill seats; no
  accounts; no persistence across restarts.
- **Engine:** pure-ish state machine (`server/game/engine.js` + `rules.js` + `deck.js`),
  server-authoritative — the server validates every move (follow-suit, turn, phase, legality)
  and the client only *hints* legality for UI. RNG is injected-ish (`shuffle(deck, rng)`
  defaulting to `Math.random`) — see RULES-AUDIT.md determinism note.
- **Realtime:** `ws` at `/ws`; `ROOM_STATE`/`GAME_STATE` broadcasts; per-seat hidden hand
  partitioning (only your own hand is serialized); reconnect via per-player token
  (`REJOIN_ROOM`), bot takeover on disconnect, room cleanup, rate limiting, 16 KB message cap,
  `/healthz`.
- **Bots:** single difficulty tier (heuristic: follow-suit legality, exit-threshold awareness,
  avoids winning with specials near the exit) — not the standard easy/medium/hard set (gap).
- **Client:** lobby (room code copy, seat mgmt, ruleset toggle, add-bot), game screen (hand
  fan, legal-play hints, trump modal, trick sweep animation, scoreboard, log, sound/effects
  toggles, sort), mobile pass, `client/dist` built and served by Express.
- **Deploy:** Dockerfile, `npm start` production path, healthz. (Deploy verification probe not
  wired here — this repo has no live-host gate; CI runs tests.)

## Standards

Declared per the universal game-build standard (`game-build-standard` skill):

- **Stack:** Node/Express + `ws` (server) · React/Vite (client) · plain ESM JS + TS audit
  tooling.
- **Engine:** pure functions over `(state, action, rng)`; RNG injected via `shuffle(deck, rng)`
  but **not seeded end-to-end** (trump draw uses global `Math.random`; no replay harness) —
  **GAP vs standard**, flagged in RULES-AUDIT.md.
- **Rules source & edition:** Schmidt Spiele 2017 multi-language rulebook PDF
  (gesellschaftsspiele.spielen.de, 8 pp., DE/FR/IT) = the primary source, extracted fresh in
  `references/rulebook-extract.md`; card-sized English rules (BGG filepage 249702) + Dale Yu's
  VP-vs-MT difference list (Opinionated Gamers) as secondary cross-checks. The rulebook's own
  worked examples (trick-win example; Marie's 4-point exit; Nina's 5-split exit; Carsten/
  Ulrich 2p example) are replayed by `scripts/independent-rules-check.ts` (`npm run audit`).
- **Hidden info:** HIDDEN (hands) — server partitions state per viewer (`serializeGameFor`
  only sends your hand); audit probes the partition.
- **Time policy:** no timers; disconnect → seat becomes bot-controlled, token kept for
  rejoin, human can retake mid-game (policy chosen at build time; documented here).
- **Bots:** one tier (heuristic) — **GAP**: standard calls for easy/medium/hard.
- **Done-gate probes (5):** 1) rules audit via `npm run audit` (THIS doc set) — PASS once
  audit is green; 2) socket E2E to GAME_OVER — `npm run test:gameplay` (4 configs incl. a
  rejoin/disconnect test) — runs green; 3) bot-move probe — gameplay suite drives bot turns
  over the live socket — green; 4) headless-browser zero-pageerror play-through — **NOT
  WIRED** (gap); 5) deploy verification (image md5, cache-bust) — **NOT WIRED** (no live
  host for this repo; CI + healthz exist).
- **Deploy target + verification:** Docker/self-host, `/healthz`, `client.js?v=N` cache-bust
  pattern present in Dockerfile/static serve — live-image verification not exercised here.

## Full Rules Reference

Verbatim extraction of the Schmidt Spiele 2017 rulebook (DE text + EN card-sized rules,
cross-checked against Dale Yu's VP/MT diff list): **`references/rulebook-extract.md`**.
Summary tables (rulebook p.2 & p.4):

| Players | Ranks in play | Cards/player | Exit at (tricks) | 0-beats |
|---|---|---|---|---|
| 2 | 0–10 | 13 | hand ends at 7 (no exit) | 10 |
| 3 | 0–10 | 13 | 4th trick | 10 |
| 4 | 0–12 | 13 | 3rd trick | 12 |
| 5 | 0–15 | 14 | 3rd trick | 15 |

- Trick: dealer leads hand 1 (hand 1 trump drawn at random from the 5 trump cards); winner
  leads each subsequent trick. Follow suit or play anything. Highest trump wins; else highest
  led-suit card. (Voodoo-doll 0 exception above; trump beats a non-trump 0.)
- Exit: on reaching the threshold, discard the rest of your hand, score **sum of ALL other
  players' current trick counts** (including players who already exited — their frozen stacks
  still count, per the DE text "weil sie weiterhin für die Wertungen der Mitspieler zählen"),
  and the player to your **left** leads the next trick. 5/7-split can push you past the
  threshold (rulebook: you may end the hand with more than the maximum).
- End of hand: last player standing scores only their own tricks; they deal + choose trump
  (any suit, after looking at their hand) for the next hand and lead.
- Game end: after 5 hands, most points wins; **ties are multiple winners** (no tiebreak —
  the current engine's `reduce` winner-pick is a presentation choice, see RULES-AUDIT).
- 2p: first to 7 tricks ends the hand; winner scores opponent's tricks, opponent scores
  (7 − their tricks).

## Technical Architecture

```
server/index.js      Express + ws; routing, rate-limit, /healthz, static client
server/rooms.js      room lifecycle, seat mgmt, bot takeover, serializeGameFor (per-viewer)
server/protocol.js   ClientAction/ServerEvent wire constants (mirrored client-side)
server/game/rules.js constants: deck cut, deal sizes, exit thresholds, specials, trick values
server/game/deck.js  buildDeck(playerCount, ruleset), shuffle(deck, rng), cardId
server/game/engine.js createGame/startNextHand/chooseTrump/legalPlays/nextToPlay/playCard
server/game/bot.js   heuristic bot (legal-only moves)
client/src/          React app: Lobby, Game, Card, PlayerSeat, Scoreboard, net/* (socket,
                     protocol, legalPlays hint, sound, particles, settings, theme)
test/unit/*.test.js  node:test unit suites (rules, deck, engine, bot, rooms)
test/gameplay.mjs    socket E2E: full games to GAME_OVER + negative protocol tests
scripts/independent-rules-check.ts  independent rulebook replay (npm run audit)
references/rulebook-extract.md      verbatim rulebook extraction (source of truth)
RULES-AUDIT.md       per-rule fidelity audit: rule → engine → test/audit-probe
SCOPE.md             this file
```

## Build Phases (as-built history)

1. Engine core (deck/rules/engine) + unit tests — done.
2. Server (rooms, ws, bots, per-viewer serialization) — done.
3. Client (lobby/game, hand UI, animations, sound) — done.
4. Realtime hardening (disconnect/rejoin, bot takeover, cleanup, rate limits) — done.
5. Rules verification (RULES.md; commit history shows an earlier wrong-rules pass was
   corrected in `3d6bcf8` "Fix engine to match official Voodoo Prince rules") — done.
6. **Independent rules audit (this pass):** fresh rulebook extraction, SCOPE.md,
   RULES-AUDIT.md, `scripts/independent-rules-check.ts` + `npm run audit` — done.

## What Success Looks Like

A shareable room-code URL where 2–5 friends (or a friend + bots) can play a faithful Voodoo
Prince: real deck cuts per player count, real 0/5/7 special-card behavior, real exit/scoring
timing, and a real 2-player race-to-7 — with the rulebook's own examples replayed and passing
(`npm run audit` green) so "faithful" is proven, not claimed.

## What We're Not Building (Phase 0 Scope)

- No accounts/chat/leaderboards. No mobile apps (responsive web only). No expansions.
- No persistence across server restarts (rooms are in-memory; documented).
- No easy/medium/hard bot tiers (single heuristic tier today — GAP).
- No headless-browser UI gate, no live-host deploy-verification probe (GAPs, RULES-AUDIT §Gaps).
- Marshmallow Test ruleset kept playable but **not rulebook-verified** — flagged, not shipped
  as verified.
