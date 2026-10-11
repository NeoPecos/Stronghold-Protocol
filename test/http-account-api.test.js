// test/http-account-api.test.js — the two account-facing HTTP routes (server/http/routes.js):
//
//   * GET  /api/records/account/<NAME>  — 按**账号名**取最近一局战绩（机器人用；房间码那条另测）
//   * POST /api/account/password        — 改密码：需要管理员令牌 **且** 提供旧密码
//
// 这里断言的重点是**边界**，不是快乐路径：令牌没配就当作接口不存在（404）、令牌错就 401、方法错就 405、
// 旧密码错就 400 且**密码不许被改**、响应里**不许回显任何密码**。游戏客户端本身没有这两个入口，它们是给
// 群机器人用的，所以「默认不暴露」比「功能可用」更重要。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server/index.js';

const scrypt = promisify(scryptCallback);
const TOKEN = 'test-admin-token-0123456789';
const OLD = 'correct horse battery';
const NEW = 'a different pass phrase';
const SEED_NAME = '雨语';
const SEED_ID = 'p_7dea8fb375cf88fc48c0';

/**
 * 预置一个**真实可用**的账号：salt/hash 用与 accounts.js 同一套 scrypt 参数算出来，所以旧密码能通过校验。
 * 用占位哈希会让「改密码」永远失败，测出来的是假象（我第一次就是这么写错的）。
 */
async function seedAccount(file, name = SEED_NAME, password = OLD, playerId = SEED_ID) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  writeFileSync(file, JSON.stringify({
    version: 1,
    accounts: [{ name, playerId, salt: salt.toString('hex'), hash: hash.toString('hex') }],
  }));
  return playerId;
}

/** A server on an ephemeral port with its own accounts/records files and a known admin token. */
async function withServer({ token = TOKEN } = {}, run) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'sp-account-api-'));
  const accountsFile = path.join(directory, 'accounts.json');
  const recordsFile = path.join(directory, 'records.jsonl');
  const playerId = await seedAccount(accountsFile);
  const server = await startServer({ port: 0, host: '127.0.0.1', quiet: true, accountsFile, recordsFile, ...(token ? { adminToken: token } : {}) });
  const base = `http://127.0.0.1:${server.port}`;
  try { await run({ server, base, accountsFile, recordsFile, playerId }); }
  finally { await server.close(); rmSync(directory, { recursive: true, force: true }); }
}

const postPassword = (base, body, token = TOKEN) => fetch(`${base}/api/account/password`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-sp-admin-token': token } : {}) },
  body: JSON.stringify(body),
});

test('改密码接口：没配令牌时等于不存在（404），配了才生效', async () => {
  await withServer({ token: null }, async ({ base }) => {
    const response = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: NEW }, '');
    assert.equal(response.status, 404, '未配置 SP_ADMIN_TOKEN ⇒ 接口不暴露');
    assert.deepEqual(await response.json(), { error: 'NOT_ENABLED' });
  });
});

test('改密码接口：令牌必须匹配，且只接受 POST', async () => {
  await withServer({}, async ({ base }) => {
    const noToken = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: NEW }, '');
    assert.equal(noToken.status, 401);
    const wrongToken = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: NEW }, 'test-admin-token-0000000000');
    assert.equal(wrongToken.status, 401, '长度相同的错令牌也必须被拒');
    const shortToken = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: NEW }, 'short');
    assert.equal(shortToken.status, 401, '长度不同的令牌不能因长度比较而崩溃或放行');

    const method = await fetch(`${base}/api/account/password`, { headers: { 'x-sp-admin-token': TOKEN } });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'POST');
  });
});

