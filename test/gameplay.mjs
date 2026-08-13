// End-to-end gameplay regression suite.
// Spawns the real server on a test port, then drives full games over the
// WebSocket protocol with an independent rules replica, cross-checking every
// server transition. Run with: npm run test:gameplay
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.VP_TEST_PORT ?? 3999);
const WS_URL = `ws://localhost:${PORT}/ws`;

const SUITS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
const TRICKS_TO_EXIT = { 2: 6, 3: 4, 4: 3, 5: 3 };
const HANDS_PER_GAME = 5;
const MARSHMALLOW_TARGET = 20;

// ---------- replicated rules (mirror of server/game/rules.js + engine.js) ----------
const isSpecial = (c, ruleset) => ruleset !== 'marshmallow' && (c.rank === 5 || c.rank === 7);
const trickValue = (c, ruleset) => (isSpecial(c, ruleset) ? 2 : 1);
const dealSize = (n) => Math.min(14, Math.floor(80 / n));
const threshold = (n) => TRICKS_TO_EXIT[n] ?? 3;
const cardKey = (c) => `${c.suit}:${c.rank}`;

function legalPlays(hand, trick, trumpSuit, ruleset) {
  if (trick.length === 0) return hand.slice();
  const leadSuit = trick[0].card.suit;
  const lead = hand.filter((c) => c.suit === leadSuit);
  const trumpPlayed = ruleset === 'marshmallow' && trick.some((p) => p.card.suit === trumpSuit);
  if (trumpPlayed) {
    const trumps = hand.filter((c) => c.suit === trumpSuit);
    if (lead.length || trumps.length) {
      const map = new Map();
      [...lead, ...trumps].forEach((c) => map.set(cardKey(c), c));
      return [...map.values()];
    }
    return hand.slice();
  }
  if (lead.length) return lead;
  return hand.slice();
}

function trickFromLog(logLines) {
  const playRe = /^(.+) plays (\d+) of (\w+)\.$/;
  const winRe = /^(.+) wins the trick/;
  const lastWin = logLines.map((l, i) => (winRe.test(l) ? i : -1)).filter((i) => i >= 0).at(-1);
  if (lastWin === undefined) return null;
  const plays = [];
  for (let i = lastWin - 1; i >= 0; i--) {
    const m = logLines[i].match(playRe);
    if (m) plays.unshift({ name: m[1], rank: Number(m[2]), suit: m[3] });
    else break;
  }
  return { plays, winLine: logLines[lastWin] };
}

function winnerOf(plays, trumpSuit, ruleset) {
  if (plays.length === 0) return null;
  const leadSuit = plays[0].suit;
  const trumps = plays.filter((p) => p.suit === trumpSuit);
  const pool = trumps.length ? trumps : plays.filter((p) => p.suit === leadSuit);
  let best = pool[0];
  for (const p of pool) {
    const r = ruleset !== 'marshmallow' && p.rank === 0 ? 16 : p.rank;
    const br = ruleset !== 'marshmallow' && best.rank === 0 ? 16 : best.rank;
    if (r > br) best = p;
  }
  return best;
}

// ---------- WS client with a clean waiter queue ----------
class Client {
  constructor(label) {
    this.label = label;
    this.events = [];
    this.waiters = [];
    this.session = null;
    this.rs = null;
    this.gs = null;
    this.errors = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.on('open', () => resolve());
      this.ws.on('error', (e) => reject(new Error(`${this.label} ws error: ${e.message}`)));
      this.ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (msg.type === 'SESSION') this.session = msg.payload;
        if (msg.type === 'ROOM_STATE') this.rs = msg.payload;
        if (msg.type === 'GAME_STATE') this.gs = msg.payload;
        if (msg.type === 'ERROR') this.errors.push(msg.payload.message);
        this.events.push(msg);
        for (const w of [...this.waiters]) w.check();
      });
      this.ws.on('close', () => {
        for (const w of [...this.waiters]) w.check();
      });
    });
  }
  disconnect() {
    try { this.ws.close(); } catch {}
  }
  send(type, payload = {}) {
    this.ws.send(JSON.stringify({ type, payload }));
  }
  sendRaw(str) {
    this.ws.send(str);
  }
  waitFor(pred, timeoutMs, desc) {
    return new Promise((resolve, reject) => {
      const waiter = {
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error(`${this.label}: timeout waiting for ${desc}`));
        }, timeoutMs),
        check: () => {
          if (waiter.done) return;
          const idx = this.events.findIndex(waiter.pred);
          if (idx !== -1) {
            waiter.done = true;
            clearTimeout(waiter.timer);
            this.waiters = this.waiters.filter((w) => w !== waiter);
            resolve(this.events.splice(idx, 1)[0]);
          }
        },
        pred,
      };
      this.waiters.push(waiter);
      waiter.check();
    });
  }
}

