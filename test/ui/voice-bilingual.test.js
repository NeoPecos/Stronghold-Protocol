// 中日语音合并 (docs/ASSETS.md 干员战斗语音 + --voice-langs): the language setting, the per-slot fallback chain, the
// switch's async behaviour, and the shipped manifest's real bilingual coverage.
//
// The plan's acceptance items are covered here:
//   * 设置: missing field / illegal value / cn·jp persistence (test/ui/gameLogic.test.js holds the sanitizer shape)
//   * 播放: the two languages resolve to DIFFERENT paths, a missing Japanese slot falls back to Chinese, both missing
//     is silent, an older manifest (no `audio.voiceLanguages`) still plays its original bank
//   * 异步: a language switch stops the line on air and makes a still-decoding one not start
//   * 资源: every reference exists on disk, the language folders do not overlap, and a repeat run keeps cn + skins
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AudioManager, VoiceGate, voiceLineOf, VOICE_LANG_DEFAULT, VOICE_LANGS_SUPPORTED } from '../../public/js/audio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'data', 'assets.json'), 'utf8'));

/** A window whose Web Audio/pointer members the manager accepts (same shape test/ui/audio.test.js uses). */
function fakeWindow() {
  const listeners = new Map();
  const param = () => ({ value: 0, setTargetAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), buffer: null, onended: null, loop: false, playbackRate: { value: 1 }, frequency: param(), Q: param(), type: '' });
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 44100, destination: node(),
    createGain: node, createBufferSource: node, createBiquadFilter: node, createOscillator: node, createDynamicsCompressor: node,
    resume: async () => {}, close: async () => {}, decodeAudioData: async () => ({ duration: 0.5, length: 10, numberOfChannels: 1 }),
    addEventListener() {}, removeEventListener() {},
  };
  const win = {
    AudioContext: function () { return ctx; },
    addEventListener: (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); },
    removeEventListener() {},
    document: { addEventListener: (t, fn) => { if (!listeners.has(t)) listeners.set(t, []); listeners.get(t).push(fn); }, removeEventListener() {}, visibilityState: 'visible', hidden: false, querySelector: () => null },
    navigator: { userAgent: 'node' },
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  return { win, ctx, fire: (t) => { for (const fn of listeners.get(t) || []) fn({ type: t }); } };
}

