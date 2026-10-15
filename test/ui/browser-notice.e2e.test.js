// 真浏览器验证浏览器公告（opt-in，~20 s）：
//   SP_E2E=1 CHROME_PATH=… node --test test/ui/browser-notice.e2e.test.js
//
// 要验的是单向安全要求：
//   • 浏览器用户 → 看到公告（带宽所限不再支持网页玩，引导进群）
//   • 原生客户端（UA 带 SPClient/Windows 或 SPClient/Android）→ **绝对看不到**
//   • 关掉之后刷新不再弹，且游戏照常继续
//
// UA 取自 2026-10-11 服务器访问日志的真实样本；客户端标识由
// windows/Program.cs:220（" SPClient/Windows"）与 android/MainActivity.java:111（" SPClient/Android"）设置。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ENABLED = process.env.SP_E2E === '1' && existsSync(CHROME);

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0';
const UA_CLIENT = UA_BROWSER + ' SPClient/Windows';
const UA_CLIENT_ANDROID = 'Mozilla/5.0 (Linux; Android 16; XT2601-1 Build/W1WR36.39-101-1; wv) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.39 Mobile Safari/537.36 SPClient/Android';

describe('浏览器公告（真浏览器）', { skip: !ENABLED && 'set SP_E2E=1 (and have Chrome) to run' }, () => {
  let srv;
  let browser;
  let base;
  let dataDir;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'sp-notice-e2e-'));
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
   * 新开一页（可选指定 UA）。
   * `networkidle0` 是必须的：用 `domcontentloaded` 会在 app 渲染出标题页之前就往下走，
   * 于是「关掉公告后标题页在不在」这类断言会假失败（实测踩过）。
   * `fresh: true`（默认）先清一次 localStorage —— 同一 browser 实例的各测试共享 profile，
   * 上一个测试关掉公告留下的 `sp.notice.dismissed` 会让下一个测试等一个永远不弹的公告。
   */
  async function open(ua, { fresh = true } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    if (ua) await page.setUserAgent(ua);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });
    if (fresh) {
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* 忽略 */ } });
      await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
    }
    await page.waitForFunction(() => !!document.getElementById('distribution-notice'), { timeout: 15000 });
    return { page, errors };
  }

  /** 等公告弹出来（应弹的场景用）。 */
  const waitNoticeShown = (page, timeout = 8000) => page.waitForFunction(
    () => !document.getElementById('distribution-notice').hidden, { timeout });

  /** 等一小会儿，用于确认「不该弹」的场景确实没弹。 */
  const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));

  const noticeVisible = (page) => page.evaluate(() => {
    const el = document.getElementById('distribution-notice');
    if (!el) return false;
    return !el.hidden && getComputedStyle(el).display !== 'none';
  });

  const noticeText = (page) => page.evaluate(() => document.getElementById('distribution-notice')?.textContent.replace(/\s+/g, ' ').trim() ?? '');

  test('浏览器用户：看到公告，文案含「已恢复」与群号', async () => {
    const { page, errors } = await open(UA_BROWSER);
    try {
      await waitNoticeShown(page);
      assert.equal(await noticeVisible(page), true, '浏览器用户必须看到公告');
      const text = await noticeText(page);
      assert.match(text, /已恢复/, `公告应说明网页版已恢复，实际：${text}`);
      assert.match(text, /浏览器/, `公告应说明可直接在浏览器游玩，实际：${text}`);
      assert.match(text, /1124360673/, '公告应含 QQ 群号');
      assert.match(text, /客户端/, '公告应引导下载客户端');
      assert.deepEqual(errors, [], `页面不应有 JS 错误：${errors.join(' | ')}`);
    } finally {
      await page.close();
    }
  });

  test('关掉之后刷新不再弹（记住用户已读）', async () => {
    const { page } = await open(UA_BROWSER);
    try {
      await waitNoticeShown(page);
      await page.click('[data-notice-dismiss]');
      await page.waitForFunction(() => document.getElementById('distribution-notice').hidden, { timeout: 4000 });
      await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => !!document.getElementById('distribution-notice'), { timeout: 15000 });
      await settle(1200); // 给 boot 时间决定弹不弹
      assert.equal(await noticeVisible(page), false, '关过之后刷新不该再弹');
    } finally {
      await page.close();
    }
  });

  test('★ 原生客户端（SPClient/Windows）：绝不弹公告', async () => {
    const { page, errors } = await open(UA_CLIENT);
    try {
      await settle(); // 等 boot 走完
      assert.equal(await noticeVisible(page), false,
        `客户端绝不能看到「浏览器版停用」的公告！实际文案：${await noticeText(page)}`);
      assert.deepEqual(errors, [], `页面不应有 JS 错误：${errors.join(' | ')}`);
    } finally {
      await page.close();
    }
  });

  test('★ 原生客户端（Android SPClient/Android + ; wv）：绝不弹公告', async () => {
    const { page } = await open(UA_CLIENT_ANDROID);
    try {
      await settle();
      assert.equal(await noticeVisible(page), false,
        `Android 客户端绝不能看到该公告！实际文案：${await noticeText(page)}`);
    } finally {
      await page.close();
    }
  });

  test('关掉公告后游戏界面照常（公告不挡路）', async () => {
    const { page, errors } = await open(UA_BROWSER);
    try {
      await waitNoticeShown(page);
      await page.click('[data-notice-dismiss]');
      // 标题页应可交互（登录/注册入口在，与其它 e2e 同一判据）
      const hasTitle = await page.waitForSelector('.title-screen', { timeout: 20000 }).then(() => true).catch(() => false);
      const hasInput = await page.waitForSelector('.title-login input', { timeout: 20000 }).then(() => true).catch(() => false);
      assert.equal(hasTitle, true, '关掉公告后标题页应正常出现');
      assert.equal(hasInput, true, '关掉公告后登录入口应可用');
      assert.deepEqual(errors, [], `不应有 JS 错误：${errors.join(' | ')}`);
    } finally {
      await page.close();
    }
  });
});
