import { sendSession } from './net.js';

export class RoomAdmin {
  constructor(lobby) { this.lobby = lobby; }

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
}
