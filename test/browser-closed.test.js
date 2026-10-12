import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import WebSocket from 'ws';
import { startServer } from '../server/index.js';

describe('client-only release gate', () => {
  let server;

  before(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true, clientOnly: true });
  });

  after(async () => {
    await server?.close();
  });

  test('browser sees only the group notice on both home URLs', async () => {
    for (const path of ['/', '/index.html']) {
      const response = await fetch(`${server.url}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } });
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /带宽问题解决后.*重新开放网页版/);
      assert.match(html, /1124360673/);
      assert.doesNotMatch(html, /\/js\/main\.js/);
      assert.match(response.headers.get('cache-control') || '', /no-cache/);
    }
  });

  test('native clients still receive the game', async () => {
    for (const client of ['Windows', 'Android']) {
      const response = await fetch(server.url, { headers: { 'User-Agent': `Mozilla/5.0 SPClient/${client}` } });
      assert.equal(response.status, 200);
      assert.match(await response.text(), /\/js\/main\.js/);
    }
  });

  test('browser sockets cannot enter a match even with a cached page', async () => {
    const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/ws', { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } });
    await assert.rejects(new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    }), /Unexpected server response: 403/);
  });

  test('native client sockets can connect', async () => {
    const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/ws', { headers: { 'User-Agent': 'Mozilla/5.0 SPClient/Windows' } });
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    socket.close();
  });
});
