import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MatchRecords } from '../server/matchRecords.js';
import { startServer } from './helpers/legacyServer.js';

const player = (playerId, name, damage, buys) => ({
  playerId, name, seat: 0, stats: { dmgDealt: damage, refreshes: 2, activatedLayers: 8 },
  bonds: [{ bondId: 'bond_test', name: '迅捷', layers: 8, active: true }],
  purchases: [{ kind: 'chess', id: 'char_amiya', name: '阿米娅', count: buys, spent: buys * 2,
    byRound: buys > 2 ? { 1: 2, 2: buys - 2 } : { 1: buys } }],
});

test('completed matches persist, calculate shares and keep latest room and player results', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sp-records-'));
  try {
    const file = path.join(directory, 'records.jsonl');
    const records = new MatchRecords(file);
    const room = { code: 'ABCD', mode: 'coop', difficulty: 'NORMAL', matchCount: 1 };
    assert.equal(records.save(room, null), null);
    const first = records.save(room, { players: [player('p1', '阿米娅', 300, 3), player('p2', '凯尔希', 100, 1)], roundsPassed: 8 }, 1000);
    assert.equal(first.players[0].damageSharePct, 75);
    assert.equal(first.players[1].damageSharePct, 25);
    assert.equal(first.players[0].stats.buys, 3);
    assert.deepEqual(first.players[0].purchases[0], { kind: 'chess', id: 'char_amiya', name: '阿米娅', count: 3, spent: 6, byRound: { 1: 2, 2: 1 } });
    assert.equal(first.players[0].bonds[0].name, '迅捷');
    assert.equal(Object.hasOwn(first.players[0], 'playerId'), false);
    room.matchCount++;
    records.save(room, { players: [player('p1', '阿米娅', 20, 5)], roundsPassed: 9, victory: true }, 2000);
    assert.equal(records.latestRoom('ABCD').matchNo, 2);
    assert.equal(records.latestRoom('ABCD').players[0].stats.buys, 5);
    assert.equal(records.latestPlayer('p2').matchNo, 1);
    assert.equal(records.latestPlayer('p1').ownSeat, 0);
    assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 2);
    const reloaded = new MatchRecords(file);
    assert.equal(reloaded.latestRoom('ABCD').matchNo, 2);
    assert.equal(reloaded.latestPlayer('p2').players.length, 2);
    assert.equal(reloaded.latestRoom('../'), null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('public records endpoint returns latest completed match without player ids', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sp-records-http-'));
  let server;
  try {
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true, recordsFile: path.join(directory, 'records.jsonl') });
    server.records.save({ code: 'WXYZ', mode: 'coop', difficulty: 'FUNNY', matchCount: 1 }, { players: [player('secret', 'Doctor', 50, 2)] }, 3000);
    const response = await fetch(`${server.url}/api/records/WXYZ`);
    assert.equal(response.status, 200);
    const record = await response.json();
    assert.equal(record.players[0].name, 'Doctor');
    assert.equal(JSON.stringify(record).includes('secret'), false);
    assert.equal((await fetch(`${server.url}/api/records/ABCD`)).status, 404);
  } finally {
    await server?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
