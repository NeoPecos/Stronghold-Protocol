// ui/gameLogic/settings.js — settings defaults and sanitising. Re-exported from ../gameLogic.js.

import { VOICE_LANGS, sanitizeVoiceOverrides } from '../../voicePrefs.js';
export { VOICE_LANGS } from '../../voicePrefs.js';

import { clamp, isObj } from './shared.js';
import { DEFAULT_HOTKEYS, sanitizeHotkeys } from './shortcuts.js';


// ---- settings ------------------------------------------------------------------------------------------------------

/**
 * voiceLang defaults to Chinese; resolution remains an independent client display option.
 */

/**
 * 分辨率 / RESOLUTION — how many device pixels the field canvas is allowed to use.
 *
 * Split out of 画质 (quality) on the project owner's request (2026-10-08): a phone whose operator models read blurry
 * needs MORE PIXELS for the sprites, and folding that into 画质 would also turn on the expensive board features the
 * player may not want (the 3D board's PBR fill, shadows). These are pixel-ratio CAPS applied on top of the device's
 * own `devicePixelRatio`, so 'native' follows the device ratio up to the renderer's pixel budget.
 *   auto  — the 画质 setting decides (upstream behaviour, the default)
 *   720p / 1080p / 1440p — a fixed cap, for a phone that renders at 3× and cannot afford it
 *   native — device pixels, subject to the field or board's own pixel budget
 * The 3D board keeps its own smaller pixel budget and lower mid-tier caps: it is fill-bound (the PBR board).
 */
export const RESOLUTION_MODES = Object.freeze(['auto', '720p', '1080p', '1440p', 'native']);
export const RES_CAP = Object.freeze({ '720p': 1, '1080p': 1.5, '1440p': 2, native: 'device' });
/** The pixel-ratio cap a resolution mode asks for, or null for `auto` (the caller then keeps its quality default). */
export function resolutionCap(res) {
  return RES_CAP[res] ?? null;
}
/** The 3D board's own cap: it never exceeds the sprite cap, and stays below it on the mid tiers. */
export function boardResolutionCap(res) {
  const cap = resolutionCap(res);
  if (cap == null) return null;
  if (cap === 'device') return cap;
  return cap >= 2 ? 2 : cap <= 1 ? 1 : 1.25;
}

/** Keep automatic rendering work bounded when fullscreen increases the canvas area. */
export function canvasPixelRatio(width, height, deviceRatio, cap, pixelBudget) {
  const area = Math.max(1, width * height);
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const ceiling = cap === 'device' ? ratio : cap;
  if (!Number.isFinite(ceiling) || ceiling <= 0) throw new RangeError('Invalid canvas pixel-ratio cap');
  const bounded = Math.min(ratio, ceiling, Math.sqrt(pixelBudget / area));
  return cap === 'device' ? bounded : Math.max(0.75, bounded);
}


/**
 * The steps of 设置 →「文字大小」 (textSize): the interface text root `--t` of css/theme.css — 'sm' is the design's own
 * sizes (`--t: 1rem`), the others lift the phone's 40 px root by a floor and grow the desktop gently. Text only: the
 * layout root `1rem` (and with it the field camera, the detail card's side and the DOM fallback board) never moves.
 */
export const TEXT_SIZES = Object.freeze(['sm', 'md', 'lg', 'xl']);

/** keys: the in-match shortcuts' key map (ui/gameLogic/shortcuts.js; settings → 快捷键). voiceLang: VOICE_LANGS.
 *  textSize: TEXT_SIZES (css/theme.css `--t`, applied by ui/settings.js applyTextSize). ammoCount: 设置「弹药数量」 — the
 *  rounds left / the magazine under an ammo skill's bar (render/units.js; PR #552), off by default: the official HUD has no
 *  such number (the maintainer's decision of 2026-10-13). */
export const DEFAULT_SETTINGS = Object.freeze({ bgm: 0.6, sfx: 0.8, voice: 0.8, voiceLang: 'cn', voiceOverrides: Object.freeze({}), resolution: 'auto', muted: false, damageNumbers: true, officialDamageNumbers: false, ammoCount: false, keepSignedIn: true, quality: 'high', textSize: 'sm', keys: DEFAULT_HOTKEYS });
const QUALITIES = ['high', 'medium', 'low'];

/**
 * Sanitize persisted settings.
 * @param {any} raw
 * @returns {{ bgm: number, sfx: number, voice: number, voiceLang: 'cn'|'jp', voiceOverrides: Record<string, string>, muted: boolean, damageNumbers: boolean, officialDamageNumbers: boolean, ammoCount: boolean, quality: 'high'|'medium'|'low',
 *   resolution: string, keepSignedIn: boolean, textSize: 'sm'|'md'|'lg'|'xl', keys: Record<'refresh'|'freeze'|'levelUp'|'retreat'|'sell'|'ready', string> }}
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
    voiceOverrides: sanitizeVoiceOverrides(r.voiceOverrides),
    muted: typeof r.muted === 'boolean' ? r.muted : DEFAULT_SETTINGS.muted,
    damageNumbers: typeof r.damageNumbers === 'boolean' ? r.damageNumbers : DEFAULT_SETTINGS.damageNumbers,
    // 保持登录：默认开。老存档没有这个字段时维持原有行为（记住登录状态）。
    keepSignedIn: typeof r.keepSignedIn === 'boolean' ? r.keepSignedIn : DEFAULT_SETTINGS.keepSignedIn,
    officialDamageNumbers: typeof r.officialDamageNumbers === 'boolean' ? r.officialDamageNumbers : false,
    ammoCount: typeof r.ammoCount === 'boolean' ? r.ammoCount : DEFAULT_SETTINGS.ammoCount,
    quality: QUALITIES.includes(r.quality) ? r.quality : DEFAULT_SETTINGS.quality,
    textSize: TEXT_SIZES.includes(r.textSize) ? r.textSize : DEFAULT_SETTINGS.textSize,
    keys: sanitizeHotkeys(r.keys),
  };
}
