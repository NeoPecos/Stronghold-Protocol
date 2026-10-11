import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

describe('room directory in the browser', { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH' }, () => {
  let server;
  let browser;
  let base;
  let dataDir;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'sp-room-e2e-'));
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

  test('a guest joins from the list and the host removes them from the waiting room', async () => {
    const hostContext = await browser.createBrowserContext();
    const guestContext = await browser.createBrowserContext();
    try {
      const enter = async (context, name) => {
        const page = await context.newPage();
        await page.goto(base);
        await page.type('.title-login input:first-of-type', name);
        // the title screen now DEFAULTS to 登录 (owner request, 2026-10-11): a test that types a fresh
        // account still has to pick 注册账号 first, or it tries to log into an account that does not exist.
        await page.click('.title-auth-mode button:nth-child(2)'); // -- register mode
        await page.type('.title-login input[type="password"]', 'browser test password');
        await page.click('.title-login .btn--primary');
        await page.waitForSelector('.lobby-screen');
        return page;
      };
      const host = await enter(hostContext, 'Host');
      await host.click('.mode-card:nth-child(2)');
      await host.click('.create-box .btn--primary');
      await host.waitForSelector('.room-screen');
      const code = await host.$eval('.invite__code', (element) => element.textContent.trim());
      await host.click('.room-access__toggle:nth-of-type(2)');
      await host.waitForFunction(() => document.querySelectorAll('.room-access__toggle')[1]?.getAttribute('aria-checked') === 'true');

      const guest = await enter(guestContext, 'Guest');
      await guest.waitForFunction((expected) => [...document.querySelectorAll('.room-directory__room')]
        .some((element) => element.textContent.includes(expected)), {}, code);
      await guest.setViewport({ width: 1423, height: 764 });
      await guest.evaluate(() => {
        const list = document.querySelector('.room-directory__list');
        for (let count = 0; count < 2; count++) list.appendChild(list.firstElementChild.cloneNode(true));
      });
      const lobbyLayout = await guest.evaluate(() => {
        const body = document.querySelector('.lobby-body');
        const dir = document.querySelector('.room-directory');
        const create = document.querySelector('.create-box');
        const tips = document.querySelector('.tips');
        // The join controls no longer live in their own panel (`join-panel`): 加入同盟 moved into the 服务器房间
        // panel's title row (plan item 3, 2026-10-11), so assert the new structure instead of the old one.
        const join = document.querySelector('.room-directory__join');
        const joinBox = join?.getBoundingClientRect();
        const titleBox = document.querySelector('.room-directory .panel__title')?.getBoundingClientRect();
        return {
          joinInDirectoryHead: !!(join && join.closest('.panel__head')),
          // left→right in the header: the title starts before the join controls do
          titleBeforeJoin: !!(titleBox && joinBox && titleBox.left < joinBox.right),
          hasRecent: !!document.querySelector('.room-directory__recent'),
          overflow: body.scrollHeight - body.clientHeight,
          directoryBottom: dir.getBoundingClientRect().bottom,
          createBottom: create.getBoundingClientRect().bottom,
          // 作战提示 now sits at the bottom of the right column (plan item 2)
          tipsRightOfDirectory: !!(tips && tips.getBoundingClientRect().left >= dir.getBoundingClientRect().right - 1),
          viewportBottom: window.innerHeight,
        };
      });
      assert.equal(lobbyLayout.joinInDirectoryHead, true, '加入 controls moved into the panel head');
      assert.equal(lobbyLayout.titleBeforeJoin, true, 'header reads title → join controls, left to right');
      assert.equal(lobbyLayout.hasRecent, true, '最近的同盟 still lives inside that panel');
      assert.ok(lobbyLayout.tipsRightOfDirectory, '作战提示 sits in the right column (bottom-right), not the left');
      assert.ok(lobbyLayout.overflow <= 1, JSON.stringify(lobbyLayout));
      assert.ok(lobbyLayout.directoryBottom <= lobbyLayout.viewportBottom, JSON.stringify(lobbyLayout));
      assert.ok(lobbyLayout.createBottom <= lobbyLayout.viewportBottom, JSON.stringify(lobbyLayout));

      // The lobby must fit without a page scrollbar at the three resolutions the plan names. The room list is the
      // only thing allowed to scroll (it scrolls itself), so every viewport has to keep .lobby-body unoverflowed.
      for (const size of [{ width: 1920, height: 1080 }, { width: 1423, height: 764 }, { width: 1280, height: 720 }]) {
        await guest.setViewport(size);
        const fit = await guest.evaluate(() => {
          const body = document.querySelector('.lobby-body');
          const list = document.querySelector('.room-directory__list');
          const create = document.querySelector('.create-box');
          return {
            overflow: body.scrollHeight - body.clientHeight,
            listScrolls: list.scrollHeight - list.clientHeight, // > 0 is fine: the list is meant to scroll inside
            createBottom: create.getBoundingClientRect().bottom,
            viewportBottom: window.innerHeight,
          };
        });
        assert.ok(fit.overflow <= 1, `${size.width}x${size.height}: page must not scroll (${JSON.stringify(fit)})`);
        assert.ok(fit.createBottom <= fit.viewportBottom, `${size.width}x${size.height}: 创建 box inside the viewport`);
      }
      await guest.evaluate(() => {
        const list = document.querySelector('.room-directory__list');
        while (list.children.length > 1) list.lastElementChild.remove();
      });
      const listing = await guest.$eval('.room-directory__room', (element) => element.textContent);
      assert.match(listing, /Host/);
      assert.match(listing, /期望路人加入/);
      assert.match(listing, /1\/4/);
      assert.match(listing, /在线 1 人/);
      assert.match(listing, /近5分钟操作 1 人/);
      const recruitTag = await guest.$eval('.room-directory__recruit', (element) => ({
        parent: element.parentElement?.className,
        afterHost: element.previousElementSibling?.classList.contains('room-directory__host'),
      }));
      assert.match(recruitTag.parent, /room-directory__identity/, 'the tag stays on the first line beside the host');
      assert.equal(recruitTag.afterHost, true, 'the tag is immediately after the host name');
      const hostSession = server.registry.byId(server.lobby.getRoom(code).hostId);
      hostSession.lastInputAt = 0;
      await guest.evaluate(() => window.__SP__.net.request('room.list'));
      await guest.waitForFunction(() => document.querySelector('.room-directory__room')?.textContent.includes('近5分钟操作 0 人'));
      // The host just used the recruitment switch, so advance the page clock past the 15 s activity throttle
      // instead of turning this regression test into a real-time 15-second wait.
      await host.evaluate(() => {
        const realNow = Date.now;
        Date.now = () => realNow() + 16_000;
        try { window.dispatchEvent(new PointerEvent('pointerdown')); } finally { Date.now = realNow; }
      });
      for (let attempts = 0; attempts < 50 && hostSession.lastInputAt === 0; attempts++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(hostSession.lastInputAt > 0);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await guest.evaluate(() => window.__SP__.net.request('room.list'));
      await guest.waitForFunction(() => document.querySelector('.room-directory__room')?.textContent.includes('近5分钟操作 1 人'));
      await guest.click('.room-directory__room .btn--primary');
      await guest.waitForSelector('.room-screen');
      await host.waitForFunction(() => [...document.querySelectorAll('.seat__name')]
        .some((element) => element.textContent === 'Guest'));

      await host.click('button[aria-label="移出该博士"]');
      await host.waitForSelector('.modal__actions .btn--danger');
      await host.click('.modal__actions .btn--danger');
      await guest.waitForSelector('.lobby-screen');
      await host.waitForFunction(() => ![...document.querySelectorAll('.seat__name')]
        .some((element) => element.textContent === 'Guest'));
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