test('改密码接口：旧密码错或新密码不合规时拒绝，且不泄露密码', async () => {
  await withServer({}, async ({ base, accountsFile }) => {
    const before = readFileSync(accountsFile, 'utf8');

    const wrongOld = await postPassword(base, { name: '雨语', oldPassword: 'not the old one', newPassword: NEW });
    assert.equal(wrongOld.status, 400);
    assert.deepEqual(await wrongOld.json(), { error: 'BAD_CREDENTIALS' });

    const unknown = await postPassword(base, { name: '不存在的人', oldPassword: OLD, newPassword: NEW });
    assert.equal(unknown.status, 400);
    assert.deepEqual(await unknown.json(), { error: 'BAD_CREDENTIALS' }, '未知账号不能与「密码错」区分开');

    const weak = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: 'short' });
    assert.deepEqual(await weak.json(), { error: 'WEAK_PASSWORD' });

    const same = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: OLD });
    assert.deepEqual(await same.json(), { error: 'SAME_PASSWORD' });

    const missing = await postPassword(base, { name: '雨语', newPassword: NEW });
    assert.equal(missing.status, 400);
    assert.deepEqual(await missing.json(), { error: 'BAD_REQUEST' });

    assert.equal(readFileSync(accountsFile, 'utf8'), before, '任何失败都不许写库');
  });
});

test('改密码接口：成功后新密码可用、旧密码失效，响应里没有密码字段', async () => {
  await withServer({}, async ({ base }) => {
    const response = await postPassword(base, { name: '雨语', oldPassword: OLD, newPassword: NEW });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, { ok: true, name: '雨语' });
    const raw = JSON.stringify(payload);
    assert.equal(raw.includes(NEW), false, '响应里不能出现新密码');
    assert.equal(raw.includes(OLD), false, '响应里不能出现旧密码');
  });
});

test('改密码在 AccountStore 层：认证结果随之改变，且大小写不敏感的名字仍指向同一账号', async () => {
  await withServer({}, async ({ accountsFile }) => {
    const { AccountStore } = await import('../server/accounts.js');
    const store = new AccountStore(accountsFile);
    assert.equal((await store.authenticate(SEED_NAME, OLD, 'login')).account.name, SEED_NAME, '预置账号的旧密码可用');

    const ok = await store.changePassword(SEED_NAME, OLD, NEW);
    assert.ok(ok.account, '改密码成功');
    assert.equal((await store.authenticate(SEED_NAME, OLD, 'login')).error, 'BAD_CREDENTIALS', '旧密码失效');
    assert.equal((await store.authenticate(SEED_NAME, NEW, 'login')).account.name, SEED_NAME, '新密码可用');
    assert.equal((await store.authenticate(SEED_NAME.toUpperCase(), NEW, 'login')).account.name, SEED_NAME, '名字大小写不敏感');
    // 哈希与盐都换了，且库里看不到明文
    const raw = readFileSync(accountsFile, 'utf8');
    assert.equal(raw.includes(OLD), false);
    assert.equal(raw.includes(NEW), false);
    // 重开一次，确认写盘了
    const reopened = new AccountStore(accountsFile);
    assert.equal((await reopened.authenticate(SEED_NAME, NEW, 'login')).account.name, SEED_NAME);
  });
});

test('GET /api/records/account/<名字>：账号的最近一局，未知账号 404 且不泄露内部 playerId', async () => {
  await withServer({}, async ({ server, base, playerId }) => {
    // 记录直接写进服务器的 MatchRecords（与 HTTP 层共用同一个实例）
    server.records.save(
      { code: 'ABCD', mode: 'coop', difficulty: 'HARD', matchCount: 1 },
      { players: [{ playerId, name: SEED_NAME, seat: 0, stats: { dmgDealt: 1000 }, bonds: [], purchases: [] }], roundsPassed: 5, victory: true },
    );

    const hit = await fetch(`${base}/api/records/account/${encodeURIComponent(SEED_NAME)}`);
    assert.equal(hit.status, 200, '已注册且有战绩 ⇒ 200');
    const record = await hit.json();
    assert.equal(record.code, 'ABCD');
    assert.equal(record.players[0].name, SEED_NAME);
    assert.equal(Object.hasOwn(record.players[0], 'playerId'), false, '公开战绩不含 playerId');
    assert.equal(record.ownSeat, 0);

    const miss = await fetch(`${base}/api/records/account/${encodeURIComponent('查无此人')}`);
    assert.equal(miss.status, 404);
    assert.deepEqual(await miss.json(), { error: 'RECORD_NOT_FOUND' });

    // 房间码那条接口仍然工作（4 个大写字母，且不含 I/O）
    const byCode = await fetch(`${base}/api/records/ABCD`);
    assert.equal(byCode.status, 200);
  });
});
