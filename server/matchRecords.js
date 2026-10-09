import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const STAT_KEYS = ['dmgDealt', 'bossDamage', 'kills', 'activatedLayers', 'buys', 'refreshes', 'merges', 'itemsEquipped', 'gold', 'perfectRounds', 'leaks', 'lpLost'];
const CODE_RE = /^[A-HJ-NP-Z]{4}$/;

function publicRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    code: record.code,
    matchNo: record.matchNo,
    finishedAt: record.finishedAt,
    mode: record.mode,
    difficulty: record.difficulty,
    victory: record.victory,
    roundsPassed: record.roundsPassed,
    durationMs: record.durationMs,
    players: record.players.map(({ playerId, ...player }) => player),
  };
}

export class MatchRecords {
  constructor(file, log = console) {
    this.file = file;
    this.log = log;
    this.byRoom = new Map();
    this.byPlayer = new Map();
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { this.index(JSON.parse(line)); } catch { log.warn('[records] skipped invalid journal entry'); }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  index(record) {
    if (!record || !CODE_RE.test(record.code) || !Array.isArray(record.players) || !Number.isFinite(record.finishedAt)) throw new Error('invalid record');
    const prior = this.byRoom.get(record.code);
    if (!prior || record.finishedAt >= prior.finishedAt) this.byRoom.set(record.code, record);
    for (const player of record.players) {
      if (!player.playerId || player.isBot) continue;
      const last = this.byPlayer.get(player.playerId);
      if (!last || record.finishedAt >= last.finishedAt) this.byPlayer.set(player.playerId, record);
    }
  }

  save(room, summary, finishedAt = Date.now()) {
    if (!summary || !Array.isArray(summary.players) || !summary.players.length || !CODE_RE.test(room.code)) return null;
    const totalDamage = summary.players.reduce((total, player) => total + Math.max(0, Number(player.stats?.dmgDealt) || 0), 0);
    const record = {
      id: randomUUID(), code: room.code, matchNo: room.matchCount, finishedAt,
      mode: room.mode, difficulty: summary.difficulty || room.difficulty,
      victory: !!summary.victory, roundsPassed: Number(summary.roundsPassed) || 0,
      durationMs: Number(summary.durationMs) || 0,
      players: summary.players.map((player) => ({
        playerId: String(player.playerId || ''), seat: Number(player.seat) || 0,
        name: String(player.name || '').slice(0, 24), isBot: !!player.isBot,
        victory: !!player.victory, roundsPassed: Number(player.roundsPassed) || 0,
        damageSharePct: totalDamage ? Math.round(Math.max(0, Number(player.stats?.dmgDealt) || 0) / totalDamage * 1000) / 10 : 0,
        stats: Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, Number(key === 'buys'
          ? player.stats?.buys ?? (Array.isArray(player.purchases) ? player.purchases.reduce((total, purchase) => total + (Number(purchase?.count) || 0), 0) : 0)
          : player.stats?.[key]) || 0)])),
        bonds: (Array.isArray(player.bonds) ? player.bonds : []).filter((bond) => bond && typeof bond.bondId === 'string')
          .map((bond) => ({ bondId: bond.bondId, name: String(bond.name || bond.bondId).slice(0, 40),
            layers: Math.max(0, Number(bond.layers) || 0), active: !!bond.active })),
        purchases: (Array.isArray(player.purchases) ? player.purchases : []).filter((purchase) => purchase && typeof purchase.id === 'string')
          .map((purchase) => ({ kind: purchase.kind === 'item' ? 'item' : 'chess', id: purchase.id,
            name: String(purchase.name || purchase.id).slice(0, 40), count: Math.max(0, Number(purchase.count) || 0),
            spent: Math.max(0, Number(purchase.spent) || 0), byRound: Object.fromEntries(Object.entries(purchase.byRound || {})
              .filter(([round, count]) => /^\d{1,2}$/.test(round) && Number.isInteger(count) && count > 0)) })),
      })),
    };
    mkdirSync(path.dirname(this.file), { recursive: true });
    appendFileSync(this.file, JSON.stringify(record) + '\n', { encoding: 'utf8', flag: 'a' });
    this.index(record);
    return publicRecord(record);
  }

  latestRoom(code) { return CODE_RE.test(code) ? publicRecord(this.byRoom.get(code)) : null; }

  latestPlayer(playerId) {
    const record = this.byPlayer.get(playerId);
    if (!record) return null;
    return { ...publicRecord(record), ownSeat: record.players.find((player) => player.playerId === playerId)?.seat ?? null };
  }
}
