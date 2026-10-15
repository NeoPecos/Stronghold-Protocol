// 联机大厅 (Alliance Matchmaking) — presentational pieces of the lobby screen: the topbar's online count, the
// discovery panel (counters + room-list entry + room preference + fastest match) and the room-list dialog that
// carries our room rows (房主 / 在线 / 近5分钟操作 / 期望路人加入 / n/m 位博士 / 招募中·模拟中 / 加入同盟 / 观战).
//
// Data comes from `room.list` (server/lobby.js listRooms): the same room directory the screen has always polled —
// this module only renders it. Admission stays with `room.join` (the key row and every 加入同盟 button) and with
// `room.spectate` (观战); the screen decides which room the fastest match picks.
import { useEffect, useState } from '../../vendor/hooks.module.js';
import { ROOM_CAPACITIES, MAX_SPECTATORS, DIFFICULTY_NAMES, DIFFICULTY_COLORS, ROOM_CODE_LEN } from '../../../shared/constants.js';
import { t } from '../../../shared/i18n.js';
import { html, Button, Icon, Panel, Spinner, DifficultyIcon, Modal, TextField, Tooltip } from './components.js';

/** Rooms per page in the room-list dialog (matches the 20-person reference's paged directory). */
export const ROOM_PAGE_SIZE = 8;

/** A room is joinable while it has a free seat and its simulation has not started (listRooms' own rule). */
export const isJoinable = (room) => !room.inMatch && room.players + room.bots < room.capacity;

/** A room can be watched while the host allows it and a spectator seat is free. */
export const isWatchable = (room) => room.allowSpectators !== false && room.spectators < MAX_SPECTATORS;

/**
 * Topbar online count (the 20-person header's readout). It summarises the room directory, so `count` is null
 * until the first `room.list` arrives (and while offline).
 * @param {{ count: number|null, online: boolean }} props
 */
export function LobbyOnlinePill({ count, online }) {
  const shown = online && count != null ? count : '—';
  return html`<span class=${`lobby-online${online ? '' : ' is-offline'}`} data-testid="lobby-online"
      title=${t('大厅在线人数：当前在同盟房间中就座且已连接服务器的真人（不含 AI 与独立模拟）')}
      aria-label=${t('服务器在线人数')}>
    <${Icon} name="users" /><span>${t('在线 {n}', { n: shown })}</span>
  </span>`;
}

/**
 * One room of the list dialog: everything the old 服务器房间 list showed (host, 在线 / 近5分钟操作, 期望路人加入,
 * n/m 位博士, 招募中/模拟中) plus 加入同盟 / 观战.
 * @param {{ room: any, busy: any, connected: boolean, onJoin: Function, onSpectate: Function }} props
 */
