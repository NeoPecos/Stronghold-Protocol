import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export const accountKey = (name) => name.normalize('NFC').toLowerCase();
export const validPassword = (password) => typeof password === 'string'
  && password.length >= 8 && password.length <= 128 && !/[\u0000-\u001f\u007f]/.test(password);

export class AccountStore {
  constructor(file) {
    this.file = file;
    this.byName = new Map();
    let rows;
    try { rows = JSON.parse(readFileSync(file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      rows = { version: 1, accounts: [] };
    }
    if (rows.version !== 1 || !Array.isArray(rows.accounts)) throw new Error('invalid account database');
    for (const row of rows.accounts) {
      if (!row || typeof row.name !== 'string' || typeof row.playerId !== 'string'
        || typeof row.salt !== 'string' || typeof row.hash !== 'string'
        || !/^[0-9a-f]{32}$/.test(row.salt) || !/^[0-9a-f]{64}$/.test(row.hash)
        || this.byName.has(accountKey(row.name))) throw new Error('invalid account database entry');
      this.byName.set(accountKey(row.name), row);
    }
  }

  get(name) { return this.byName.get(accountKey(name)) || null; }

  async authenticate(name, password, mode) {
    if (!validPassword(password)) return { error: 'WEAK_PASSWORD' };
    const key = accountKey(name);
    const existing = this.byName.get(key);
    if (mode === 'login') {
      if (!existing) return { error: 'BAD_CREDENTIALS' };
      const derived = await scrypt(password, Buffer.from(existing.salt, 'hex'), KEY_LENGTH, PARAMS);
      return timingSafeEqual(derived, Buffer.from(existing.hash, 'hex'))
        ? { account: existing } : { error: 'BAD_CREDENTIALS' };
    }
    if (mode !== 'register') return { error: 'AUTH_REQUIRED' };
    if (existing) return { error: 'NAME_TAKEN' };
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, KEY_LENGTH, PARAMS);
    if (this.byName.has(key)) return { error: 'NAME_TAKEN' };
    const account = { name, playerId: 'p_' + randomBytes(10).toString('hex'), salt: salt.toString('hex'), hash: hash.toString('hex') };
    this.byName.set(key, account);
    try { this.save(); }
    catch (error) { this.byName.delete(key); throw error; }
    return { account };
  }

  /**
   * 改密码：必须提供**旧密码**验证身份（`Authenticate` 的 login 分支），再以同一套 scrypt 参数写入新盐与新哈希。
   *
   * 为什么必须有旧密码：这个入口是给「群里/私聊的机器人代改」用的，若只凭账号名就能改，任何知道昵称的人都能
   * 顶掉别人的账号。旧密码是这里唯一的持有证明（同 DESIGN 的登录语义）；忘记密码只能由维护者直接改库。
   *
   * 失败一律返回 `{ error }`，不改动任何状态；`save()` 失败时把内存里的旧值放回去，避免内存与磁盘不一致。
   * @param {string} name
   * @param {string} oldPassword
   * @param {string} newPassword
   * @returns {Promise<{ account?: object, error?: 'BAD_CREDENTIALS'|'WEAK_PASSWORD'|'SAME_PASSWORD'>}
   */
  async changePassword(name, oldPassword, newPassword) {
    if (!validPassword(newPassword)) return { error: 'WEAK_PASSWORD' };
    if (oldPassword === newPassword) return { error: 'SAME_PASSWORD' };
    const key = accountKey(name);
    const existing = this.byName.get(key);
    if (!existing) return { error: 'BAD_CREDENTIALS' };
    if (!validPassword(oldPassword)) return { error: 'BAD_CREDENTIALS' };
    const derivedOld = await scrypt(oldPassword, Buffer.from(existing.salt, 'hex'), KEY_LENGTH, PARAMS);
    if (!timingSafeEqual(derivedOld, Buffer.from(existing.hash, 'hex'))) return { error: 'BAD_CREDENTIALS' };
    const salt = randomBytes(16);
    const hash = await scrypt(newPassword, salt, KEY_LENGTH, PARAMS);
    const updated = { ...existing, salt: salt.toString('hex'), hash: hash.toString('hex') };
    this.byName.set(key, updated);
    try { this.save(); }
    catch (error) { this.byName.set(key, existing); throw error; }
    return { account: updated };
  }

  save() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, accounts: [...this.byName.values()] }) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temporary, this.file);
  }
}
