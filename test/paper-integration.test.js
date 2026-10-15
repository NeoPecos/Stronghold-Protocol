import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Lobby } from '../server/lobby.js';
import { SessionRegistry } from '../server/net.js';
import { validateC2S } from '../shared/protocol.js';
import { ERR } from '../shared/constants.js';
import { createRequestHandler } from '../server/http/routes.js';
import { battleDamageReport } from '../public/js/battle/damageStats.js';
import { createPreloader } from '../public/js/resources/preload.js';

function harness(context) {
  let now = 10000;
  const registry = new SessionRegistry({ now: () => now });
  const lobby = new Lobby({ registry, now: () => now, getData: () => ({}) });
  context.after(() => lobby.shutdown());
  function player(name) {
    const session = registry.create(name);
    const messages = [];
    session.connected = true;
    session.ws = { readyState: 1, bufferedAmount: 0, send(raw) { messages.push(JSON.parse(raw)); } };
    return { session, messages, send: msg => {
      assert.equal(validateC2S(msg), null);
      return lobby.onMessage(session, msg);
    } };
  }
  return { lobby, registry, player, advance: ms => { now += ms; } };
}

test('room chat validates membership, server identity, history and rate limits', context => {
  const setup = harness(context);
  const host = setup.player('host');
  const guest = setup.player('guest');
  const outsider = setup.player('outsider');
  host.send({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
  const code = host.session.roomCode;
  guest.send({ t: 'room.spectate', code });
  assert.equal(outsider.send({ t: 'room.chat.history', code }).error, ERR.NOT_IN_ROOM);
  assert.equal(host.send({ t: 'room.chat', code, text: 'hello', name: 'spoof' }).ok, true);
  assert.equal(guest.messages.at(-1).name, 'host');
  assert.equal(host.send({ t: 'room.chat', code, text: 'spam' }).error, ERR.RATE);
  assert.equal(outsider.messages.some(message => message.t === 'room.chat'), false);
  for (let index = 0; index < 90; index++) {
    setup.advance(1001);
    host.send({ t: 'room.chat', code, text: String(index) });
  }
  guest.send({ t: 'room.chat.history', code });
  assert.equal(guest.messages.at(-1).messages.length, 80);
  guest.send({ t: 'room.leave' });
  assert.equal(guest.send({ t: 'room.chat', code, text: 'after leave' }).error, ERR.NOT_IN_ROOM);
  assert.notEqual(validateC2S({ t: 'room.chat', code, text: 'a'.repeat(201) }), null);
});

test('quick matchmaking groups same difficulty into ordinary human rooms', context => {
  const setup = harness(context);
  const players = Array.from({ length: 5 }, (_, index) => setup.player('player' + index));
  players[0].send({ t: 'match.queue', difficulty: 'HARD' });
  for (const player of players.slice(1)) player.send({ t: 'match.queue', difficulty: 'NORMAL' });
  assert.equal(setup.lobby.matchmaker.queue.size, 1);
  const code = players[1].session.roomCode;
  assert.ok(code);
  assert.ok(players.slice(1).every(player => player.session.roomCode === code));
  const room = setup.lobby.getRoom(code);
  assert.equal(room.activeHumans().length, 4);
  assert.equal(room.match, null);
  assert.equal(room.seats.some(seat => seat?.isBot), false);
  assert.equal(players[0].session.roomCode, null);
  players[0].send({ t: 'match.cancel' });
  assert.equal(setup.lobby.matchmaker.queue.size, 0);
});

test('matchmaking respects invite-only recruitment and disconnect cleanup', context => {
  const setup = harness(context);
  const host = setup.player('host');
  const queued = setup.player('queued');
  host.send({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
  const room = setup.lobby.roomOf(host.session);
  room.recruitWanted = true;
  room.inviteOnly = true;
  queued.send({ t: 'match.queue', difficulty: 'NORMAL' });
  assert.equal(queued.session.roomCode, null);
  room.inviteOnly = false;
  setup.lobby.matchmaker.tick();
  assert.equal(queued.session.roomCode, room.code);
  queued.send({ t: 'room.leave' });
  setup.advance(1001);
  room.recruitWanted = false;
  queued.send({ t: 'match.queue', difficulty: 'NORMAL' });
  setup.lobby.onDisconnect(queued.session);
  assert.equal(setup.lobby.matchmaker.queue.size, 0);
});

test('manual creation cancels matchmaking and stale queues expire', context => {
  const setup = harness(context);
  const player = setup.player('player');
  player.send({ t: 'match.queue', difficulty: 'NORMAL' });
  player.send({ t: 'room.create', mode: 'solo', difficulty: 'NORMAL' });
  assert.equal(setup.lobby.matchmaker.queue.size, 0);
  player.send({ t: 'room.leave' });
  setup.advance(1001);
  player.send({ t: 'match.queue', difficulty: 'NORMAL' });
  setup.advance(600001);
  setup.lobby.matchmaker.tick();
  assert.equal(setup.lobby.matchmaker.queue.size, 0);
});

test('legacy announcement route is gone; kick still requires the existing admin token', async context => {
  const setup = harness(context);
  const host = setup.player('host');
  host.send({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
  const handler = createRequestHandler({ serveStatic() {}, health: { lobby: setup.lobby }, adminToken: 'test-paper-admin-token',
    log: { warn() {}, error() {} } });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const request = (path, body, token) => fetch('http://127.0.0.1:' + server.address().port + '/api/admin/' + path, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-sp-admin-token': token || '' }, body: JSON.stringify(body),
  });
  assert.equal((await request('announcement', { text: 'test' }, 'test-paper-admin-token')).status, 404);
  assert.equal((await request('announcement/cancel', { id: 'old' }, 'test-paper-admin-token')).status, 404);
  assert.equal((await request('kick', { playerId: host.session.playerId })).status, 401);
  assert.equal((await request('kick', { playerId: host.session.playerId }, 'test-paper-admin-token')).status, 200);
  assert.equal(host.session.roomCode, null);
});

test('damage report reads existing counters and simulation time without mutation', () => {
  const battle = { time: 10, finished: false, allyUnits: [
    { id: 1, kind: 'op', ownerId: 'one', stats: { dmg: 100 } },
    { id: 2, kind: 'op', ownerId: 'two', stats: { dmg: 240 } },
    { id: 3, kind: 'enemy', stats: { dmg: 999 } },
  ] };
  const before = JSON.stringify(battle);
  const report = battleDamageReport(battle, 'field');
  assert.deepEqual(report.units.map(unit => [unit.ownerId, unit.damage, unit.dps]), [['two', 240, 24], ['one', 100, 10]]);
  assert.equal(JSON.stringify(battle), before);
  assert.equal(battleDamageReport({ ...battle, time: 0 }, 'field').units[0].dps, 0);
});

test('preload bounds concurrency/files, reuses URLs, and stops at byte budget', async () => {
  let active = 0;
  let maximum = 0;
  let fetched = 0;
  const preload = createPreloader({ maxFiles: 4, concurrency: 2, maxBytes: 1024, fetch: async () => {
    active++;
    maximum = Math.max(maximum, active);
    fetched++;
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return new Response('asset');
  } });
  assert.equal((await preload.run(['/a', '/a', '/b', '/c', '/d', '/e'])).done, 4);
  assert.equal(maximum, 2);
  await preload.run(['/a']);
  assert.equal(fetched, 4);
  const bounded = createPreloader({ concurrency: 1, maxBytes: 4, fetch: async () => new Response('too big') });
  const result = await bounded.run(['/one', '/two']);
  assert.equal(result.done, 0);
  assert.equal(result.failed, 1);
});
