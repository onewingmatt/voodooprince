import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addBot } from '../../server/rooms.js';

const BOT_NAMES = [
  'Ace Alice', 'Bluff Bob', 'Crafty Carol', 'Daring Dan', 'Eager Eddie',
  'Fearless Fiona', 'Gambit Gary', 'Hustler Hank', 'Icy Iris', 'Joker Jake',
  'Keen Kara', 'Lucky Luke', 'Mighty Mina', 'Nimble Nate', 'Outlaw Olivia',
  'Poker Pete', 'Quick Quinn', 'Reckless Roxy', 'Sharp Stella', 'Tricky Tom',
  'Uncanny Uma', 'Vicious Vic', 'Wild Willa', 'Sly Xavier', 'Youthful Yara',
  'Zealous Zoe', 'Bold Bella', 'Clever Chloe', 'Deft Dmitri', 'Elusive Elias',
];

test('bots in a room always get unique names from the pool', () => {
  for (let i = 0; i < 15; i++) {
    const room = createRoom({ hostName: 'Host', maxSeats: 5 });
    for (let b = 0; b < 4; b++) addBot(room);
    const names = room.seats.map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `duplicate names: ${names}`);
    for (const n of names.slice(1)) {
      assert.ok(BOT_NAMES.includes(n), `bot got non-pool name ${n}`);
    }
  }
});

test('bots avoid names already taken by humans', () => {
  for (const taken of ['Ace Alice', 'Bluff Bob', 'Host']) {
    const room = createRoom({ hostName: taken, maxSeats: 5 });
    for (let b = 0; b < 4; b++) addBot(room);
    const names = room.seats.map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `duplicate names: ${names}`);
    assert.ok(!names.slice(1).includes(taken), `bot took human name ${taken}`);
  }
});

test('addBot respects the room capacity', () => {
  const room = createRoom({ hostName: 'Host', maxSeats: 2 });
  addBot(room);
  assert.throws(() => addBot(room), /Room is full/);
});
