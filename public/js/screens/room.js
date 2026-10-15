// Room screen (同盟等待室): 4 seat cards (avatar frame, name, ready state, AI badge, host crown),
// host controls (difficulty picker, add/remove AI and the 「AI 队友最后选择」 switch in co-op, start), invite code with
// copy code / copy link, ready toggle and leave.
//
// Start rule (server/lobby.js): room.start needs every *other* human connected and ready; the
// host's start counts as the host's ready. So 开始模拟 is enabled exactly then and sends room.start
// alone (no separate room.ready round trip that could leave the host "ready" after a failed start).
// Solo rooms show a single seat.
// Spectator seats (community report #26, a remake feature): a co-op room with spectators shows the 观战席 strip under
// the seats — names, offline marks, the host's ✕ (room.removeSpectator) — and a spectator's own view swaps the ready
// button for 观战中 and offers 入座 (room.join of the room) while a player seat is free.
// Texts go through t() (docs/I18N.md).

import { useEffect, useRef, useState } from '../../vendor/hooks.module.js';
import { DIFFICULTIES, DIFFICULTY_NAMES, DIFFICULTY_COLORS, MAX_SEATS, BASE_SEATS, ROOM_CAPACITIES, MAX_SPECTATORS } from '../../../shared/constants.js';
import {
  html, Button, Icon, MicroLabel, PingPill, AvatarFrame, DifficultyTag, DifficultyIcon, Tooltip, confirmDialog, doctorNo,
} from '../ui/components.js';
import { toast, toastError } from '../ui/toasts.js';
import { copyText } from '../ui/clipboard.js';
import { GuideButton } from '../ui/guide.js';
import { openStats } from './stats.js';
import { SettingsButton } from '../ui/settings.js';
import { LoadoutButton } from './loadout.js';
import { MatchRecordsButton } from './records.js';
import { avatarUrl } from '../ui/avatar.js';
import { net } from '../net.js';
import { store, useStore, shallowEqual, emptyMatch, isSpectating } from '../store.js';
import { difficultyInfo } from './lobby.js';
import { data, useData } from '../data.js';
import { N_, t, tc } from '../../../shared/i18n.js';
import { roomGroupMembers, uniteHelperLimit, uniteHelperOptions, uniteTimeBonus } from '../../../shared/playerCapacity.js';

/**
 * Seats padded to the room's capacity (co-op 4–20, solo 1), each null or a seat record.
 * @param {any} room room.state payload
 * @returns {(null | {seat:number, playerId:any, name:string, isBot:boolean, ready:boolean, connected:boolean})[]}
 */
export function normalizeSeats(room) {
  const cap = room?.mode === 'solo'
    ? 1
    : (Number.isInteger(room?.capacity) && room.capacity > 0 ? room.capacity : BASE_SEATS);
  const src = Array.isArray(room?.seats) ? room.seats : [];
  const out = [];
  for (let i = 0; i < cap; i++) {
    const s = src[i];
    out.push(s && typeof s === 'object' ? { ...s, seat: Number.isInteger(s.seat) ? s.seat : i } : null);
  }
  return out;
}

/**
 * Derived room facts for the local player.
 * @param {any} room
 * @param {any} myId
 */
export function roomFacts(room, myId) {
  const seats = normalizeSeats(room);
  const occupied = seats.filter(Boolean);
  const humans = occupied.filter((s) => !s.isBot);
  const mine = occupied.find((s) => s.playerId === myId) || null;
  const isHost = room?.hostId != null && room.hostId === myId;
  const others = humans.filter((s) => s.playerId !== myId);
  // The host never readies: starting the match is the host's ready (server rule), so the count
  // treats the host as ready — "已就绪 0/1" next to "准许进入模拟" would contradict itself.
  const isReady = (s) => !!s.ready || s.playerId === room?.hostId;
  const readyHumans = humans.filter(isReady).length;
  const othersReady = others.every((s) => s.ready && s.connected !== false);
  return {
    seats, occupied, humans, mine, isHost, readyHumans, isReady,
    emptySeats: seats.filter((s) => !s).length,
    canStart: isHost && othersReady && !!mine,
    othersReady,
    // spectator seats (never players: not in `humans`, never counted for ready / start)
    spectators: Array.isArray(room?.spectators) ? room.spectators.filter((s) => s && typeof s === 'object') : [],
    spectating: isSpectating(room, myId),
  };
}