// ---------- per-game runner ----------
function runGame(cfg) {
  return new Promise((resolve) => {
    const label = cfg.name;
    const log = [];
    const notes = [];
    const fail = (msg, errors) => {
      const extra = errors && errors.length ? ` (server errors seen: ${errors.join('; ')})` : '';
      log.push(`FAIL ${label}: ${msg}${extra}`);
      resolve({ label, ok: false, log });
    };
    let c = new Client(label);
    let lastState = null;
    let lastTrumpHand = 0;
    let trickChecks = 0;
    let gameOverState = null;
    const mySeat = 0;
    const playerCount = cfg.bots + 1;
    const t = threshold(playerCount);
    const deal = dealSize(playerCount);
    const watchdog = setTimeout(() => fail('watchdog timeout (game too long)', c.errors), 8 * 60 * 1000);

    function checkInvariants(gs) {
      const okPhases = cfg.ruleset === 'marshmallow' ? ['playing', 'between_hands', 'game_over'] : ['choosing_trump', 'playing', 'between_hands', 'game_over'];
      if (!okPhases.includes(gs.phase)) throw new Error(`bad phase ${gs.phase}`);
      if (gs.handNumber < 1) throw new Error(`handNumber ${gs.handNumber}`);
      if (gs.trumpSuit !== null && !SUITS.includes(gs.trumpSuit)) throw new Error(`bad trump ${gs.trumpSuit}`);
      if (gs.currentTrick.length > gs.activePlayers.length) throw new Error(`trick ${gs.currentTrick.length} > active ${gs.activePlayers.length}`);
      if (gs.phase === 'playing' && cfg.ruleset !== 'marshmallow' && gs.trumpSuit === null) throw new Error('playing without trump');
      if (gs.phase === 'playing' && gs.turnSeat !== null && !gs.activePlayers.includes(gs.turnSeat)) {
        throw new Error(`turnSeat ${gs.turnSeat} not active [${gs.activePlayers}]`);
      }
      const seats = gs.currentTrick.map((p) => p.seat);
      if (new Set(seats).size !== seats.length) throw new Error(`duplicate seats in trick: ${seats}`);
      if (gs.activePlayers.length > 1 && seats.some((s) => !gs.activePlayers.includes(s))) {
        throw new Error(`trick seat outside active: ${seats}`);
      }

      const counts = gs.players.map((p) => p.cardCount);
      if (lastState && gs.handNumber === lastState.handNumber) {
        for (let i = 0; i < counts.length; i++) {
          if (counts[i] > lastState.players[i].cardCount) throw new Error(`cardCount increased for seat ${i} (${lastState.players[i].cardCount} -> ${counts[i]})`);
        }
      } else if (gs.phase !== 'game_over') {
        const sum = counts.reduce((a, b) => a + b, 0);
        if (sum !== deal * playerCount) throw new Error(`deal sum ${sum} != ${deal * playerCount} at hand ${gs.handNumber}`);
      }

      for (let i = 0; i < gs.players.length; i++) {
        const p = gs.players[i];
        if (p.tricksWon < 0) throw new Error('negative tricksWon');
        if (p.exited && p.tricksWon < t) throw new Error(`exited with tricksWon ${p.tricksWon} < threshold ${t}`);
        if (p.score < 0) throw new Error('negative score');
        if (lastState && p.score < lastState.players[i].score) throw new Error(`score decreased for ${p.name}`);
      }

      if (lastState && lastState.phase === 'playing' && lastState.currentTrick.length > 0 && gs.currentTrick.length === 0) {
        const tr = trickFromLog(gs.log);
        if (!tr) throw new Error('trick resolved but no win line in log');
        const winner = winnerOf(tr.plays, lastState.trumpSuit, cfg.ruleset);
        const winnerCard = tr.plays.find((p) => p.name === winner.name);
        const winName = tr.winLine.replace(/ wins the trick.*/, '');
        if (!winner || winner.name !== winName) {
          throw new Error(`trick winner mismatch: computed ${winner?.name} (${winner?.suit}:${winner?.rank}) from [${tr.plays.map((p) => `${p.name}(${p.suit}:${p.rank})`).join(', ')}], server log: ${tr.winLine}`);
        }
        if (trickValue(winnerCard, cfg.ruleset) === 2 && !tr.winLine.includes('counts double')) {
          throw new Error(`double trick not flagged: ${tr.winLine}`);
        }
        trickChecks++;
      }
      if (gs.phase === 'game_over' && !gameOverState) gameOverState = gs;
    }

    function onGameState(gs) {
      checkInvariants(gs);
      lastState = gs;
      if (gs.phase === 'game_over') return 'GAME_OVER';
      if (gs.phase === 'choosing_trump' && gs.dealerSeat === mySeat && gs.handNumber !== lastTrumpHand) {
        lastTrumpHand = gs.handNumber;
        const counts = new Map(SUITS.map((s) => [s, 0]));
        for (const card of gs.players[mySeat].hand) counts.set(card.suit, counts.get(card.suit) + 1);
        let best = SUITS[0];
        for (const s of SUITS) if (counts.get(s) > counts.get(best)) best = s;
        return { type: 'CHOOSE_TRUMP', payload: { suit: best } };
      }
      if (gs.phase === 'playing' && gs.turnSeat === mySeat) {
        const hand = gs.players[mySeat].hand;
        const legal = legalPlays(hand, gs.currentTrick, gs.trumpSuit, cfg.ruleset);
        if (legal.length === 0) throw new Error('no legal plays');
        let card;
        if (legal.length === 1) card = legal[0];
        else {
          const sorted = [...legal].sort((a, b) => a.rank - b.rank);
          const tricksFromExit = t - gs.players[mySeat].tricksWon;
          const leading = gs.currentTrick.length === 0;
          if (tricksFromExit <= 1) card = sorted.find((x) => !isSpecial(x, cfg.ruleset)) ?? sorted[0];
          else if (leading) card = sorted[Math.floor(sorted.length / 2)];
          else card = sorted[sorted.length - 1];
        }
        return { type: 'PLAY_CARD', payload: { card } };
      }
      return null;
    }

    async function waitAction(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        let ev;
        try {
          ev = await c.waitFor((e) => e.type === 'GAME_STATE', 2000, 'GAME_STATE');
        } catch {
          continue;
        }
        const act = onGameState(ev.payload);
        if (act) return act;
      }
      throw new Error('timeout waiting for an actionable game state');
    }

    (async () => {
      try {
        await c.connect();
        await c.send('CREATE_ROOM', { name: 'Tester', maxSeats: playerCount, ruleset: cfg.ruleset });
        const sess = await c.waitFor((e) => e.type === 'SESSION', 5000, 'SESSION');
        const code = sess.payload.code;
        for (let i = 0; i < cfg.bots; i++) await c.send('ADD_BOT', {});
        await c.waitFor((e) => e.type === 'ROOM_STATE' && e.payload.seats.length === playerCount, 5000, 'room full');
        await c.send('START_GAME', {});

        let rejoinDone = false;
        for (;;) {
          const act = await waitAction(45_000);
          if (act === 'GAME_OVER') break;

          if (!rejoinDone && cfg.disconnectTest && c.gs && c.gs.handNumber >= 1) {
            rejoinDone = true;
            const token = c.session.token;
            const handAtDrop = c.gs.handNumber;
            c.disconnect();
            await new Promise((r) => setTimeout(r, 4000));
            const c2 = new Client(`${label}-rejoin`);
            await c2.connect();
            await c2.send('REJOIN_ROOM', { code, token });
            await c2.waitFor((e) => e.type === 'SESSION', 5000, 'rejoin SESSION');
            const untilGs = async () => {
              const dl = Date.now() + 5000;
              while (Date.now() < dl && !c2.gs) await new Promise((r) => setTimeout(r, 50));
              if (!c2.gs) throw new Error('no game state after rejoin');
            };
            await untilGs();
            if (c2.gs.players[0].humanDisconnected) throw new Error('humanDisconnected still true after rejoin');
            if (c2.gs.handNumber < handAtDrop) throw new Error('game regressed while disconnected');
            notes.push(`rejoin OK: dropped at hand ${handAtDrop}, resumed at hand ${c2.gs.handNumber}`);
            lastTrumpHand = c2.gs.handNumber - 1;
            lastState = { handNumber: c2.gs.handNumber, players: c2.gs.players.map((p) => ({ cardCount: p.cardCount, score: p.score })) };
            c = c2;
            continue;
          }

          await c.send(act.type, act.payload);
        }

        if (!gameOverState) throw new Error('game ended without game_over state');
        const gs = gameOverState;
        const winner = gs.players.reduce((a, b) => (b.score > a.score ? b : a));
        if (!gs.log.some((l) => l.includes('Game over'))) throw new Error('no Game over log line');
        const hands = gs.handNumber;
        if (cfg.ruleset === 'full' && hands !== HANDS_PER_GAME) throw new Error(`full game ended after ${hands} hands, expected ${HANDS_PER_GAME}`);
        if (cfg.ruleset === 'marshmallow' && !gs.players.some((p) => p.score >= MARSHMALLOW_TARGET)) {
          throw new Error('marshmallow ended without anyone reaching 20');
        }
        if (c.errors.length) throw new Error(`unexpected server errors: ${c.errors.join('; ')}`);
        notes.push(`trick-resolution cross-checks passed: ${trickChecks}`);
        notes.push(`final scores: ${gs.players.map((p) => `${p.name}:${p.score}`).join(', ')}; winner: ${winner.name} (${winner.score})`);
        log.push(`PASS ${label}: ${hands} hands, ${trickChecks} trick checks, winner ${winner.name} (${winner.score})`);
        resolve({ label, ok: true, log: [...log, ...notes] });
      } catch (err) {
        fail(err.message, c.errors);
      } finally {
        clearTimeout(watchdog);
        try { c.disconnect(); } catch {}
      }
    })();
  });
}

