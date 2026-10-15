// TASK-007 — the fullscreen button belongs to the browser, not to the native clients.
//
// Requirement: the title screen keeps its 全屏 control in a browser, and the Windows and Android clients show no such
// control at all — they are already the whole screen and the wrapper owns fullscreen. The clients must not reach the
// Fullscreen API either, so this test also pins that the button's handler is gone rather than merely hidden, and that
// no `fullscreenchange` listener was attached on a client.
//
// Opt-in like the rest of the browser suites:
//   SP_E2E=1 CHROME_PATH=… node --test test/ui/fullscreen-button.e2e.test.js
//
// The user agents are the real shapes the wrappers send: ` SPClient/Windows` (windows/Program.cs) and
// `; wv` + ` SPClient/Android` (android/MainActivity.java).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ENABLED = process.env.SP_E2E === '1' && existsSync(CHROME);

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0';
const UA_WINDOWS = UA_BROWSER + ' SPClient/Windows';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 16; XT2601-1 Build/W1WR36.39-101-1; wv) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.39 Mobile Safari/537.36 SPClient/Android';

describe('TASK-007: the fullscreen button shows in a browser only', { skip: !ENABLED && 'set SP_E2E=1 (and have Chrome) to run' }, () => {
  let srv, browser, base, dataDir;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'sp-fsbtn-e2e-'));
    srv = await startServer({
      port: 0, host: '127.0.0.1', quiet: true,
      accountsFile: path.join(dataDir, 'accounts.json'),
      recordsFile: path.join(dataDir, 'records.jsonl'),
    });
    base = `http://127.0.0.1:${srv.port}`;
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  });

  after(async () => {
    await browser?.close();
    await srv?.close();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  /**
   * Open the title screen with a given user agent. The stubs are installed before any page script runs, so they catch
   * everything the app does during boot:
   *   • `__FS_CALLS` — every attempt to enter or leave fullscreen, including the webkit spellings;
   *   • `__FS_LISTENERS` — 1 when the page subscribed to a fullscreenchange event.
   */
  async function open(ua) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(ua);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.evaluateOnNewDocument(() => {
      globalThis.__FS_CALLS = [];
      globalThis.__FS_LISTENERS = 0;
      const el = document.documentElement;
      for (const name of ['requestFullscreen', 'webkitRequestFullscreen']) {
        try {
          Object.defineProperty(el, name, { configurable: true, writable: true, value: () => { globalThis.__FS_CALLS.push(name); return Promise.resolve(); } });
        } catch { /* the platform may refuse the redefinition: the assertion then simply sees no calls */ }
      }
      for (const name of ['fullscreenchange', 'webkitfullscreenchange']) {
        const add = document.addEventListener.bind(document);
        document.addEventListener = (type, ...rest) => { if (type === name) globalThis.__FS_LISTENERS++; return add(type, ...rest); };
      }
      // Android Chrome: the client must not ask for a landscape lock either
      try {
        Object.defineProperty(screen.orientation ?? (screen, 'orientation'), 'lock', { configurable: true, writable: true, value: () => { globalThis.__FS_CALLS.push('orientationLock'); return Promise.resolve(); } });
      } catch { /* ignore */ }
    });
    await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });
    // the title screen is what renders first (no session needed); give it a beat to mount
    await page.waitForFunction(() => !!document.querySelector('.title-screen, .fsbtn'), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    return { page, errors };
  }

  // The title screen's settings button reuses the `fsbtn` class for its look (title.js:309), so select the real
  // control by its own class (`title-fs`, the one FullscreenButton is given at title.js:312) and confirm it by aria.
  const fsButtons = (page) => page.evaluate(() => {
    const btns = [...document.querySelectorAll('.title-fs')];
    return {
      count: btns.length,
      visible: btns.filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).display !== 'none'; }).length,
      aria: btns.map((b) => b.getAttribute('aria-label')),
      calls: globalThis.__FS_CALLS || [],
      listeners: globalThis.__FS_LISTENERS || 0,
    };
  });

  test('browser: the title screen shows a working 全屏 button', async () => {
    const { page, errors } = await open(UA_BROWSER);
    try {
      const r = await fsButtons(page);
      assert.equal(r.count, 1, 'exactly one fullscreen button on the title screen');
      assert.equal(r.visible, 1, 'and it is visible');
      assert.deepEqual(r.aria, ['全屏'], 'it is the fullscreen control, not the settings button');
      const label = await page.$eval('.title-fs', (b) => ({ aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') }));
      assert.equal(label.pressed, 'false');
      assert.deepEqual(r.calls, [], 'no fullscreen call merely from rendering');
      // both spellings are watched (standard + webkit), and that is the whole point of the browser case
      assert.equal(r.listeners, 2, 'the browser subscribes to fullscreenchange + webkitfullscreenchange');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test('Windows client (SPClient/Windows): no button, no Fullscreen API, no listener', async () => {
    const { page, errors } = await open(UA_WINDOWS);
    try {
      const r = await fsButtons(page);
      assert.equal(r.count, 0, 'the Windows client shows no fullscreen control');
      assert.deepEqual(r.calls, [], 'and never calls the Fullscreen API');
      assert.equal(r.listeners, 0, 'and never subscribes to fullscreenchange');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test('Android client (SPClient/Android + wv): no button, no Fullscreen API, no listener', async () => {
    const { page, errors } = await open(UA_ANDROID);
    try {
      const r = await fsButtons(page);
      assert.equal(r.count, 0, 'the Android client shows no fullscreen control');
      assert.deepEqual(r.calls, [], 'and never calls the Fullscreen API or the orientation lock');
      assert.equal(r.listeners, 0, 'and never subscribes to fullscreenchange');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
});
