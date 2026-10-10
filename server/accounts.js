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

  save() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, accounts: [...this.byName.values()] }) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temporary, this.file);
  }
}
