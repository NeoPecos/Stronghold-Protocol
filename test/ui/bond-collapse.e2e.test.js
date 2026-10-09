import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ENABLED = process.env.SP_E2E === '1' && existsSync(CHROME);

describe('fixed-width bond strip', { skip: !ENABLED && 'set SP_E2E=1 and CHROME_PATH to run' }, () => {
  let server;
  let browser;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
  });

  after(async () => {
    await browser?.close();
    await server?.close();
  });

  for (const [width, height, touch] of [[1920, 1080, false], [640, 360, true]]) {
    test(`all bonds remain reachable at ${width}×${height}`, async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width, height, isMobile: touch, hasTouch: touch });
        await page.goto(`${server.url}/dev/game-mock.html?shot=1&render=fallback&phase=PREP`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.bslot .bond');

        assert.equal(await page.$('.bonds-toggle'), null);
        const initial = await page.$eval('.gm__bond-list', (element) => ({
          visible: element.clientWidth,
          full: element.scrollWidth,
          touchAction: getComputedStyle(element).touchAction,
        }));
        assert.ok(initial.full > initial.visible, 'the fixed window clips excess bonds');
        assert.equal(initial.touchAction, 'pan-x');

        const firstBond = await page.$('.gm__bond-list .bslot:first-of-type .bond');
        const firstBounds = await firstBond.boundingBox();
        const startX = firstBounds.x + firstBounds.width / 2;
        const startY = firstBounds.y + firstBounds.height / 2;
        if (touch) {
          const client = await page.target().createCDPSession();
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] });
          for (let step = 1; step <= 6; step++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - step * 18, y: startY }] });
          }
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.move(startX, startY);
          await page.mouse.wheel({ deltaX: 120, deltaY: 0 });
        }
        await page.waitForFunction(() => document.querySelector('.gm__bond-list').scrollLeft > 0);

        await page.$eval('.gm__bond-list', (element) => { element.scrollLeft = element.scrollWidth; });
        const end = await page.$eval('.gm__bond-list', (element) => ({
          offset: element.scrollLeft,
          right: element.getBoundingClientRect().right,
          last: element.querySelector('.bslot:last-of-type .bond').getBoundingClientRect().right,
        }));
        assert.ok(end.offset > 0, 'the strip scrolls horizontally');
        assert.ok(end.last <= end.right + 1, 'the last bond is visible after scrolling');

        const lastBond = '.gm__bond-list .bslot:last-of-type .bond';
        if (touch) await page.tap(lastBond);
        else await page.click(lastBond);
        await page.waitForSelector('.bpop');
      } finally {
        await page.close();
      }
    });
  }
});
