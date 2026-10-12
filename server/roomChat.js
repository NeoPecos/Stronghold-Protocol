import { ERR } from '../shared/constants.js';
import { sendSession } from './net.js';

export function createRoomChat(lobby) {
  const histories = new WeakMap();
  const limits = new WeakMap();
  function member(session, code) {
    const room = lobby.roomOf(session);
    return lobby.opts.roomChat && room?.mode === 'coop' && room.code === code && !room.disposed ? room : null;
  }
  function limited(session, kind) {
    const now = lobby.now();
    const state = limits.get(session) || {};
    if (now - (state[kind] ?? -Infinity) < 1000) return true;
    state[kind] = now;
    limits.set(session, state);
    return false;
  }
  return {
    send(session, msg) {
      const room = member(session, msg.code);
      if (!room) return { error: ERR.NOT_IN_ROOM };
      const text = typeof msg.text === 'string' ? msg.text.replace(/[\x00-\x1f\x7f]/g, ' ').trim() : '';
      if (!text || text.length > 200) return { error: ERR.BAD_MSG };
      if (limited(session, 'send')) return { error: ERR.RATE };
      const state = histories.get(room) || { sequence: 0, messages: [] };
      const seat = room.seatOf(session.playerId) || room.spectatorOf(session.playerId);
      const message = { t: 'room.chat', code: room.code, id: ++state.sequence,
        playerId: session.playerId, name: seat.name, text, time: lobby.now() };
      state.messages.push(message);
      if (state.messages.length > 80) state.messages.shift();
      histories.set(room, state);
      lobby.broadcastRoom(room, message);
      return { ok: true };
    },
    history(session, msg) {
      const room = member(session, msg.code);
      if (!room) return { error: ERR.NOT_IN_ROOM };
      if (limited(session, 'history')) return { error: ERR.RATE };
      sendSession(session, { t: 'room.chat.history', code: room.code, messages: histories.get(room)?.messages || [] });
      return { ok: true };
    },
  };
}
