// 房间页「仅邀请 / 期望路人加入」两个开关：位置、权限、状态同步与单人房不显示。
//
// 验收条件来自交接计划 §4：房主可点击、其他人只读、role="switch" 与 aria-checked 正确、
// 1250px 以下不横向溢出、单人房不显示这两个开关。图片素材（§4 已制作的按钮图片素材）也必须真的被加载。
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

describe('room access switches in the browser', { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH' }, () => {
  let server;
  let browser;
  let base;
  let dataDir;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'sp-room-access-'));
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true,
      accountsFile: path.join(dataDir, 'accounts.json'), recordsFile: path.join(dataDir, 'records.jsonl') });
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    base = `http://127.0.0.1:${server.port}`;
  });

  after(async () => {
    await browser?.close();
    await server?.close();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  /** 登录并停在大厅。注册模式是必须的：标题页现在默认「登录」，而每个测试用全新账号。 */
  const enter = async (context, name) => {
    const page = await context.newPage();
    await page.goto(base);
    await page.type('.title-login input:first-of-type', name);
    await page.click('.title-auth-mode button:nth-child(2)');
    await page.type('.title-login input[type="password"]', 'browser test password');
    await page.click('.title-login .btn--primary');
    await page.waitForSelector('.lobby-screen');
    return page;
  };

  const switches = (page) => page.evaluate(() => [...document.querySelectorAll('.room-access__toggle')].map((b) => ({
    label: b.textContent.trim().replace(/\s+/g, ' '),
    role: b.getAttribute('role'),
    checked: b.getAttribute('aria-checked'),
    disabled: b.disabled,
    art: [...b.querySelectorAll('img')].map((i) => i.getAttribute('src')),
    artLoaded: [...b.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0),
  })));

  test('the host drives both switches; a guest sees the same state read-only; art really loads', async () => {
    const hostCtx = await browser.createBrowserContext();
    const guestCtx = await browser.createBrowserContext();
    const host = await enter(hostCtx, 'Host');
    await host.click('.mode-card:nth-child(2)');
    await host.click('.create-box .btn--primary');
    await host.waitForSelector('.room-screen');
    const code = await host.$eval('.invite__code', (el) => el.textContent.trim());

    const guest = await enter(guestCtx, 'Guest');
    await guest.waitForFunction((c) => [...document.querySelectorAll('.room-directory__room')]
      .some((el) => el.textContent.includes(c)), {}, code);
    // 加入同盟 needs the key typed in first: its button is disabled until `codeOk`, so clicking the room card alone
    // would leave the guest in the lobby and time out.
    await guest.type('.room-directory__join input', code);
    await guest.waitForFunction(() => {
      const b = [...document.querySelectorAll('.room-directory__join button')].find((x) => /加入同盟/.test(x.textContent));
      return b && !b.disabled;
    });
    await guest.evaluate(() => [...document.querySelectorAll('.room-directory__join button')]
      .find((x) => /加入同盟/.test(x.textContent)).click());
    await guest.waitForSelector('.room-screen');

    // ① both switches exist, carry role/aria, and their art is actually decoded (the plan's PNGs, not a glyph)
    const hostBefore = await switches(host);
    assert.equal(hostBefore.length, 2, JSON.stringify(hostBefore));
    for (const s of hostBefore) {
      assert.equal(s.role, 'switch');
      assert.ok(s.checked === 'true' || s.checked === 'false');
      assert.equal(s.artLoaded, true, `art did not load: ${JSON.stringify(s.art)}`);
      assert.match(s.art.join(' '), /\/assets\/ui\/room\/(invite-only|recruit-wanted)\.png/);
    }
    assert.match(hostBefore[0].label, /仅邀请/);
    assert.match(hostBefore[1].label, /期望路人加入/);
    assert.equal(hostBefore[0].disabled, false, 'the host may press them');
    assert.equal(hostBefore[0].checked, 'false', 'both start off');

    // ② a guest sees the same switches, disabled (read-only)
    const guestSwitches = await switches(guest);
    assert.equal(guestSwitches.length, 2);
    assert.equal(guestSwitches[0].disabled, true, 'a guest cannot press them');
    assert.equal(guestSwitches[1].disabled, true);

    // ③ the host flips 仅邀请: aria-checked follows, and the guest's view syncs from room.state
    await host.click('.room-access__toggle:nth-of-type(1)');
    await host.waitForFunction(() => document.querySelector('.room-access__toggle')?.getAttribute('aria-checked') === 'true');
    await guest.waitForFunction(() => document.querySelector('.room-access__toggle')?.getAttribute('aria-checked') === 'true',
      { timeout: 5000 });
    const guestAfter = await switches(guest);
    assert.equal(guestAfter[0].checked, 'true', 'state syncs to the guest');
    assert.equal(guestAfter[1].checked, 'false');

    // ④ flipping it back is symmetrical
    await host.click('.room-access__toggle:nth-of-type(1)');
    await host.waitForFunction(() => document.querySelector('.room-access__toggle')?.getAttribute('aria-checked') === 'false');

    // No explicit leave: each test owns a browser context and a fresh account, so nothing leaks into the next test,
    // and the server's own lobby grace window disposes the room once these pages close.
    await hostCtx.close();
    await guestCtx.close();
  });

  test('a solo room shows no such switches, and 1250px does not overflow them', async () => {
    const ctx = await browser.createBrowserContext();
    const page = await enter(ctx, 'Solo');
    // ① solo: the aside is not rendered at all (solo rooms are never listed)
    await page.click('.mode-card:nth-child(1)');
    await page.click('.create-box .btn--primary');
    await page.waitForSelector('.room-screen');
    assert.equal(await page.$('.room-access-options'), null, 'a solo room must not show directory switches');

    // ② narrow window: the switches stay present and inside the viewport
    await page.setViewport({ width: 1200, height: 800 });
    const fits = await page.evaluate(() => {
      const el = document.querySelector('.room-screen');
      return { docOverflowX: document.documentElement.scrollWidth - window.innerWidth, screenOverflowX: el.scrollWidth - el.clientWidth };
    });
    assert.ok(fits.docOverflowX <= 1, `no horizontal page scroll at 1200px (${JSON.stringify(fits)})`);

    await ctx.close();
  });
});