// ---------- negative / protocol tests ----------
async function runNegativeTests() {
  const out = [];
  const fail = (msg) => out.push(`FAIL negative: ${msg}`);
  const expectError = (c, pred, timeoutMs, desc) =>
    c.waitFor((e) => e.type === 'ERROR' && pred(e.payload.message), timeoutMs, desc).catch(() => {
      throw new Error(`expected error '${desc}' not received`);
    });

  try {
    const n1 = new Client('neg1');
    await n1.connect();
    await n1.send('CREATE_ROOM', { name: 'N1' });
    await n1.waitFor((e) => e.type === 'SESSION', 3000, 'SESSION');
    await n1.send('START_GAME', {});
    await expectError(n1, (m) => m === 'Need at least 2 players.', 3000, 'Need at least 2 players');
    out.push('PASS negative: START_GAME with 1 player rejected');

    const h = new Client('neg2-host');
    await h.connect();
    await h.send('CREATE_ROOM', { name: 'N2', maxSeats: 2 });
    await h.waitFor((e) => e.type === 'SESSION', 3000, 'SESSION');
    const p = new Client('neg2-player');
    await p.connect();
    const code = h.session.code;
    await p.send('JOIN_ROOM', { code, name: 'P2' });
    await p.waitFor((e) => e.type === 'SESSION', 3000, 'SESSION');
    await p.send('ADD_BOT', {});
    await expectError(p, (m) => m === 'Only the host can do that.', 3000, 'Only the host can do that');
    out.push('PASS negative: non-host ADD_BOT rejected');
    await h.send('ADD_BOT', {});
    await h.waitFor((e) => e.type === 'ROOM_STATE' && e.payload.seats.length === 2, 3000, 'room full');
    await h.send('START_GAME', {});
    await h.waitFor((e) => e.type === 'GAME_STATE' && e.payload.phase === 'choosing_trump', 5000, 'choosing_trump');
    await h.send('PLAY_CARD', { card: { suit: 'Red', rank: 1 } });
    await expectError(h, (m) => m === 'Not currently playing.', 3000, 'Not currently playing');
    out.push('PASS negative: PLAY_CARD during choosing_trump rejected');
    await h.send('CHOOSE_TRUMP', { suit: 'Pink' });
    await expectError(h, (m) => m === 'Invalid suit.', 3000, 'Invalid suit');
    out.push('PASS negative: invalid trump suit rejected');
    await p.send('CHOOSE_TRUMP', { suit: 'Red' });
    await expectError(p, (m) => m === 'Only the dealer chooses trump.', 3000, 'Only the dealer chooses trump');
    out.push('PASS negative: non-dealer CHOOSE_TRUMP rejected');
    await h.send('CHOOSE_TRUMP', { suit: 'Red' });
    await h.waitFor((e) => e.type === 'GAME_STATE' && e.payload.phase === 'playing', 5000, 'playing');
    await p.send('PLAY_CARD', { card: { suit: 'Red', rank: 1 } });
    await expectError(p, (m) => m === 'Not your turn.', 3000, 'Not your turn');
    out.push('PASS negative: out-of-turn PLAY_CARD rejected');
    const hand = h.gs.players[0].hand;
    const inHand = new Set(hand.map((c) => `${c.suit}:${c.rank}`));
    let fake = null;
    for (const s of SUITS) for (let r = 0; r <= 15; r++) {
      if (!inHand.has(`${s}:${r}`)) { fake = { suit: s, rank: r }; break; }
      if (fake) break;
    }
    await h.send('PLAY_CARD', { card: fake });
    await expectError(h, (m) => m === 'Illegal card.', 3000, 'Illegal card');
    out.push('PASS negative: illegal card rejected');
    await p.sendRaw('{"type":"FOO","payload":{}}');
    await expectError(p, (m) => m === 'Unknown action: FOO', 3000, 'Unknown action');
    await p.sendRaw('this is not json');
    await expectError(p, (m) => m === 'Malformed message.', 3000, 'Malformed message');
    out.push('PASS negative: unknown action and malformed JSON rejected');
    const n3 = new Client('neg3');
    await n3.connect();
    await n3.send('JOIN_ROOM', { code: 'ZZZZ', name: 'x' });
    await expectError(n3, (m) => m === 'Room not found.', 3000, 'Room not found');
    out.push('PASS negative: JOIN_ROOM unknown code rejected');

    h.disconnect(); p.disconnect(); n1.disconnect(); n3.disconnect();
  } catch (err) {
    fail(err.message);
  }
  return { label: 'negative', ok: !out.some((o) => o.startsWith('FAIL')), log: out };
}

