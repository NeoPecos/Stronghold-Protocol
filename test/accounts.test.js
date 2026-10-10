import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server/index.js';
import { AccountStore } from '../server/accounts.js';
import { TestClient } from './helpers/wsClient.js';

test('accounts reserve case-insensitive names, verify passwords and preserve private records across restarts', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sp-accounts-'));
  const accountsFile = path.join(directory, 'accounts.json');
  const recordsFile = path.join(directory, 'records.jsonl');
  let server;
  const clients = [];
  const connect = async () => {
    const client = await TestClient.connect(`ws://127.0.0.1:${server.port}/ws`);
    clients.push(client);
    return client;
  };
  try {
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true, accountsFile, recordsFile });
    const owner = await connect();
    const welcome = await owner.hello('博士甲', null, { auth: 'register', password: 'correct horse battery' });
    assert.match(welcome.playerId, /^p_[0-9a-f]{20}$/);
    const file = readFileSync(accountsFile, 'utf8');
    assert.equal(file.includes('correct horse battery'), false);
    if (process.platform !== 'win32') assert.equal(statSync(accountsFile).mode & 0o777, 0o600);

    const rival = await connect();
    assert.equal((await rival.request({ t: 'hello', name: '博士甲', auth: 'register', password: 'another password' })).code, 'NAME_TAKEN');
    assert.equal((await rival.request({ t: 'hello', name: '博士甲', auth: 'login', password: 'wrong password' })).code, 'BAD_CREDENTIALS');
    assert.equal((await rival.request({ t: 'hello', name: '博士甲' })).code, 'AUTH_REQUIRED');
    assert.equal((await rival.request({ t: 'records.mine' })).code, 'BAD_MSG');
    assert.equal((await rival.request({ t: 'hello', name: '博士乙', token: welcome.token })).code, 'AUTH_REQUIRED');

    const second = await connect();
    const other = await second.hello('博士乙', null, { auth: 'register', password: 'another password' });
    server.records.save({ code: 'ABCD', mode: 'coop', difficulty: 'NORMAL', matchCount: 1 }, {
      players: [
        { playerId: welcome.playerId, name: '博士甲', seat: 0, stats: { dmgDealt: 90 } },
        { playerId: other.playerId, name: '博士乙', seat: 1, stats: { dmgDealt: 10 } },
      ],
    });
    assert.equal((await owner.request({ t: 'records.mine' })).t, 'ok');
    const ownerRecord = await owner.waitFor('records.latest');
    assert.equal(ownerRecord.record.ownSeat, 0);
    assert.equal((await second.request({ t: 'records.mine' })).t, 'ok');
    const rivalRecord = await second.waitFor('records.latest');
    assert.equal(rivalRecord.record.ownSeat, 1);

    await Promise.all(clients.map((client) => client.terminate()));
    clients.length = 0;
    await server.close();
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true, accountsFile, recordsFile });
    const returnee = await connect();
    assert.equal((await returnee.request({ t: 'hello', name: '博士甲', token: welcome.token })).code, 'AUTH_REQUIRED');
    const relogin = await returnee.hello('博士甲', null, { auth: 'login', password: 'correct horse battery' });
    assert.equal(relogin.playerId, welcome.playerId);
    assert.equal((await returnee.request({ t: 'records.mine' })).t, 'ok');
    const record = await returnee.waitFor('records.latest');
    assert.equal(record.record.ownSeat, 0);
    assert.equal(record.record.players[0].damageSharePct, 90);
  } finally {
    await Promise.all(clients.map((client) => client.terminate()));
    await server?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('account keys are case-insensitive and corrupted databases fail closed', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sp-account-key-'));
  const file = path.join(directory, 'accounts.json');
  try {
    const accounts = new AccountStore(file);
    const first = await accounts.authenticate('Alice', 'strong password', 'register');
    assert.ok(first.account);
    assert.equal((await accounts.authenticate('alice', 'different password', 'register')).error, 'NAME_TAKEN');
    assert.equal((await accounts.authenticate('ALICE', 'strong password', 'login')).account.playerId, first.account.playerId);
    writeFileSync(file, '{broken');
    assert.throws(() => new AccountStore(file));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