export function LobbyRoomRow({ room, busy, connected, onJoin, onSpectate }) {
  const occupied = room.players + room.bots;
  const joinable = isJoinable(room);
  const watchable = isWatchable(room);
  const status = room.inMatch ? t('模拟中') : joinable ? t('招募中') : t('已满员');
  return html`<article class=${`lobby-room-list__row${joinable ? ' is-open' : ''}`} role="listitem" data-room=${room.code}>
    <div class="lobby-room-list__identity">
      <span class="lobby-room-list__code num">${room.code}</span>
      <span class="lobby-room-list__host" title=${room.hostName}>${t('房主')} · ${room.hostName || t('博士')}</span>
      ${room.recruitWanted && !room.inMatch ? html`<strong class="lobby-room-list__recruit">${t('期望路人加入')}</strong>` : null}
    </div>
    <div class="lobby-room-list__details">
      <span class="lobby-room-list__difficulty" style=${`--d-color:${DIFFICULTY_COLORS[room.difficulty] || 'var(--mint-400)'}`}>
        <${DifficultyIcon} difficulty=${room.difficulty} />${DIFFICULTY_NAMES[room.difficulty] ? t(DIFFICULTY_NAMES[room.difficulty]) : room.difficulty}
      </span>
      <span class="lobby-room-list__count"><${Icon} name="users" /><b class="num">${occupied}/${room.capacity}</b>
        <span>${t('{players} 位博士', { players: room.players })}${room.bots ? t(' · {bots} 位 AI', { bots: room.bots }) : ''}</span>
      </span>
      <span class="lobby-room-list__activity">${t('在线 {n} 人', { n: room.connectedPlayers })} · ${t('近5分钟操作 {n} 人', { n: room.activePlayers })}</span>
      <span class=${`lobby-room-list__status${joinable ? ' is-open' : ''}`}>${status}</span>
    </div>
    <div class="lobby-room-list__actions">
      <${Button} variant="primary" size="sm" disabled=${!joinable || !!busy || !connected}
        onClick=${() => onJoin(room.code)}>${t('加入同盟')}<//>
      ${watchable ? html`<${Button} variant="ghost" size="sm" icon="eye" disabled=${!!busy || !connected}
        onClick=${() => onSpectate(room.code)}>${t('观战')}<//>` : null}
    </div>
  </article>`;
}

/**
 * The 房间列表 dialog: our room rows, paginated (8 per page) with the empty state and a refresh control.
 * @param {{ rooms: any[]|null, online: boolean, loading: boolean, error: boolean, busy: any, open: boolean,
 *   onClose: Function, onRefresh: Function, onJoin: Function, onSpectate: Function }} props
 */
export function LobbyRoomList({ rooms, online, loading, error, busy, open, onClose, onRefresh, onJoin, onSpectate }) {
  const list = Array.isArray(rooms) ? rooms : null;
  const pages = Math.max(1, Math.ceil((list?.length || 0) / ROOM_PAGE_SIZE));
  const [page, setPage] = useState(0);
  const current = Math.min(page, pages - 1);
  const slice = list ? list.slice(current * ROOM_PAGE_SIZE, (current + 1) * ROOM_PAGE_SIZE) : null;
  const actions = html`<div class="lobby-room-list__pager">
    <${Button} variant="secondary" size="sm" icon="chevronLeft" disabled=${current <= 0} onClick=${() => setPage(current - 1)}>${t('上一页')}<//>
    <span class="num">${t('第 {page} / {pages} 页', { page: current + 1, pages })}</span>
    <${Button} variant="secondary" size="sm" iconRight="chevronRight" disabled=${current >= pages - 1} onClick=${() => setPage(current + 1)}>${t('下一页')}<//>
    <${Button} variant="primary" size="sm" onClick=${onClose}>${t('关闭')}<//>
  </div>`;
  return html`<${Modal} open=${open} title=${t('房间列表')} micro="ROOM DIRECTORY" tone="mint" onClose=${onClose}
      width="min(12.4rem, 94vw)" class="lobby-room-list" actions=${actions}>
    <div class="lobby-room-list__head">
      <span class="t-lo">${t('房间列表实时更新')}</span>
      <${Button} variant="secondary" size="sm" icon="refresh" loading=${loading} disabled=${!online} onClick=${onRefresh}>${t('刷新')}<//>
    </div>
    ${!online ? html`<p class="lobby-room-list__empty">${t('连接服务器后即可查看房间')}</p>`
      : error && !list ? html`<p class="lobby-room-list__empty">${t('房间列表暂时无法加载，请刷新重试')}</p>`
      : !list ? html`<p class="lobby-room-list__empty"><${Spinner} size="sm" label="ROOMS" />${t('正在查找服务器房间…')}</p>`
      : list.length === 0 ? html`<p class="lobby-room-list__empty">${t('当前没有房间。可以创建同盟邀请好友。')}</p>`
      : html`<div class="lobby-room-list__rows" role="list" aria-label=${t('房间列表')}>
        ${slice.map((room) => html`<${LobbyRoomRow} key=${room.code} room=${room} busy=${busy} connected=${online}
          onJoin=${onJoin} onSpectate=${onSpectate} />`)}
      </div>`}
    ${list?.length ? html`<p class="lobby-room-list__foot">${t('共 {n} 间同盟房间', { n: list.length })}${error ? t(' · 刷新失败，显示上次结果') : ''}</p>` : null}
  <//>`;
}

/**
 * The 联机大厅 module: the heading strip carries the 加入同盟 key row (key field + 加入同盟 + 观战 + 最近的同盟)
 * next to the four counters, and the tool row below carries the room-list entry, the room preference and the
 * fastest-match button.
 *
 * `normalizeCode` is injected by the screen (it owns the key-field rules) so this module never has to import the
 * screen back — the two files would otherwise import each other.
 * @param {{ online: boolean, rooms: any[]|null, code: string, codeOk: boolean, recent: string[], busy: any,
 *   preference: number|null, loading: boolean, queued: boolean, queueStatus: string|null, normalizeCode: Function,
 *   onCode: Function, onJoin: Function, onSpectate: Function, onOpen: Function, onRefresh: Function,
 *   onPreference: Function, onQuickMatch: Function }} props
 */