// ---------- main: spawn server, run suite, tear down ----------
const configs = [
  { name: 'A-4p-full', bots: 3, ruleset: 'full' },
  { name: 'B-3p-marshmallow', bots: 2, ruleset: 'marshmallow' },
  { name: 'C-5p-full', bots: 4, ruleset: 'full' },
  { name: 'D-2p-full', bots: 1, ruleset: 'full', disconnectTest: true },
];

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (d) => { serverOutput += d.toString(); });
server.stderr.on('data', (d) => { serverOutput += d.toString(); });

const waitForServer = (timeoutMs) =>
  new Promise((resolve, reject) => {
    const dl = Date.now() + timeoutMs;
    const poll = () => {
      if (serverOutput.includes(`listening on :${PORT}`)) return resolve();
      if (Date.now() > dl) return reject(new Error('server did not start in time:\n' + serverOutput));
      setTimeout(poll, 100);
    };
    poll();
  });

try {
  await waitForServer(10_000);
  console.log(`[gameplay] server up on :${PORT}`);
  const results = await Promise.allSettled([...configs.map(runGame), runNegativeTests()]);
  let allOk = true;
  for (const r of results) {
    const v = r.status === 'fulfilled' ? r.value : { label: '??', ok: false, log: [r.reason?.message ?? 'settled rejected'] };
    if (!v.ok) allOk = false;
    console.log('\n=== ' + v.label + ' ===');
    for (const line of v.log) console.log('  ' + line);
  }
  console.log(allOk ? '\nALL GAMEPLAY TESTS PASSED' : '\nSOME GAMEPLAY TESTS FAILED');
  server.kill();
  process.exit(allOk ? 0 : 1);
} catch (err) {
  console.error('FAILED to run gameplay suite:', err.message);
  server.kill();
  process.exit(1);
}
