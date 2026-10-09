import { test } from 'node:test';
import assert from 'node:assert/strict';

import { startServer } from '../server/index.js';
import { StubMatch } from '../server/match/StubMatch.js';
import { TestClient } from './helpers/wsClient.js';
import { ERR } from '../shared/constants.js';
import { validateC2S } from '../shared/protocol.js';

test('room.list shows co-op rooms, occupancy and whether joining is still possible', async () => {
  assert.equal(validateC2S({ t: 'room.list' }), null);
  const errors = [];
  const log = { info() {}, warn() {}, debug() {}, error: (...args) => errors.push(args.join(' ')) };
  const server = await startServer({ port: 0, host: '127.0.0.1', log, MatchClass: StubMatch });
  const clients = [];
  const player = async (name) => {
    const client = await TestClient.connect(`ws://127.0.0.1:${server.port}/ws`);
    clients.push(client);
    const welcome = await client.hello(name);
    client.id = welcome.playerId;
    return client;
  };
  const request = async (client, msg) => {
    const response = await client.request(msg);
    assert.equal(response.t, 'ok', JSON.stringify(response));
  };
  const list = async (client) => {
    await request(client, { t: 'room.list' });
    return (await client.waitFor('room.list')).rooms;
  };

  try {
    const host = await player('Host');
    await request(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    const state = await host.waitFor('room.state');
    const solo = await player('Solo');
    await request(solo, { t: 'room.create', mode: 'solo', difficulty: 'FUNNY' });
    const viewer = await player('Viewer');

    assert.deepEqual(await list(viewer), [{
      code: state.code, hostName: 'Host', difficulty: 'NORMAL', players: 1, bots: 0,
      capacity: 4, spectators: 0, inMatch: false, createdAt: server.lobby.getRoom(state.code).createdAt,
    }]);

    await request(host, { t: 'room.addBot' });
    const guest = await player('Guest');
    await request(guest, { t: 'room.join', code: state.code });
    await guest.waitFor('room.state', (room) => room.seats.some((seat) => seat?.playerId === guest.id));
    await request(host, { t: 'room.addBot' });
    const full = (await list(viewer))[0];
    assert.equal(full.players, 2);
    assert.equal(full.bots, 2);
    assert.equal(full.players + full.bots, full.capacity);
    assert.equal((await viewer.request({ t: 'room.join', code: state.code })).code, ERR.ROOM_FULL);

    await request(host, { t: 'room.kick', seat: 2, playerId: guest.id });
    assert.equal((await guest.waitFor('room.closed')).reason, 'kicked');
    assert.equal((await list(viewer))[0].players, 1);
    await request(host, { t: 'room.start' });
    assert.equal((await list(viewer))[0].inMatch, true);
    assert.equal((await viewer.request({ t: 'room.join', code: state.code })).code, ERR.ROOM_STARTED);
    assert.deepEqual(errors, []);
  } finally {
    await Promise.all(clients.map((client) => client.terminate().catch(() => {})));
    await server.close();
  }
});
