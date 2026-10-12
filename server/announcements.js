import { randomUUID } from 'node:crypto';
import { sendSession } from './net.js';

export class Announcements {
  constructor(lobby) {
    this.lobby = lobby;
    this.pending = new Map();
  }
  publish({ text, delaySeconds = 0 }) {
    if (typeof text !== 'string' || !text.trim() || text.length > 200
      || !Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 86400)
      return { error: 'BAD_REQUEST' };
    if (this.pending.size >= 32) return { error: 'RATE_LIMIT' };
    const id = randomUUID();
    const message = text.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
    const fire = () => {
      this.pending.delete(id);
      for (const session of this.lobby.registry.all())
        sendSession(session, { t: 'server.announcement', id, text: message, time: this.lobby.now() });
      this.lobby.log.info('[admin] announcement sent ' + id);
    };
    if (delaySeconds) {
      const timer = setTimeout(fire, delaySeconds * 1000);
      timer.unref?.();
      this.pending.set(id, timer);
      this.lobby.log.info('[admin] announcement scheduled ' + id);
    } else fire();
    return { ok: true, id };
  }
  cancel(id) {
    if (!this.pending.has(id)) return { error: 'NOT_FOUND' };
    clearTimeout(this.pending.get(id));
    this.pending.delete(id);
    this.lobby.log.info('[admin] announcement cancelled ' + id);
    return { ok: true };
  }
  kick(playerId) {
    const session = this.lobby.registry.byId(playerId);
    const room = session && this.lobby.roomOf(session);
    if (!room) return { error: 'NOT_FOUND' };
    this.lobby.matchmaker.remove(playerId);
    this.lobby.removeMember(room, playerId);
    session.notice = 'kicked';
    sendSession(session, { t: 'room.closed', reason: 'kicked' });
    this.lobby.log.info('[admin] player removed ' + JSON.stringify({ playerId, room: room.code }));
    return { ok: true };
  }
  stop() {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