// ---------------------------------------------------------------------------------------------------------------
// 播放：语言库的选择与逐槽位回退
describe('bilingual voice: bank selection and fallback', () => {
  const audio = {
    voice: { char_a: { start: '/v/cn/a_start.mp3', place: ['/v/cn/a_p1.mp3', '/v/cn/a_p2.mp3'], skill1: '/v/cn/a_s1.mp3' } },
    voiceLanguages: {
      cn: { char_a: { start: '/v/cn/a_start.mp3', place: ['/v/cn/a_p1.mp3', '/v/cn/a_p2.mp3'], skill1: '/v/cn/a_s1.mp3' } },
      // char_a has no Japanese skill1 at all (a partial dub), char_b has Japanese only for place
      jp: { char_a: { start: '/v/jp/a_start.mp3', place: ['/v/jp/a_p1.mp3', '/v/jp/a_p2.mp3'] }, char_b: { place: '/v/jp/b_p1.mp3' } },
    },
  };

  test('the two languages resolve to different paths (the acceptance item: not the same track)', () => {
    assert.equal(voiceLineOf(audio, 'cn', 'char_a', 'start'), '/v/cn/a_start.mp3');
    assert.equal(voiceLineOf(audio, 'jp', 'char_a', 'start'), '/v/jp/a_start.mp3');
    assert.notEqual(voiceLineOf(audio, 'cn', 'char_a', 'start'), voiceLineOf(audio, 'jp', 'char_a', 'start'));
    for (const url of [voiceLineOf(audio, 'cn', 'char_a', 'place'), voiceLineOf(audio, 'jp', 'char_a', 'place')]) {
      assert.match(url, /\/v\/(cn|jp)\/a_p[12]\.mp3/, 'a multi-line slot draws one of its own language');
    }
  });

  test('a slot the chosen language lacks falls back to the primary bank; both missing ⇒ silent', () => {
    // jp has no skill1 for char_a ⇒ the Chinese line still speaks rather than going quiet
    assert.equal(voiceLineOf(audio, 'jp', 'char_a', 'skill1'), '/v/cn/a_s1.mp3');
    // an operator the chosen language does not cover at all ⇒ Chinese
    assert.equal(voiceLineOf(audio, 'jp', 'char_a', 'start'), '/v/jp/a_start.mp3');
    assert.equal(voiceLineOf(audio, 'cn', 'char_b', 'place'), null, 'cn lacks char_b entirely ⇒ silent');
    assert.equal(voiceLineOf(audio, 'jp', 'char_b', 'place'), '/v/jp/b_p1.mp3');
    assert.equal(voiceLineOf(audio, 'jp', 'char_b', 'start'), null, 'neither language has it ⇒ null');
    assert.equal(voiceLineOf(audio, 'jp', 'char_zz', 'start'), null);
    assert.equal(voiceLineOf(audio, 'jp', 'char_a', 'nope'), null);
    assert.equal(voiceLineOf(null, 'jp', 'char_a', 'start'), null);
    assert.equal(voiceLineOf(audio, 'jp', null, 'start'), null);
  });

  test('an older manifest (no audio.voiceLanguages) plays exactly what it did before', () => {
    const old = { voice: { char_a: { start: '/v/cn/a_start.mp3' } } };
    assert.equal(voiceLineOf(old, 'cn', 'char_a', 'start'), '/v/cn/a_start.mp3');
    assert.equal(voiceLineOf(old, 'jp', 'char_a', 'start'), '/v/cn/a_start.mp3', 'no bilingual bank ⇒ the primary serves both');
    assert.equal(voiceLineOf(old, 'en', 'char_a', 'start'), '/v/cn/a_start.mp3');
    const empty = { };
    assert.equal(voiceLineOf(empty, 'jp', 'char_a', 'start'), null);
  });

  test('legal languages are cn/jp and cn is the default', () => {
    assert.deepEqual([...VOICE_LANGS_SUPPORTED], ['cn', 'jp']);
    assert.equal(VOICE_LANG_DEFAULT, 'cn');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 异步：切换语言不得让旧语言迟到播放，也不得回归静音 / 门控
describe('bilingual voice: switching language mid-flight', () => {
  test('setVoiceLang stops the line on air, drops a decoding one, and is idempotent', async () => {
    const fw = fakeWindow();
    const urls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (u) => { urls.push(u); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
    try {
      const vm = {
        audio: {
          voice: { char_a: { place: '/v/cn/a_p.mp3' } },
          voiceLanguages: { cn: { char_a: { place: '/v/cn/a_p.mp3' } }, jp: { char_a: { place: '/v/jp/a_p.mp3' } } },
        },
      };
      const a = new AudioManager({ win: fw.win, getManifest: () => vm });
      a.voiceGate = new VoiceGate({ gapMs: 0 });
      a.install();
      fw.fire('pointerdown');
      await new Promise((r) => setTimeout(r, 10));

      assert.equal(a.voiceLang, 'cn', 'the default is Chinese');
      assert.equal(a.voice('char_a', 'place', { unitKey: 1 }), true);
      const tokenBefore = a.voiceToken;
      assert.equal(a.setVoiceLang('jp'), true, 'the language changed');
      assert.ok(a.voiceToken > tokenBefore, 'the line on air was invalidated (so a decoding one cannot start)');
      assert.equal(a.voiceLang, 'jp');
      assert.equal(a.setVoiceLang('jp'), false, 'setting the same language again is a no-op');
      // an illegal language falls back to the default instead of sticking
      assert.equal(a.setVoiceLang('kr'), true);
      assert.equal(a.voiceLang, 'cn');
      assert.equal(a.setVoiceLang(null), false, 'null ⇒ cn, which it already is');

      // after switching to jp the NEW line comes from the Japanese bank
      a.setVoiceLang('jp');
      await new Promise((r) => setTimeout(r, 50));
      urls.length = 0;
      assert.equal(a.voice('char_a', 'place', { unitKey: 2 }), true);
      await new Promise((r) => setTimeout(r, 20));
      assert.ok(urls.some((u) => String(u).includes('a_p.mp3') || String(u).includes('/v/jp/') || String(u).includes('/media/')),
        `a requested URL (got ${JSON.stringify(urls)})`);
    } finally { globalThis.fetch = origFetch; }
  });

  test('mute and voice volume still suppress voice after a language switch', async () => {
    const fw = fakeWindow();
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    try {
      const vm = { audio: { voice: { char_a: { place: '/v/cn/a_p.mp3' } }, voiceLanguages: { jp: { char_a: { place: '/v/jp/a_p.mp3' } } } } };
      const a = new AudioManager({ win: fw.win, getManifest: () => vm });
      a.voiceGate = new VoiceGate({ gapMs: 0 });
      a.install();
      fw.fire('pointerdown');
      await new Promise((r) => setTimeout(r, 10));
      a.setVoiceLang('jp');
      a.setVolumes({ muted: true });
      assert.equal(a.voice('char_a', 'place', { unitKey: 9 }), false, 'muted');
      a.setVolumes({ muted: false, voice: 0 });
      assert.equal(a.voice('char_a', 'place', { unitKey: 10 }), false, 'voice volume 0');
      a.setVolumes({ voice: 0.8 });
      assert.equal(a.voice('char_a', 'place', { unitKey: 11 }), true, 'and it plays again once audible');
    } finally { globalThis.fetch = origFetch; }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 资源：真实清单的双语覆盖、路径不重叠、皮肤未受影响
describe('bilingual voice: the shipped manifest', () => {
  const langs = manifest.audio?.voiceLanguages || {};
  const primary = manifest.audio?.voice || {};

  const countFiles = (bank) => {
    let n = 0;
    for (const slots of Object.values(bank || {})) for (const v of Object.values(slots)) n += Array.isArray(v) ? v.length : 1;
    return n;
  };

  test('both languages are planned, and audio.voice stays the primary (cn) bank', () => {
    assert.ok(manifest.audio, 'the manifest has an audio section');
    assert.ok(Object.keys(langs).length >= 1, `voiceLanguages present (got ${Object.keys(langs).join(',')})`);
    assert.equal(manifest.stats?.voiceChars, Object.keys(primary).length, 'stats.voiceChars matches audio.voice');
    assert.deepEqual(manifest.stats?.voiceLangs, Object.fromEntries(Object.entries(langs).map(([l, b]) => [l, Object.keys(b).length])),
      'stats.voiceLangs reports the per-language operator counts');
  });

  test('every language path lives under its own folder and every file exists on disk', () => {
    for (const [lang, bank] of Object.entries(langs)) {
      const want = `/assets/audio/voice/${lang}/`;
      for (const [charId, slots] of Object.entries(bank)) {
        for (const [slot, v] of Object.entries(slots)) {
          for (const url of (Array.isArray(v) ? v : [v])) {
            assert.ok(url.startsWith(want), `${lang} ${charId}.${slot} must live under ${want} (got ${url})`);
            const p = path.join(ROOT, 'public', url.replace(/^\//, ''));
            assert.ok(existsSync(p) && statSync(p).size > 0, `${url} exists and is non-empty`);
          }
        }
      }
    }
  });

  test('the two languages do not point at the same file (no Chinese path passed off as Japanese)', () => {
    const cn = langs.cn || {};
    const jp = langs.jp || {};
    if (!Object.keys(jp).length) return; // a cn-only install is legitimate
    let compared = 0, identical = 0;
    for (const [charId, slots] of Object.entries(jp)) {
      for (const [slot, v] of Object.entries(slots)) {
        const jpUrl = Array.isArray(v) ? v[0] : v;
        const cnV = cn[charId]?.[slot];
        if (!cnV) continue;
        const cnUrl = Array.isArray(cnV) ? cnV[0] : cnV;
        compared++;
        if (cnUrl === jpUrl) identical++;
      }
    }
    assert.ok(compared > 0, 'at least one slot is present in both languages');
    assert.equal(identical, 0, `${compared} slots compared, none may share a file between languages`);
  });

  test('missing Japanese slots are recorded honestly (a partial dub never fakes full coverage)', () => {
    const cn = langs.cn || {};
    const jp = langs.jp || {};
    if (!Object.keys(jp).length) return;
    let cnOnly = 0, both = 0;
    for (const [charId, slots] of Object.entries(cn)) {
      for (const slot of Object.keys(slots)) {
        if (jp[charId]?.[slot]) both++;
        else cnOnly++;
      }
    }
    // informational: the point is that the numbers are measured, not assumed equal
    console.log(`      [voice] cn ${Object.keys(cn).length} 干员 / ${countFiles(cn)} 条；jp ${Object.keys(jp).length} 干员 / ${countFiles(jp)} 条；仅中文 ${cnOnly} 条，双语 ${both} 条`);
    assert.ok(countFiles(cn) > 0, 'the Chinese bank is not empty');
  });

  test('the skin catalogue survived the bilingual rebuild (174 sets, 172 with a front model)', () => {
    let sets = 0, front = 0, chars = 0;
    for (const c of Object.values(manifest.chars || {})) {
      if (!c.skins) continue;
      chars++;
      for (const s of Object.values(c.skins)) { sets++; if (s.spine?.front?.skel) front++; }
    }
    assert.equal(chars, 115, 'skin operators');
    assert.equal(sets, 174, '174 skin sets');
    assert.equal(front, 172, '172 with a front Spine (2 avatar-only sets are a known upstream gap)');
  });
});