export function AllianceDiscovery({ online, rooms, code, codeOk, recent, busy, preference, loading, queued = false,
  queueStatus = null, normalizeCode, onCode, onJoin, onSpectate, onOpen, onRefresh, onPreference, onQuickMatch }) {
  const list = Array.isArray(rooms) ? rooms : null;
  const total = list?.length ?? null;
  const matches = list?.filter((room) => room.inMatch).length ?? null;
  const joinable = list?.filter(isJoinable).length ?? null;
  const playing = list?.reduce((sum, room) => sum + (Number(room.connectedPlayers) || 0), 0) ?? null;
  const pick = (value) => onPreference(value ? Number(value) : null);
  return html`<${Panel} class="lobby-discovery" tone="mint" data-testid="lobby-discovery" aria-label=${t('联机大厅')}
    micro="ALLIANCE DIRECTORY" title=${html`<${Icon} name="users" />${t('联机大厅')}`}
    actions=${html`<div class="lobby-discovery__join">
      <!-- The key row is the panel head's actions（维护者 m00816「上半部分格式照抄线上版本」：整条标题带（标题 + 小字 +
           密钥框 + 加入同盟/观战/刷新）走线上 .room-directory 那套；这一行永不换行（CSS）——宽度不够时先压窄密钥框，
           观战永远紧跟在加入同盟后面。 -->
      <${TextField} size="code" icon="key" value=${code} placeholder=${t('输入同盟密钥 / 粘贴邀请链接')}
        transform=${normalizeCode} onInput=${(v) => onCode(normalizeCode(v))} onEnter=${() => onJoin()} />
      <${Button} variant="amber" size="sm" icon="users" loading=${busy === 'join'} disabled=${!codeOk || !online}
        onClick=${() => onJoin()}>${t('加入同盟')}<//>
      <${Tooltip} text=${t('以观战者身份进入：不占博士席位，只能观看（每个同盟最多 {MAX_SPECTATORS} 名，模拟进行中也可进入）', { MAX_SPECTATORS })}>
        <${Button} variant="secondary" size="sm" icon="eye" loading=${busy === 'spectate'} disabled=${!codeOk || !online}
          onClick=${() => onSpectate()}>${t('观战')}<//>
      <//>
      <${Button} variant="ghost" size="sm" icon="refresh" loading=${loading}
        disabled=${!online || loading} onClick=${onRefresh}>${t('刷新')}<//>
    </div>`}>
    <!-- 最近的同盟 单独占一整行、贴在标题带下面（维护者 m00468：放在标题下面、再由分割线跟下面分开；摆放模仿图一） -->
    <div class="lobby-discovery__recent">
      ${recent.length ? html`<span class="t-lo">${t('最近的同盟')}</span>
        ${recent.map((c) => html`<button key=${c} type="button" class="code-chip num" title=${t('填入密钥（不会直接加入）')}
          onClick=${() => onCode(c)}>${c}</button>`)}`
        : html`<span class="t-dim">${t('向同伴索取 {ROOM_CODE_LEN} 位同盟密钥，或直接打开邀请链接', { ROOM_CODE_LEN })}</span>`}
    </div>

    <div class="lobby-discovery__stats">
      <span><b class="num" data-testid="lobby-room-count">${total == null ? '—' : total}</b><small>${t('总房间')}</small></span>
      <span><b class="num" data-testid="lobby-match-count">${matches == null ? '—' : matches}</b><small>${t('进行中')}</small></span>
      <span title=${t('游玩人数为当前同盟房间中就座的真人（含断线保留席位），不含 AI 与观战者')}>
        <b class="num" data-testid="lobby-playing-count">${playing == null ? '—' : playing}</b><small>${t('游玩人数')}</small></span>
      <span><b class="num" data-testid="lobby-joinable-count">${joinable == null ? '—' : joinable}</b><small>${t('可加入')}</small></span>
    </div>

    <!-- 工具行：房间列表 / 房间偏好 / 最快匹配（⟳ 刷新 已按 m00538 搬到标题带、跟在观战右边） -->
    <div class="lobby-discovery__actions">
      <${Button} variant="secondary" size="sm" icon="users" data-testid="lobby-directory-open" disabled=${!online}
        onClick=${onOpen}>${t('房间列表')}<//>
      <label class="lobby-discovery__preference" title=${t('优先所选人数，没有空席时匹配其他房间。')}><span>${t('房间偏好')}</span>
        <select value=${preference == null ? '' : String(preference)} disabled=${!!busy || !online}
          data-testid="lobby-match-capacity" onInput=${(e) => pick(e.currentTarget.value)}>
          <option value="">${t('不限')}</option>${ROOM_CAPACITIES.map((n) => html`<option key=${n} value=${String(n)}>${t('优先 {n} 人房', { n })}</option>`)}
        </select>
      </label>
      <${Button} variant=${queued ? 'secondary' : 'primary'} size="sm" iconRight="chevrons" data-testid="lobby-quick-match"
        loading=${busy === 'quick'} disabled=${!online} onClick=${onQuickMatch}>${queued ? t('取消匹配') : t('最快匹配')}<//>
    </div>
    ${queueStatus ? html`<p class="lobby-discovery__queue t-lo" role="status" data-testid="lobby-queue-status">${queueStatus}</p>` : null}
  <//>`;
}
