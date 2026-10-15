// server/http/routes.js — the node:http request listener. Every response gets the security headers (common.js), then:
// (i18n-ignore-file: the error pages are bilingual by design, 中文 · English — docs/I18N.md)
//
//   * a URL longer than 4096 characters → 414; one that does not parse → 400;
//   * any method but GET / HEAD → 405 with `Allow: GET, HEAD`, except the one POST below;
//   * GET /healthz → JSON status (protocol `version`, release `app`, uptime, the served `build`, sockets, sessions,
//     rooms, matches), never cached; `?traffic=1` adds the traffic counters (traffic.js: bytes by category since the
//     start, WebSocket wire and payload bytes) for a loopback or private-network client only — the maintainer's
//     decision of 2026-10-12: the figures are the host's, so any other client, also one a tunnel or proxy on this
//     machine forwards, gets the plain report (net.js clientAddress, honouring TRUST_PROXY like the WebSocket limits);
//   * GET /api/records/<CODE> → the latest finished match of that room code (4 letters), `publicRecord` only;
//   * GET /api/records/account/<NAME> → the latest finished match of that account;
//   * POST /api/account/password → change an account's password, requiring the admin token and old password;
//   * everything else → the static files (static.js).
// Every response's body bytes count in the traffic counters (traffic.js meter). A route that throws is logged and
// answers 500.
// The account/admin routes require SP_ADMIN_TOKEN; if unset they answer 404. The token never appears in responses.

import { timingSafeEqual } from 'node:crypto';
import { PROTOCOL_VERSION, APP_VERSION } from '../../shared/constants.js';
import { buildTag } from './buildTag.js';
import { setSecurityHeaders, sendError, sendJson, splitUrl } from './common.js';
import { clientAddress, isLocalIp } from '../net.js';

const MAX_URL_LENGTH = 4096;
const MAX_ADMIN_BODY = 8192;
const MIN_TOKEN_LENGTH = 16;

