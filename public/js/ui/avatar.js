// 玩家头像 (TASK-004)：客户端状态与同步。
//
// 头像 = 一个干员 id（`char_003_kalts`），空串 = 不用头像 —— 显示回落到阵营图标、再回落名字首字。
// 图片直接用随包素材里已有的 `assets.chars[id].avatar`（210 个干员），没有新增下载，也不接受外链/上传。
//
// 选择按浏览器存在 localStorage，并镜像到**账号画像**（`account.avatar`）：与干员调配 / 皮肤 / 持有 / 自选编队
// 同一套机制（见 ui/skins.js、server/net.js 的 PROFILE_FIELDS），所以换端、换浏览器后会自动恢复。
//
// 面板本身是全局悬浮层（`<AvatarHost/>`，main.js 渲染）：大厅点自己的头像即可打开，见 ui/avatarPicker.js。

import { createStore, loadPref, savePref } from '../store.js';
import { data } from '../data.js';
import { AVATAR_NAMES } from './avatarNames.js';

export const AVATAR_PREF = 'avatar';
export const SYNC_DEBOUNCE_MS = 400;
export const RETRY_MS = 1500;

function readStored() {
  const raw = loadPref(AVATAR_PREF, '');
  return typeof raw === 'string' ? raw : '';
}

/** 当前头像 id、同步状态，以及面板是否打开（面板状态放这里，理由同 loadoutStore：别污染 app store）。 */
export const avatarStore = createStore({ id: readStored(), sync: 'idle', open: false });

/** 选一个头像（`''` = 不用头像）。 */
export function setAvatar(id) {
  const next = typeof id === 'string' ? id : '';
  savePref(AVATAR_PREF, next);
  avatarStore.set({ id: next });
}

/** 当前头像 id（`''` = 无）。 */
export const avatarId = () => avatarStore.get().id || '';

export const openAvatarPicker = () => avatarStore.set({ open: true });
export const closeAvatarPicker = () => avatarStore.set({ open: false });

/**
 * 头像图片地址；没有头像、素材里没有这个干员、或该干员没有头像图时返回 `''`（调用方回落到阵营图标 / 名字首字）。
 * @param {string} id
 */
export function avatarUrl(id) {
  const chars = data.get('assets')?.chars;
  const entry = id && chars ? chars[id] : null;
  return entry && typeof entry.avatar === 'string' ? entry.avatar : '';
}

/** 本机所选头像的图片地址。 */
export const myAvatarUrl = () => avatarUrl(avatarId());

/** 面板需要的数据（素材清单 + 干员名）。 */
export function loadAvatarData() {
  data.load('assets').catch(() => {});
  data.load('chess').catch(() => {});
}

/**
 * 可选头像清单：所有带头像素材的干员，按名字排序。
 * 名字优先取 data/chess.json（干员在棋盘上的正式名，`name` + `backup.charId`），
 * 棋盘上没有的干员用 ui/avatarNames.js 里的官方数据表名字补齐（生成脚本见该文件头部）。
 * @returns {{ id: string, name: string, url: string }[]}
 */
export function avatarChoices() {
  const chars = data.get('assets')?.chars || {};
  const chess = data.get('chess') || {};
  const names = new Map();
  for (const rec of Object.values(chess)) {
    const charId = rec && rec.backup && rec.backup.charId;
    if (!charId || names.has(charId)) continue;
    names.set(charId, typeof rec.name === 'string' ? rec.name.trim() : '');
  }
  for (const [id, name] of Object.entries(AVATAR_NAMES)) {
    if (name && !names.has(id)) names.set(id, name);
  }
  const out = [];
  for (const [id, entry] of Object.entries(chars)) {
    if (!entry || typeof entry.avatar !== 'string' || !entry.avatar) continue;
    out.push({ id, name: names.get(id) || id, url: entry.avatar });
  }
  return out.sort((a, b) => (a.name === a.id ? 1 : 0) - (b.name === b.id ? 1 : 0) || a.name.localeCompare(b.name, 'zh'));
}

/**
 * 保持服务器（账号画像）里的头像与本机一致 —— 和 installSkinsSync 同一套路：防抖、重试、welcome 后重发。
 * @param {{ net: any, timers?: { setTimeout: Function, clearTimeout: Function } }} deps
 * @returns {{ flush: () => Promise<void>, dispose: () => void }}
 */
export function installAvatarSync({ net, timers } = {}) {
  const T = timers || { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: (id) => globalThis.clearTimeout(id) };
  let timer = null;
  let seq = 0;
  let pending = null;
  let lastSent = null;
  let disposed = false;

  const setState = (sync) => { if (avatarStore.get().sync !== sync) avatarStore.set({ sync }); };
  const schedule = (ms = SYNC_DEBOUNCE_MS) => {
    if (disposed) return;
    T.clearTimeout(timer);
    setState('pending');
    timer = T.setTimeout(() => { timer = null; void flush(); }, ms);
  };

  async function flush() {
    if (disposed || net.status !== 'online') { setState('idle'); return; }
    try {
      const avatar = avatarId();
      if (avatar === pending) return;
      if (avatar === lastSent && pending == null) { setState('synced'); return; }
      const my = ++seq;
      pending = avatar;
      setState('sending');
      try {
        await net.request('account.avatar', { avatar });
        if (my !== seq) return;
        pending = null;
        lastSent = avatar;
        setState('synced');
      } catch (err) {
        if (my !== seq) return;
        pending = null;
        const code = err && err.code;
        if (code === 'RATE' || code === 'TIMEOUT' || code === 'OFFLINE') { schedule(RETRY_MS); return; }
        console.warn('[avatar] account.avatar refused', code, err && err.detail);
        setState('error');
      }
    } catch (e) {
      console.warn('[avatar] sync failed', e);
      setState('error');
    }
  }

  const offWelcome = net.on('welcome', () => { lastSent = null; pending = null; seq++; schedule(50); });
  const offStore = avatarStore.subscribe((s, prev) => { if (s.id !== prev.id) schedule(); });

  return {
    flush,
    dispose() {
      disposed = true;
      T.clearTimeout(timer);
      offWelcome?.();
      offStore?.();
    },
  };
}