/**
 * The co-op room option 「AI 队友最后选择」 (GitHub #338; room.setAiPicksLast, room.state.aiPicksLast): in the strategy and
 * 机变 drafts every human picks before the AI teammates. null in a solo room (no AI teammates); otherwise its state (off
 * when the server sends none) and whether this player may switch it — the host only, the others see it read-only.
 * @param {any} room room.state payload
 * @param {any} myId
 * @returns {{ on: boolean, editable: boolean } | null}
 */
export function aiLastOption(room, myId) {
  if (!room || room.mode === 'solo') return null;
  return { on: room.aiPicksLast === true, editable: room.hostId != null && room.hostId === myId };
}

export function roomAccessOptions(room, myId) {
  if (!room || room.mode === 'solo') return null;
  return {
    inviteOnly: room.inviteOnly === true,
    recruitWanted: room.recruitWanted === true,
    allowSpectators: room.allowSpectators !== false,
    editable: room.hostId != null && room.hostId === myId,
  };
}

/** Invite link for a room code (current page URL with ?room=CODE). */
export function inviteLink(code) {
  const loc = globalThis.location;
  const base = loc ? `${loc.origin}${loc.pathname}` : '';
  return `${base}?room=${encodeURIComponent(code)}`;
}

/**
 * Copy text to the clipboard (async API with a textarea fallback for insecure contexts). Moved to ui/clipboard.js so
 * 干员调配 can use it without importing this screen (which imports loadout.js): re-exported here for existing callers.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export { copyText };

function SeatCard({ seat, index, room, facts, myId, busy, groups, groupIndex, onMoveGroup, onAddBot, onRemoveBot, onKick }) {
  const coop = room.mode !== 'solo';
  if (!seat) {
    const canAdd = coop && facts.isHost;
    const defaultGroup = coop ? Math.floor(index / BASE_SEATS) : -1;
    return html`<article class="seat seat--empty" style=${`--seat-i:${index}`} data-group=${defaultGroup >= 0 ? defaultGroup : undefined}>
      <header class="seat__head"><span class="seat__no num">P${index + 1}</span><${MicroLabel}>SEAT ${String(index + 1).padStart(2, '0')}<//>
        ${defaultGroup >= 0 ? html`<span class="seat__group-tag">${t('第 {number} 组', { number: defaultGroup + 1 })}</span>` : null}</header>
      <div class="seat__art seat__art--empty">
        <div class="seat__radar" aria-hidden="true"></div>
        <span class="seat__wait">${t('等待博士加入')}</span>
        <${MicroLabel}>AWAITING DOCTOR<//>
      </div>
      <footer class="seat__foot">
        ${canAdd
          ? html`<${Button} variant="secondary" size="sm" icon="robot" block=${true} loading=${busy === `add`} onClick=${onAddBot}>${t('添加 AI 队友')}<//>`
          : html`<span class="seat__state t-dim">${t('空位')}</span>`}
      </footer>
    </article>`;
  }
  const isMe = seat.playerId === myId;
  const isHostSeat = seat.playerId === room.hostId;
  const offline = seat.connected === false && !seat.isBot;
  // The host never needs to toggle ready: starting the match readies them (server rule).
  const state = offline ? 'offline' : seat.ready || seat.isBot ? 'ready' : isHostSeat ? 'host' : 'waiting';
  return html`<article class=${`seat brackets${isMe ? ' is-me' : ''}${isHostSeat ? ' is-host' : ''}${seat.isBot ? ' is-bot' : ''} is-${state}`}
      style=${`--seat-i:${index}`} data-group=${groupIndex}>
    <header class="seat__head">
      <span class="seat__no num">P${index + 1}</span>
      <${MicroLabel}>SEAT ${String(index + 1).padStart(2, '0')}<//>
      ${groupIndex >= 0 ? isMe && groups.length > 1 ? html`<select class="seat__group-select" aria-label=${t('分组')}
        value=${String(groupIndex)} disabled=${!!busy || !!room.inMatch}
        onChange=${(event) => onMoveGroup(Number(event.target.value))}>
        ${groups.map((members, candidate) => html`<option key=${candidate} value=${candidate}
          disabled=${candidate !== groupIndex && members.length >= 4}>
          ${t('第 {number} 组', { number: candidate + 1 })}${candidate !== groupIndex && members.length >= 4 ? ` · ${t('已满员')}` : ''}
        </option>`)}
      </select>` : html`<span class="seat__group-tag">${t('第 {number} 组', { number: groupIndex + 1 })}</span>` : null}
      ${isHostSeat ? html`<span class="seat__host"><${Icon} name="crown" />${t('创建者')}</span>` : null}
    </header>
    <div class="seat__art">
      <div class="seat__stripes" aria-hidden="true"></div>
      <${AvatarFrame} size="xl" name=${seat.name} src=${avatarUrl(seat.avatar)} seat=${index} bot=${seat.isBot} self=${isMe} ready=${state === 'ready'} offline=${offline} />
      ${seat.isBot ? html`<span class="seat__bot-label"><${Icon} name="robot" />${t('AI 队友')}</span>` : null}
    </div>
    <div class="seat__who">
      <span class="seat__name">${seat.name || t('博士')}</span>
      ${isMe ? html`<span class="seat__you">${t('你')}</span>` : null}
    </div>
    <${MicroLabel}>${seat.isBot ? 'AUTONOMOUS UNIT' : `DOCTOR #${doctorNo(seat.playerId)}`}<//>
    <footer class="seat__foot">
      <span class=${`seat__state seat__state--${state}`}>
        ${state === 'ready' ? html`<${Icon} name="check" />${t('已就绪')}`
          : state === 'offline' ? html`<${Icon} name="wifiOff" />${t('连接中断')}`
          : state === 'host' ? html`<${Icon} name="crown" />${t('待命中')}`
          : html`<${Icon} name="hourglass" />${t('准备中')}`}
      </span>
      ${seat.isBot && facts.isHost ? html`<${Tooltip} text=${t('移除该 AI 队友')}>
        <${Button} variant="ghost" size="sm" square=${true} icon="close" loading=${busy === `rm${index}`} onClick=${() => onRemoveBot(index)} aria-label=${t('移除 AI 队友')} />
      <//>` : null}
      ${!seat.isBot && !isMe && facts.isHost ? html`<${Tooltip} text=${t('将该博士移出同盟')}>
        <${Button} variant="ghost" size="sm" icon="close" loading=${busy === `kick${index}`} onClick=${() => onKick(index, seat.name, seat.playerId)} aria-label=${t('移出该博士')}>${t('移出')}<//>
      <//>` : null}
    </footer>
  </article>`;
}

/** 观战席: the room's spectators (host: ✕ frees a seat), and 入座 for a spectator while a player seat is free. */
function SpectatorBar({ facts, myId, busy, onRemove, onSit }) {
  if (!facts.spectators.length) return null;
  return html`<section class="specbar" aria-label=${t('观战席')}>
    <span class="specbar__label"><${Icon} name="eye" />${t('观战席')}<b class="num">${facts.spectators.length}</b><span class="num t-dim">/${MAX_SPECTATORS}</span></span>
    ${facts.spectators.map((s) => html`<span key=${s.playerId} class=${`specbar__who${s.playerId === myId ? ' is-me' : ''}${s.connected === false ? ' is-offline' : ''}`}>
      ${s.connected === false ? html`<${Icon} name="wifiOff" />` : null}${s.name || t('博士')}${s.playerId === myId ? html`<span class="seat__you">${t('你')}</span>` : null}
      ${facts.isHost ? html`<${Button} variant="ghost" size="sm" square=${true} icon="close" loading=${busy === `rs${s.playerId}`}
        onClick=${() => onRemove(s.playerId)} aria-label=${t('移出观战者 {name}', { name: s.name || '' })} title=${t('移出该观战者')} />` : null}
    </span>`)}
    ${facts.spectating && facts.emptySeats > 0 ? html`<${Button} size="sm" icon="user" loading=${busy === 'sit'} onClick=${onSit}>${t('入座')}<//>` : null}
  </section>`;
}

function InviteBox({ code, name, difficulty }) {
  const copy = async (what) => {
    // the copied link carries an invitation line (#103): 「{name}邀请你加入卫戍协议：盟约【{difficulty}】」
    const invite = t('{name}邀请你加入卫戍协议：盟约【{difficulty}】', { name: name ?? '', difficulty: DIFFICULTY_NAMES[difficulty] ? t(DIFFICULTY_NAMES[difficulty]) : '' });
    const ok = await copyText(what === 'code' ? code : `${inviteLink(code)} ${invite}`);
    if (ok) toast(what === 'code' ? t('已复制同盟密钥 {code}', { code }) : t('已复制邀请链接'), 'success');
    else toast(t('复制失败，请手动复制'), 'warn');
  };
  return html`<div class="invite brackets">
    <div class="invite__label"><${Icon} name="key" /><span>${t('同盟密钥')}</span><${MicroLabel}>ALLIANCE KEY<//></div>
    <div class="invite__code num selectable" aria-label=${t('同盟密钥 {code}', { code })}>${[...String(code)].map((ch, i) => html`<span key=${i}>${ch}</span>`)}</div>
    <div class="invite__btns">
      <${Button} size="sm" icon="copy" onClick=${() => copy('code')}>${t('复制密钥')}<//>
      <${Button} size="sm" icon="link" onClick=${() => copy('link')}>${t('复制链接')}<//>
    </div>
  </div>`;
}

function DifficultyPicker({ room, isHost, busy, onPick }) {
  if (!isHost) {
    return html`<div class="dpick dpick--ro">
      <${DifficultyTag} difficulty=${room.difficulty} size="lg" code=${difficultyInfo(room.mode, room.difficulty).code} />
      <span class="t-dim">${t('由创建者选择')}</span>
    </div>`;
  }
  return html`<div class="dpick" role="radiogroup" aria-label=${t('模拟难度')}>
    ${DIFFICULTIES.map((d) => html`<button key=${d} type="button" role="radio" aria-checked=${room.difficulty === d ? 'true' : 'false'}
        class=${`dpick__opt${room.difficulty === d ? ' is-active' : ''}`} style=${`--d-color:${DIFFICULTY_COLORS[d]}`}
        disabled=${!!busy} onClick=${() => room.difficulty !== d && onPick(d)}>
      <${DifficultyIcon} difficulty=${d} />${t(DIFFICULTY_NAMES[d].replace('模拟', ''))}
    </button>`)}
  </div>`;
}

/** The 「AI 队友最后选择」 switch (co-op): the host toggles it, everybody else sees its state. */
function AiLastToggle({ option, busy, onToggle }) {
  if (!option) return null;
  return html`<div class="ailast">
    <${Tooltip} text=${t('策略与机变轮选时，所有博士先于 AI 队友选择')}>
      <button type="button" role="switch" aria-checked=${option.on ? 'true' : 'false'}
          class=${`dpick__opt ailast__opt${option.on ? ' is-active' : ''}`} disabled=${!option.editable || !!busy}
          onClick=${() => option.editable && onToggle(!option.on)}>
        <${Icon} name="check" class=${option.on ? 'is-on' : ''} />${t('AI 队友最后选择')}
      </button>
    <//>
    ${option.editable ? null : html`<span class="t-dim">${t('由创建者设置')}</span>`}
  </div>`;
}

function RoomAccessOptions({ option, busy, onInviteOnly, onRecruitWanted, onAllowSpectators }) {
  if (!option) return null;
  // 「仅邀请」是硬门（维护者 m01061）：开着时房间不进大厅列表、也不会被最快匹配；关着时路人既能在列表里点
  // 「加入同盟」进来，也能被匹配进来。「期望路人加入」不是门，只是优先级：开着时最快匹配优先挑它
  // （server/matchmaking.js:62-70），同优先级里越早创建的房间越优先。
  const toggle = (name, on, art, action) => html`<button type="button" role="switch" aria-checked=${on ? 'true' : 'false'}
      class=${`room-access__toggle${on ? ' is-active' : ''}`} disabled=${!option.editable || !!busy}
      onClick=${() => option.editable && action(!on)}>
    <span class="room-access__icon">${art ? html`<img src=${`/assets/ui/room/${art}.png`} alt="" aria-hidden="true" draggable=${false} />` : html`<${Icon} name="eye" />`}</span>
    <span><strong>${t(name)}</strong><small>${on ? t('已开启') : t('已关闭')}</small></span>
    <span class="room-access__switch" aria-hidden="true"></span>
  </button>`;
  return html`<aside class="room-access-options brackets" aria-label=${t('房间设置')}>
    <${MicroLabel} tone="mint">ROOM ACCESS<//>
    ${toggle(N_('仅邀请'), option.inviteOnly, 'invite-only', onInviteOnly)}
    ${toggle(N_('期望路人加入'), option.recruitWanted, 'recruit-wanted', onRecruitWanted)}
    ${toggle(N_('允许观战'), option.allowSpectators, null, onAllowSpectators)}
    ${option.editable ? null : html`<span class="room-access__readonly">${t('由创建者设置')}</span>`}
  </aside>`;
}

/** Room screen component. */
export function RoomScreen() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me, shallowEqual);
  const conn = useStore((s) => s.connection, shallowEqual);
  const [busy, setBusy] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const alive = useRef(true);
  const inFlight = useRef(false); // synchronous guard against double clicks (state updates are async)
  useEffect(() => () => { alive.current = false; }, []);

  if (!room) return null;
  const online = conn.status === 'online';
  const coop = room.mode !== 'solo';
  const facts = roomFacts(room, me.playerId);
  const myReady = !!facts.mine?.ready;
  const info = difficultyInfo(room.mode, room.difficulty);

  const run = async (kind, fn) => {
    if (inFlight.current) return;
    if (!online) { toast(t('连接中断，请稍候重试'), 'warn'); return; }
    inFlight.current = true;
    setBusy(kind);
    try { await fn(); } catch (err) { toastError(err); } finally {
      inFlight.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const toggleReady = () => run('ready', () => net.request('room.ready', { ready: !myReady }));
  const start = () => run('start', () => net.request('room.start', {}));
  const addBot = () => run('add', () => net.request('room.addBot', {}));
  const removeBot = (seat) => run(`rm${seat}`, () => net.request('room.removeBot', { seat }));
  // the host removes a human before the match (community report #17): asked first; the player may join again. The
  // confirmed player's id goes along: if they left and someone else took the seat meanwhile, the server refuses it.
  const kick = async (seat, name, playerId) => {
    if (inFlight.current) return;
    const ok = await confirmDialog({ title: t('移出同盟'), text: t('确定将「{name}」移出同盟吗？对方可以凭同盟密钥重新加入。', { name: name || t('博士') }), okText: t('移出'), danger: true });
    if (ok) run(`kick${seat}`, () => net.request('room.kick', { seat, playerId }));
  };
  const setDifficulty = (difficulty) => run('diff', () => net.request('room.setDifficulty', { difficulty }));
  const setAiLast = (on) => run('ailast', () => net.request('room.setAiPicksLast', { on }));
  const setUniteHelpers = (helpers) => run('uniteHelpers', () => net.request('room.setUniteHelpers', { helpers }));
  const moveGroup = (groupIndex) => run('groups', () => net.request('room.moveGroup', { groupIndex }));
  const swapGroupMembers = (firstId, secondId) => run('groups', () => net.request('room.swapGroupMembers', { firstId, secondId }));
  const setBotBand = (seat, playerId, bandId) => run('botBand', () => net.request('room.setBotBand', { seat, playerId, bandId }));
  const setInviteOnly = (on) => run('inviteOnly', () => net.request('room.setInviteOnly', { on }));
  const setRecruitWanted = (on) => run('recruitWanted', () => net.request('room.setRecruitWanted', { on }));
  const setAllowSpectators = (on) => run('allowSpectators', () => net.request('room.setAllowSpectators', { on }));
  // 同盟人数上限（20 人分支）：房主可调；服务端 room.setCapacity 校验档位与已占席位。
  const setCapacity = (capacity) => run('capacity', () => net.request('room.setCapacity', { capacity }));
  // spectator seats: the host frees one; a spectator takes a free player seat with room.join of this room
  const removeSpectator = (playerId) => run(`rs${playerId}`, () => net.request('room.removeSpectator', { playerId }));
  const sit = () => run('sit', () => net.request('room.join', { code: room.code }));
  const leave = async () => {
    if (inFlight.current) return;
    const othersHere = facts.humans.some((s) => s.playerId !== me.playerId);
    if (facts.isHost && othersHere) {
      const ok = await confirmDialog({ title: t('离开同盟'), text: t('你是同盟的创建者，离开后创建者身份将移交或同盟解散。确定离开吗？'), okText: t('离开'), danger: true });
      if (!ok) return;
    }
    inFlight.current = true;
    setBusy('leave');
    try {
      await net.request('room.leave', {});
    } catch (err) {
      if (err?.code !== 'NOT_IN_ROOM') toastError(err);
    } finally {
      // Leaving locally is always safe: the server either confirmed or no longer has us in the room.
      store.set({ room: null, match: emptyMatch() });
      inFlight.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const statusLine = !online
    ? html`<span class="t-orange"><${Icon} name="wifiOff" />${t('连接中断，正在重连…')}</span>`
    : facts.spectating
      ? html`<span class="t-lo"><${Icon} name="eye" />${t('观战中 · 不占博士席位，模拟开始后可切换观看各位博士')}</span>`
    : !coop
      ? html`<span class="t-mint">${t('*模拟协议已就绪，准许进入模拟')}</span>`
    : facts.isHost
      ? facts.canStart
        ? html`<span class="t-mint">${t('*同盟人数达标，准许进入模拟')}</span>`
        : html`<span class="t-lo">${t('等待所有博士准备就绪')}</span>`
      : myReady
        ? html`<span class="t-mint">${t('已就绪 · 等待创建者开始模拟')}</span>`
        : html`<span class="t-lo">${t('准备就绪后，创建者即可开始模拟')}</span>`;

  const groups = coop ? roomGroupMembers(facts.occupied, room.capacity || facts.seats.length, room.groupOrder) : [];
  const groupByPlayer = new Map(groups.flatMap((members, groupIndex) => members.map((id) => [id, groupIndex])));

  if (rulesOpen && coop) return html`<${RoomRulesPage} room=${room} facts=${facts} busy=${busy}
    online=${online} onBack=${() => setRulesOpen(false)} onPick=${setUniteHelpers} onSwap=${swapGroupMembers}
    onAssign=${setBotBand} onToggleAiLast=${setAiLast} />`;

  return html`<div class="screen room-screen">
    <header class="topbar">
      <div class="topbar__left">
        <${Tooltip} text=${t('离开同盟')} placement="bottom">
          <${Button} variant="danger" size="lg" square=${true} icon="exit" loading=${busy === 'leave'} onClick=${leave} aria-label=${t('离开同盟')} />
        <//>
        <div class="room-ping">
          <${PingPill} ms=${conn.ping} online=${online} />
          <${MicroLabel}>${t('当前延迟')}<//>
        </div>
        <${Button} variant="secondary" size="sm" icon="chart" class="stats-entry" onClick=${openStats} title=${t('统计数据')} aria-label=${t('统计数据')}>${t('统计')}<//>
        <${SettingsButton} class="room-settings" variant="secondary" label=${t('设置')} />
        <${GuideButton} class="room-guide" variant="secondary" label=${t('玩法说明')} />
      </div>
      <div class="topbar__center">
        <${MicroLabel} tone="mint">${coop ? 'ALLIANCE LOBBY' : 'SOLO SIMULATION'}<//>
        <h1 class="topbar__title">${coop ? t('同盟模拟') : t('独立模拟')}<span class="topbar__sep"></span><${DifficultyTag} difficulty=${room.difficulty} size="lg" /></h1>
      </div>
      <div class="topbar__right">
        ${coop ? html`<${InviteBox} code=${room.code} name=${me.name} difficulty=${room.difficulty} />` : html`<div class="solo-note"><${MicroLabel}>SINGLE OPERATOR<//><span>${t('仅限 1 名博士')}</span></div>`}
      </div>
    </header>

    ${coop ? html`<div class="room-config-strip">
      <${CapacityPicker} room=${room} facts=${facts} busy=${busy} onPick=${setCapacity} />
      <${Button} variant="secondary" size="sm" onClick=${() => setRulesOpen(true)}>${t('房间规则')}<//>
    </div>` : null}
    <!-- 座位区 + 右侧 room access 坞：面板不再当座位网格的子项（维护者 m00232），位置固定、不会随人数换格或压住座位。 -->
    <div class=${`room-stage${coop ? ' room-stage--rail' : ''}`}>
    <main class=${`seats${coop ? facts.seats.length > 10 ? ' seats--dense' : facts.seats.length > 4 ? ' seats--expanded' : '' : ' seats--solo'}${coop && facts.seats.length === 10 ? ' seats--ten' : ''}`}>
      ${facts.seats.map((s, i) => html`<${SeatCard} key=${s ? `p${s.playerId}` : `e${i}`} seat=${s} index=${i} room=${room} facts=${facts}
        myId=${me.playerId} busy=${busy} groups=${groups} groupIndex=${s ? groupByPlayer.get(s.playerId) ?? -1 : -1}
        onMoveGroup=${moveGroup} onAddBot=${addBot} onRemoveBot=${removeBot} onKick=${kick} />`)}
      ${coop ? null : html`<aside class="solo-brief brackets">
        <${MicroLabel} tone="mint">BRIEFING<//>
        <h2>${DIFFICULTY_NAMES[room.difficulty] ? t(DIFFICULTY_NAMES[room.difficulty]) : ''}<span class="num t-dim"> ${info.code}</span></h2>
        <p>${info.desc}</p>
        <ul>
          ${info.effects.map((e) => html`<li key=${e}>${e}</li>`)}
          <li>${t('共')} <b class="num">${info.rounds}</b> ${tc('rounds', '回合')}${info.hidden ? t('，满足条件时进入隐秘核心') : ''}</li>
          <li>${t('独立模拟中休整期与机变阶段不限时')}</li>
        </ul>
      </aside>`}
    </main>
    ${coop ? html`<${RoomAccessOptions} option=${roomAccessOptions(room, me.playerId)} busy=${busy}
      onInviteOnly=${setInviteOnly} onRecruitWanted=${setRecruitWanted} onAllowSpectators=${setAllowSpectators} />` : null}
    </div>
    <${SpectatorBar} facts=${facts} myId=${me.playerId} busy=${busy} onRemove=${removeSpectator} onSit=${sit} />

    <footer class="room-bar">
      <div class="room-bar__left">
        <span class="room-bar__label">${t('模拟难度')}<${MicroLabel}>DIFFICULTY<//></span>
        <div class="room-bar__opts">
          <${DifficultyPicker} room=${room} isHost=${facts.isHost} busy=${busy} onPick=${setDifficulty} />
        </div>
      </div>
      <div class="room-bar__center">
        <div class="ready-count" hidden=${!coop}>
          <span class="t-lo">${t('已就绪')}</span>
          <b class="num">${facts.readyHumans}</b><span class="num t-dim">/${facts.humans.length}</span>
          <span class="ready-count__icons" aria-hidden="true">
            ${facts.humans.map((s) => html`<${Icon} key=${s.playerId} name="user" class=${facts.isReady(s) ? 'is-on' : ''} />`)}
          </span>
        </div>
        <div class="room-bar__status">${statusLine}</div>
      </div>
      <div class="room-bar__right">
        <${MatchRecordsButton} code=${room.code} />
        <${LoadoutButton} from="room" size="lg" class="room-loadout" label=${t('干员调配')} />
        ${facts.isHost
          ? html`<${Tooltip} text=${facts.canStart ? null : t('仍有博士未准备就绪')}>
              <${Button} variant="primary" size="xl" icon="play" loading=${busy === 'start'} disabled=${!facts.canStart || !online} onClick=${start}>${t('开始模拟')}<//>
            <//>`
          : facts.spectating
            ? html`<${Button} variant="secondary" size="xl" icon="eye" disabled=${true}>${t('观战中')}<//>`
          : html`<${Button} variant=${myReady ? 'primary' : 'secondary'} size="xl" icon=${myReady ? 'check' : 'hourglass'} active=${myReady}
              loading=${busy === 'ready'} disabled=${!online || !facts.mine} onClick=${toggleReady}>${myReady ? t('已就绪') : t('准备就绪')}<//>`}
      </div>
    </footer>
  </div>`;
}

function RoomRulesPage({ room, facts, busy, online, onBack, onPick, onSwap, onAssign, onToggleAiLast }) {
  useData('bands');
  const [selectedMember, setSelectedMember] = useState(null);
  const groups = roomGroupMembers(facts.occupied, room.capacity || facts.seats.length, room.groupOrder);
  const byId = new Map(facts.occupied.map((seat) => [seat.playerId, seat]));
  const bands = data.list('bands').filter((band) => !Array.isArray(band.modeTypeList) || band.modeTypeList.includes('MULTI'))
    .sort((left, right) => (left.sortId ?? 99) - (right.sortId ?? 99));
  const selectedGroup = groups.findIndex((members) => members.includes(selectedMember));
  const selectMember = (playerId, groupIndex) => {
    if (!facts.isHost || !online || busy) return;
    if (selectedMember && selectedMember !== playerId && selectedGroup !== groupIndex && selectedGroup >= 0) {
      onSwap(selectedMember, playerId);
      setSelectedMember(null);
    } else setSelectedMember(selectedMember === playerId ? null : playerId);
  };
  const limit = uniteHelperLimit(Math.max(1, facts.occupied.length));
  const selected = Math.min(room.uniteHelpers ?? 2, limit);
  const bonus = uniteTimeBonus(Math.max(1, facts.occupied.length), selected);
  return html`<div class="screen room-rules-screen">
    <header class="room-rules__header">
      <${Button} variant="secondary" size="sm" onClick=${onBack}>${t('返回房间')}<//>
      <div><${MicroLabel} tone="mint">ALLIANCE RULES<//><h1>${t('房间规则')}</h1></div>
      <span class="num">${room.code}</span>
    </header>
    <main class="room-rules__content">
      <section class="room-rules__section brackets">
        <${MicroLabel} tone="mint">POOL GROUPS<//>
        <h2>${t('分组')}</h2>
        <p>${t('每组最多四人；博士可在房间座位卡选择未满组，房主可在此互换成员。')}</p>
        <p>${t('房主可为每位 AI 指定开局策略；同组不得重复。')}</p>
        <div class="room-rules__groups">
          ${groups.map((members, groupIndex) => html`<div key=${groupIndex} class="room-rules__group" data-group=${groupIndex}>
            <strong>${t('第 {number} 组', { number: groupIndex + 1 })} <span class="num">${members.length}/4</span></strong>
            <div class="room-rules__members">
              ${members.map((playerId) => {
                const seat = byId.get(playerId);
                const usedBands = new Set(members.filter((id) => id !== playerId).map((id) => byId.get(id)?.aiBandId).filter(Boolean));
                return html`<div key=${playerId} class="room-rules__member-row"><button type="button"
                  class=${`room-rules__member${selectedMember === playerId ? ' is-selected' : ''}`}
                  aria-pressed=${selectedMember === playerId ? 'true' : 'false'}
                  disabled=${!facts.isHost || !online || !!busy || !!room.inMatch}
                  onClick=${() => selectMember(playerId, groupIndex)}>
                  <span class="num">P${seat.seat + 1}</span> ${seat.name}${seat.isBot ? html` <span class="t-dim">AI</span>` : null}
                </button>${seat.isBot ? html`<select class="room-rules__band" aria-label=${t('指定 {name} 的策略', { name: seat.name })}
                  value=${seat.aiBandId || ''} disabled=${!facts.isHost || !online || !!busy || !!room.inMatch || !bands.length}
                  onChange=${(event) => onAssign(seat.seat, seat.playerId, event.target.value || null)}>
                  <option value="">${t('自动选择')}</option>
                  ${bands.map((band) => html`<option key=${band.bandId} value=${band.bandId} disabled=${usedBands.has(band.bandId)}>${band.name}</option>`)}
                </select>` : null}</div>`;
              })}
            </div>
          </div>`)}
        </div>
        ${selectedGroup >= 0 ? html`<p class="room-rules__bonus">${t('选择另一组成员交换')}</p>` : null}
      </section>
      <section class="room-rules__section brackets">
        <${AiLastToggle} option=${aiLastOption(room, facts.mine?.playerId)} busy=${busy} onToggle=${onToggleAiLast} />
      </section>
      <section class="room-rules__section brackets">
        <${MicroLabel} tone="mint">UNITE PHASE<//>
        <h2>${t('协防兜底人数')}</h2>
        <p>${t('可选人数由已入座博士与 AI 决定')}</p>
        <div class="room-rules__options" role="radiogroup" aria-label=${t('协防兜底人数')}>
          ${uniteHelperOptions(Math.max(1, facts.occupied.length)).map((helpers) => html`<button key=${helpers} type="button" role="radio"
            aria-checked=${selected === helpers ? 'true' : 'false'}
            class=${`room-rules__option${selected === helpers ? ' is-active' : ''}`}
            disabled=${!facts.isHost || !online || !!busy} onClick=${() => selected !== helpers && onPick(helpers)}>
            ${t('{count} 人协防', { count: helpers })}
          </button>`)}
        </div>
        <p>${t('每轮最多两名队友上场；仍有漏怪才继续下一轮。')}</p>
        <strong class="room-rules__bonus">${t('每轮额外 {seconds} 秒游戏时间', { seconds: bonus })}</strong>
        ${facts.isHost ? null : html`<span class="t-dim">${t('由创建者设置')}</span>`}
      </section>
    </main>
  </div>`;
}

/**
 * 同盟人数上限（20 人分支）：房主可调，其它人只读；已占席位多过目标档位时那一档禁用。
 */
function CapacityPicker({ room, facts, busy, onPick }) {
  const capacity = room.capacity || facts.seats.length;
  const minCapacity = Math.max(1, ...facts.occupied.map((s) => s.seat + 1));
  return html`<div class="room-capacity" aria-label=${t('同盟席位')}>
    <span class="room-capacity__label">${t('人数上限')} <b class="num">${capacity}</b> ${t('人')}</span>
    ${facts.isHost ? html`<div class="room-capacity__options" role="radiogroup" aria-label=${t('调整同盟人数上限')}>
      ${ROOM_CAPACITIES.map((n) => html`<button key=${n} type="button" role="radio" aria-checked=${capacity === n ? 'true' : 'false'}
        class=${`room-capacity__opt${capacity === n ? ' is-active' : ''}`} disabled=${!!busy || n < minCapacity}
        title=${n < minCapacity ? t('先移除超出席位的玩家') : t('{n} 人房间', { n })}
        onClick=${() => n !== capacity && onPick(n)}>${n}</button>`)}
    </div>` : html`<span class="t-dim">${t('由房主设置')}</span>`}
    <span class="room-capacity__count num">${facts.occupied.length} / ${capacity}</span>
  </div>`;
}
