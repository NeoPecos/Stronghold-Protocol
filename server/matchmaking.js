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
      const room = [...this.lobby.rooms.values()].find(candidate => !candidate.disposed && !candidate.match
        && candidate.mode === 'coop' && !candidate.inviteOnly && candidate.recruitWanted
        && candidate.difficulty === entry.difficulty && candidate.freeSeat() >= 0
        && this.lobby.registry.byId(candidate.hostId)?.connected);
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
