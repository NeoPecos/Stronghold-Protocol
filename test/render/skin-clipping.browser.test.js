import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.RENDER_E2E === '1' && existsSync(CHROME) && existsSync(path.join(ROOT, 'public/assets'));

test('multiple skinned operators retain clipping masks at every quality level', { skip: enabled ? false : 'set RENDER_E2E=1 with Chrome and assets' }, async () => {
  const puppeteer = (await import('puppeteer-core')).default;
  const { startServer } = await import('../../server/index.js');
  const server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    await page.goto(`http://127.0.0.1:${server.port}/dev/game-mock.html?phase=PREP&render=engine&shot=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => globalThis.__MOCK__?.mutate && globalThis.__SP_VIEW__?.raw?.debug, { timeout: 30000 });
    const ids = await page.evaluate(() => {
      const ids = [];
      globalThis.__MOCK__.mutate((state) => {
        for (const piece of state.priv.board.slice(0, 2)) {
          piece.id = 'chess_char_3_04_a';
          piece.golden = false;
          piece.skin = 'char_1033_swire2@ambienceSynesthesia#4';
          ids.push(piece.uid);
        }
      });
      return ids;
    });
    await page.waitForFunction((unitIds) => unitIds.every((id) => globalThis.__SP_VIEW__.raw.debug.views.get(`p:${id}`)?.spineReady), { timeout: 30000 }, ids);
    for (const quality of ['high', 'medium', 'low']) {
      await page.evaluate((value) => globalThis.__SP_VIEW__.raw.setSettings({ quality: value }), quality);
      await page.waitForFunction((unitIds) => unitIds.every((id) => globalThis.__SP_VIEW__.raw.debug.views.get(`p:${id}`)?.imp?.slot), { timeout: 10000 }, ids);
      const views = await page.evaluate((unitIds) => unitIds.map((id) => {
        const view = globalThis.__SP_VIEW__.raw.debug.views.get(`p:${id}`);
        const masks = view.actor.spine.skeleton.slots.filter((slot) => slot.clippingContainer).map((slot) => !!slot.clippingContainer.mask);
        return { clipped: view.actor.clipped, masks, atlasClip: view.imp.slot.clip };
      }), ids);
      for (const view of views) {
        assert.equal(view.clipped, true, quality);
        assert.ok(view.masks.length > 0 && view.masks.every(Boolean), `${quality}: clipping masks stay active`);
        assert.equal(view.atlasClip, true, `${quality}: clipped model uses a stencil-enabled atlas`);
      }
    }
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
});