/** Constant-time string compare that never throws on length mismatch (and never leaks the length by timing). */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** The whole JSON body of a small request; over `MAX_ADMIN_BODY` ⇒ null (the caller answers 413). */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_ADMIN_BODY) { resolve('too-large'); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * The GET /healthz body (`withTraffic`: plus the traffic counters and the asset index's state, `?traffic=1`).
 * @param {{ startedAt: number, network: import('../net.js').Network, registry: import('../net.js').SessionRegistry,
 *           lobby: import('../lobby.js').Lobby, traffic?: ReturnType<typeof import('./traffic.js').createTrafficCounter>,
 *           assetIndex?: ReturnType<typeof import('./assetIndex.js').createAssetIndex> | null,
 *           views?: ReturnType<typeof import('./assetViews.js').createManifestViews> | null }} health
 * @param {boolean} [withTraffic]
 */
export function healthReport({ startedAt, network, registry, lobby, traffic, assetIndex, views }, withTraffic = false) {
  const report = {
    ok: true, version: PROTOCOL_VERSION, app: APP_VERSION, uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    // the runtime the server is serving right now (public/js/ui/buildGuard.js): a page whose own build is
    // older than this reloads itself, so a deploy reaches clients that never reload
    build: buildTag(),
    sockets: network.connectionCount, sessions: registry.size, ...lobby.stats(),
  };
  if (withTraffic && traffic) report.traffic = traffic.snapshot();
  // content-hashed asset URLs (assetIndex.js / assetViews.js): off, building, or ready with how many files and URLs
  if (withTraffic) report.assetHashes = assetIndex ? { ...assetIndex.stats(), views: views ? views.stats() : null } : null;
  return report;
}

/** Does the query ask for the traffic counters (`traffic`, `traffic=1`, `traffic=true`)? */
const wantsTraffic = (query) => /(?:^|&)traffic(?:=(?:1|true|yes))?(?:&|$)/i.test(query || '');

/**
 * The request listener for `http.createServer`.
 * @param {{ serveStatic: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse,
 *             rawPath: string, query: string) => Promise<void>,
 *           health: Parameters<typeof healthReport>[0], records?: import('../matchRecords.js').MatchRecords,
 *           accounts?: import('../accounts.js').AccountStore|null, adminToken?: string|null,
 *           log: object, trustProxy?: 'auto' | boolean }} deps
 *   trustProxy: whose forwarding headers name the client (net.js clientAddress; the server's TRUST_PROXY)
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createRequestHandler({ serveStatic, health, records, accounts = null, adminToken = null, log, trustProxy = 'auto' }) {
  const token = typeof adminToken === 'string' && adminToken.length >= MIN_TOKEN_LENGTH ? adminToken : null;
  if (adminToken && !token) log.warn(`[http] SP_ADMIN_TOKEN 短于 ${MIN_TOKEN_LENGTH} 字符，账号接口保持关闭 · admin token too short, account routes stay off`);
  async function handleRequest(req, res) {
    const url = req.url || '/';
    if (url.length > MAX_URL_LENGTH) { sendError(req, res, 414, '请求地址过长 · URI too long'); return; }
    const parts = splitUrl(url);
    if (!parts) { sendError(req, res, 400, '请求地址无效 · Bad request'); return; }

    if (['/api/admin/announcement', '/api/admin/announcement/cancel', '/api/admin/kick'].includes(parts.rawPath)) {
      res.setHeader('Cache-Control', 'no-store');
      if (!token) { sendJson(req, res, 404, { error: 'NOT_ENABLED' }); return; }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(req, res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      if (!sameSecret(req.headers['x-sp-admin-token'], token)) {
        log.warn('[admin] rejected unauthenticated request');
        sendJson(req, res, 401, { error: 'UNAUTHORIZED' });
        return;
      }
      const body = await readJsonBody(req);
      if (body === 'too-large') { sendJson(req, res, 413, { error: 'TOO_LARGE' }); return; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(req, res, 400, { error: 'BAD_REQUEST' }); return; }
      const operations = health.lobby.announcements;
      const result = parts.rawPath.endsWith('/cancel') ? operations.cancel(body.id)
        : parts.rawPath.endsWith('/kick') ? operations.kick(body.playerId) : operations.publish(body);
      sendJson(req, res, result.error ? 400 : 200, result);
      return;
    }

    if (parts.rawPath === '/api/account/password') {
      res.setHeader('Cache-Control', 'no-store');
      if (!token || !accounts) { sendJson(req, res, 404, { error: 'NOT_ENABLED' }); return; }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendError(req, res, 405, '不支持的请求方法 · Method not allowed');
        return;
      }
      if (!sameSecret(req.headers['x-sp-admin-token'], token)) { sendJson(req, res, 401, { error: 'UNAUTHORIZED' }); return; }
      const body = await readJsonBody(req);
      if (body === 'too-large') { sendJson(req, res, 413, { error: 'TOO_LARGE' }); return; }
      if (!body || typeof body !== 'object') { sendJson(req, res, 400, { error: 'BAD_REQUEST' }); return; }
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || typeof body.oldPassword !== 'string' || typeof body.newPassword !== 'string') {
        sendJson(req, res, 400, { error: 'BAD_REQUEST' });
        return;
      }
      const result = await accounts.changePassword(name, body.oldPassword, body.newPassword);
      // 不回显任何密码字段：成功只答 ok + 账号名（机器人自己拼文案）
      sendJson(req, res, result.error ? 400 : 200, result.error ? { error: result.error } : { ok: true, name: result.account.name });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      sendError(req, res, 405, '不支持的请求方法 · Method not allowed');
      return;
    }
    if (parts.rawPath === '/healthz') {
      const withTraffic = wantsTraffic(parts.query) && isLocalIp(clientAddress(req, trustProxy).ip);
      sendJson(req, res, 200, healthReport(health, withTraffic));
      return;
    }
    // 按账号名查（先于按房间码的规则，因为两者前缀相同、账号名可能不是 4 个字母）
    const accountPath = /^\/api\/records\/account\/([^/]{1,64})$/.exec(parts.rawPath);
    if (accountPath) {
      res.setHeader('Cache-Control', 'no-store');
      const name = decodeURIComponent(accountPath[1]);
      const record = records?.latestByAccount?.(accounts, name) || null;
      sendJson(req, res, record ? 200 : 404, record || { error: 'RECORD_NOT_FOUND' });
      return;
    }
    const recordPath = /^\/api\/records\/([A-HJ-NP-Z]{4})$/.exec(parts.rawPath);
    if (recordPath) {
      res.setHeader('Cache-Control', 'no-store');
      const record = records?.latestRoom(recordPath[1]);
      sendJson(req, res, record ? 200 : 404, record || { error: 'RECORD_NOT_FOUND' });
      return;
    }
    await serveStatic(req, res, parts.rawPath, parts.query);
  }

  return (req, res) => {
    setSecurityHeaders(res);
    if (health.traffic) health.traffic.meter(res, splitUrl(req.url || '/')?.rawPath || '/');
    handleRequest(req, res).catch((e) => {
      log.error('[http] request failed', e);
      sendError(req, res, 500, '服务器内部错误 · Internal error');
    });
  };
}
