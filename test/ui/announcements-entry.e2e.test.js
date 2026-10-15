import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

test('published announcements appear on the title page and can be reopened', { skip: !enabled }, async () => {
  const { startServer } = await import('../../server/index.js');
  const puppeteer = (await import('puppeteer-core')).default;
  const temp = mkdtempSync(path.join(os.tmpdir(), 'sp-announcements-e2e-'));
  let server;
  let browser;
  try {
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true,
      announcementsDir: path.join(temp, 'announcements'),
      accountsFile: path.join(temp, 'accounts.json'), recordsFile: path.join(temp, 'records.jsonl') });
    server.announcements.publish({ id: 'welcome', title: '开服公告', markdown: '新公告正文', pin: true });
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(server.url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('.modal__box.announcements', { visible: true, timeout: 15000 });
    assert.match(await page.$eval('.modal__box.announcements', (node) => node.textContent), /开服公告|新公告正文/);
    assert.equal(await page.$$eval('[data-testid="announcements-open"]', (nodes) => nodes.length > 0), true);
    assert.equal(await page.$('#distribution-notice'), null);
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(temp, { recursive: true, force: true });
  }
});
