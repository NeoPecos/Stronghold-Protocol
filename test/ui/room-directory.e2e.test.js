import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

describe('room directory in the browser', { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH' }, () => {
  let server;
  let browser;
  let base;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    base = `http://127.0.0.1:${server.port}`;
  });

  after(async () => {
    await browser?.close();
    await server?.close();
  });

  test('a guest joins from the list and the host removes them from the waiting room', async () => {
    const hostContext = await browser.createBrowserContext();
    const guestContext = await browser.createBrowserContext();
    try {
      const enter = async (context, name) => {
        const page = await context.newPage();
        await page.goto(base);
        await page.type('.title-login input', name);
        await page.click('.title-login .btn--primary');
        await page.waitForSelector('.lobby-screen');
        return page;
      };
      const host = await enter(hostContext, 'Host');
      await host.click('.mode-card:nth-child(2)');
      await host.click('.create-box .btn--primary');
      await host.waitForSelector('.room-screen');
      const code = await host.$eval('.invite__code', (element) => element.textContent.trim());

      const guest = await enter(guestContext, 'Guest');
      await guest.waitForFunction((expected) => [...document.querySelectorAll('.room-directory__room')]
        .some((element) => element.textContent.includes(expected)), {}, code);
      const listing = await guest.$eval('.room-directory__room', (element) => element.textContent);
      assert.match(listing, /Host/);
      assert.match(listing, /1\/4/);
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
