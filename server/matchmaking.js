import { ERR, MAX_SEATS } from '../shared/constants.js';
import { sendSession } from './net.js';

export class Matchmaker {
  constructor(lobby) {
    this.lobby = lobby;
    this.queue = new Map();
    this.timer = null;
    this.lastSnapshot = '';
    this.requests = new WeakMap();
  }
  status(session) {
    const entry = this.queue.get(session.playerId);
    sendSession(session, { t: 'match.status', queued: !!entry, difficulty: entry?.difficulty ?? null,
      players: entry ? [...this.queue.values()].filter(other => other.difficulty === entry.difficulty).length : 0,
      target: MAX_SEATS, since: entry?.since ?? null });
    return { ok: true };
  }
  enqueue(session, { difficulty }) {
    if (!this.lobby.opts.matchmaking) return { error: ERR.BAD_MSG };
    if (!session.connected) return { error: ERR.BAD_MSG };
    if (this.lobby.roomOf(session)) return { error: ERR.ALREADY };
    const now = this.lobby.now();
    if (now - (this.requests.get(session) ?? -Infinity) < 1000) return { error: ERR.RATE };
    this.requests.set(session, now);
    if (!this.queue.has(session.playerId) && this.queue.size >= 1000) return { error: ERR.RATE };
    const previous = this.queue.get(session.playerId);
    this.queue.set(session.playerId, { session, difficulty,
      since: previous?.difficulty === difficulty ? previous.since : this.lobby.now() });
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), 1000);
      this.timer.unref?.();
    }
    this.tick();
    this.broadcast();
    this.status(session);
    return { ok: true };
  }
  remove(playerId) {
    const entry = this.queue.get(playerId);
    if (!entry) return { ok: true };
    this.queue.delete(playerId);
    this.status(entry.session);
    this.broadcast();
    return { ok: true };
  }
  broadcast() {
    if (!this.queue.size && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const snapshot = [...this.queue].map(([playerId, entry]) => playerId + ':' + entry.difficulty).join('|');
    if (snapshot === this.lastSnapshot) return;
    this.lastSnapshot = snapshot;
    for (const entry of this.queue.values()) this.status(entry.session);
  }
  tick() {
    for (const [playerId, entry] of this.queue) {
      if (!entry.session.connected || this.lobby.roomOf(entry.session) || this.lobby.now() - entry.since > 600_000)
        this.remove(playerId);
    }
    for (const [playerId, entry] of this.queue) {
      // 候选房间：没在打、同盟模式、没开「仅邀请」、难度一致、有空位、房主在线。
      // 「仅邀请」是硬门（维护者 m01061）：关着时路人既能在房间列表点「加入同盟」进来，也能被匹配进来；开着时两样都不行。
      const candidates = [...this.lobby.rooms.values()].filter(candidate => !candidate.disposed && !candidate.match
        && candidate.mode === 'coop' && !candidate.inviteOnly
        && candidate.difficulty === entry.difficulty && candidate.freeSeat() >= 0
        && this.lobby.registry.byId(candidate.hostId)?.connected);
      // 开了「期望路人加入」的房间优先被匹配；同一优先级的房间按建房顺序取（rooms 是 Map，迭代顺序即创建顺序）。
      const room = candidates.find(candidate => candidate.recruitWanted) ?? candidates[0];
      if (!room) continue;
      const joined = this.lobby.join(entry.session, { code: room.code });
      if (joined.error) continue;
      this.queue.delete(playerId);
      this.found(entry, room.code);
    }
    const groups = new Map();
    for (const entry of this.queue.values()) {
      if (!groups.has(entry.difficulty)) groups.set(entry.difficulty, []);
      groups.get(entry.difficulty).push(entry);
    }
    for (const group of groups.values()) {
      while (group.length >= MAX_SEATS) {
        const members = group.splice(0, MAX_SEATS);
        const host = members[0];
        const created = this.lobby.create(host.session, { mode: 'coop', difficulty: host.difficulty });
        if (created.error) {
          this.queue.delete(host.session.playerId);
          this.status(host.session);
          continue;
        }
        const code = host.session.roomCode;
        for (const entry of members) {
          const joined = entry === host ? created : this.lobby.join(entry.session, { code });
          if (joined.error) continue;
          this.queue.delete(entry.session.playerId);
          this.found(entry, code);
        }
      }
    }
    this.broadcast();
  }
  found(entry, code) {
    this.status(entry.session);
    sendSession(entry.session, { t: 'match.found', code });
  }
  stop() {
    const members = [...this.queue.values()];
    this.queue.clear();
    clearInterval(this.timer);
    this.timer = null;
    for (const entry of members) this.status(entry.session);
  }
}
