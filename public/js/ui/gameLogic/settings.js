// ui/gameLogic/settings.js — settings defaults and sanitising. Re-exported from ../gameLogic.js.

import { clamp, isObj } from './shared.js';
import { DEFAULT_HOTKEYS, sanitizeHotkeys } from './shortcuts.js';


// ---- settings ------------------------------------------------------------------------------------------------------

/**
 * keys: the in-match shortcuts' key map (ui/gameLogic/shortcuts.js; settings → 快捷键).
 * voiceLang: 干员语音 language (中日语音) — `cn` (default) or `jp`; only these two are offered, and a missing or
 * illegal value falls back to `cn`, so a player who never opened 设置 keeps the exact experience they had.
 *
 * (No `board` key: a 棋盘视角 switch was added and then REMOVED on 2026-10-08 — the renderer kept drawing the 3D board
 * whatever it said, so the control did nothing on a real machine. Dropping the key also guarantees a stale
 * `board: '2d'` left in a player's save can never silently disable the 3D board.)
 */
export const DEFAULT_SETTINGS = Object.freeze({ bgm: 0.6, sfx: 0.8, voice: 0.8, voiceLang: 'cn', resolution: 'auto', muted: false, damageNumbers: true, quality: 'high', keys: DEFAULT_HOTKEYS });
const QUALITIES = ['high', 'medium', 'low'];
/** Operator voice languages the manifest can carry (tools/assets/audio.mjs VOICE_DIRS is the superset: en/kr are not offered). */
export const VOICE_LANGS = Object.freeze(['cn', 'jp']);

/**
 * 分辨率 / RESOLUTION — how many device pixels the field canvas is allowed to use.
 *
 * Split out of 画质 (quality) on the project owner's request (2026-10-08): a phone whose operator models read blurry
 * needs MORE PIXELS for the sprites, and folding that into 画质 would also turn on the expensive board features the
 * player may not want (the 3D board's PBR fill, shadows). These are pixel-ratio CAPS applied on top of the device's
 * own `devicePixelRatio`, so 'native' (=2) means "up to 2× CSS pixels" and never upscales beyond the screen.
 *   auto  — the 画质 setting decides (upstream behaviour, the default)
 *   720p / 1080p / 1440p — a fixed cap, for a phone that renders at 3× and cannot afford it
 *   native — always the highest cap (2), the "as sharp as the screen allows" choice
 * The 3D board keeps its own, lower cap: it is fill-bound (the PBR board), unlike the sprites.
 */
export const RESOLUTION_MODES = Object.freeze(['auto', '720p', '1080p', '1440p', 'native']);
export const RES_CAP = Object.freeze({ '720p': 1, '1080p': 1.5, '1440p': 2, native: 2 });
/** The pixel-ratio cap a resolution mode asks for, or null for `auto` (the caller then keeps its quality default). */
export function resolutionCap(res) {
  return RES_CAP[res] ?? null;
}
/** The 3D board's own cap: it never exceeds the sprite cap, and stays below it on the mid tiers. */
export function boardResolutionCap(res) {
  const cap = resolutionCap(res);
  if (cap == null) return null;
  return cap >= 2 ? 2 : cap <= 1 ? 1 : 1.25;
}

/**
 * Sanitize persisted settings.
 * @param {any} raw
 * @returns {{ bgm: number, sfx: number, voice: number, voiceLang: 'cn'|'jp', muted: boolean, damageNumbers: boolean,
 *   quality: 'high'|'medium'|'low',
 *   keys: Record<'refresh'|'freeze'|'levelUp'|'retreat'|'sell'|'ready', string> }}
 */
export function sanitizeSettings(raw) {
  const r = isObj(raw) ? raw : {};
  const vol = (v, d) => (Number.isFinite(v) ? clamp(Math.round(v * 100) / 100, 0, 1) : d);
  return {
    bgm: vol(r.bgm, DEFAULT_SETTINGS.bgm),
    sfx: vol(r.sfx, DEFAULT_SETTINGS.sfx),
    voice: vol(r.voice, DEFAULT_SETTINGS.voice),
    // 中日语音: only cn/jp; anything else (absent field, an old save, a hand-edited value) ⇒ cn
    voiceLang: VOICE_LANGS.includes(r.voiceLang) ? r.voiceLang : DEFAULT_SETTINGS.voiceLang,
    // 分辨率: only the listed modes; an absent field (a save from before it existed) ⇒ auto, i.e. nothing changes
    resolution: RESOLUTION_MODES.includes(r.resolution) ? r.resolution : DEFAULT_SETTINGS.resolution,
    muted: typeof r.muted === 'boolean' ? r.muted : DEFAULT_SETTINGS.muted,
    damageNumbers: typeof r.damageNumbers === 'boolean' ? r.damageNumbers : DEFAULT_SETTINGS.damageNumbers,
    quality: QUALITIES.includes(r.quality) ? r.quality : DEFAULT_SETTINGS.quality,
    keys: sanitizeHotkeys(r.keys),
  };
}
