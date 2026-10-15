// server/http/routes.js — the node:http request listener. Every response gets the security headers (common.js), then:
// (i18n-ignore-file: the error pages are bilingual by design, 中文 · English — docs/I18N.md)
//
//   * a URL longer than 4096 characters → 414; one that does not parse → 400;
//   * any method but GET / HEAD → 405 with `Allow: GET, HEAD`, except the authenticated POST routes below;
//   * GET /healthz → JSON status (protocol `version`, release `app`, uptime, the served `build`, sockets, sessions,
//     rooms, matches), never cached; `?traffic=1` adds the traffic counters (traffic.js: bytes by category since the
//     start, WebSocket wire and payload bytes) for a loopback or private-network client only — the maintainer's
//     decision of 2026-10-12: the figures are the host's, so any other client, also one a tunnel or proxy on this
//     machine forwards, gets the plain report (net.js clientAddress, honouring TRUST_PROXY like the WebSocket limits);
//   * GET /api/records/<CODE> → the latest finished match of that room code (4 letters), `publicRecord` only;
//   * GET /api/records/account/<NAME> → the latest finished match of that account;
//   * POST /api/account/password → change an account's password, requiring the admin token and old password;
//   * GET /api/announcements[/<ID>] → current announcement index or article; announcement assets are read-only;
//   * POST /api/admin/kick → remove a player from a room, requiring the admin token;
//   * everything else → the static files (static.js).
// Every response's body bytes count in the traffic counters (traffic.js meter). A route that throws is logged and
// answers 500.
// The account/admin routes require SP_ADMIN_TOKEN; if unset they answer 404. The token never appears in responses.

import { timingSafeEqual } from 'node:crypto';
import { PROTOCOL_VERSION, APP_VERSION } from '../../shared/constants.js';
import { buildTag } from './buildTag.js';
import { setSecurityHeaders, sendError, sendJson, splitUrl } from './common.js';
import { clientAddress, isLocalIp } from '../net.js';
import { isAnnouncementId } from '../../shared/announcements.js';
import { ANNOUNCEMENT_ASSET_URL_PREFIX } from '../../shared/announcementAssets.js';
import { serveAnnouncementAsset } from './announcementAssets.js';
import { ANNOUNCE_PUBLISH_PATH, ANNOUNCE_TOKEN_HEADER, createAnnouncementPublisher } from './announcementAdmin.js';

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
 *           announcements?: import('../announcementStore.js').AnnouncementStore,
 *           log: object, trustProxy?: 'auto' | boolean }} deps
 *   trustProxy: whose forwarding headers name the client (net.js clientAddress; the server's TRUST_PROXY)
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createRequestHandler({ serveStatic, health, records, accounts = null, adminToken = null, announceToken = null, announcements, log, trustProxy = 'auto' }) {
  const token = typeof adminToken === 'string' && adminToken.length >= MIN_TOKEN_LENGTH ? adminToken : null;
  if (adminToken && !token) log.warn(`[http] SP_ADMIN_TOKEN 短于 ${MIN_TOKEN_LENGTH} 字符，账号接口保持关闭 · admin token too short, account routes stay off`);
  // 公告发布是独立窄令牌（TASK-049）：机器人只能发公告，拿不到踢人/改密码。
  const announceSecret = typeof announceToken === 'string' && announceToken.length >= MIN_TOKEN_LENGTH ? announceToken : null;
  if (announceToken && !announceSecret) log.warn(`[http] SP_ANNOUNCE_TOKEN 短于 ${MIN_TOKEN_LENGTH} 字符，公告发布桥接保持关闭 · announce token too short, publisher stays off`);
  const announcementPublisher = announceSecret && announcements ? createAnnouncementPublisher({ announcements }) : null;
  async function handleRequest(req, res) {
    const url = req.url || '/';
    if (url.length > MAX_URL_LENGTH) { sendError(req, res, 414, '请求地址过长 · URI too long'); return; }
    const parts = splitUrl(url);
    if (!parts) { sendError(req, res, 400, '请求地址无效 · Bad request'); return; }

    if (parts.rawPath === '/api/admin/kick') {
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
      const operations = health.lobby.roomAdmin;
      const result = operations.kick(body.playerId);
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

    if (parts.rawPath === ANNOUNCE_PUBLISH_PATH) {
      res.setHeader('Cache-Control', 'no-store');
      if (!announcementPublisher) { sendJson(req, res, 404, { error: 'NOT_ENABLED' }); return; }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(req, res, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      if (!sameSecret(req.headers[ANNOUNCE_TOKEN_HEADER], announceSecret)) {
        log.warn('[announce] rejected unauthenticated request');
        sendJson(req, res, 401, { error: 'UNAUTHORIZED' });
        return;
      }
      const body = await readJsonBody(req);
      if (body === 'too-large') { sendJson(req, res, 413, { error: 'TOO_LARGE' }); return; }
      const result = announcementPublisher.publish(body);
      sendJson(req, res, result.status, result.payload);
      return;
    }

    if (parts.rawPath === '/api/admin/announcement' || parts.rawPath === '/api/admin/announcement/cancel') {
      sendJson(req, res, 404, { error: 'NOT_FOUND' });
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
    if (parts.rawPath === '/api/announcements') {
      res.setHeader('Cache-Control', 'no-store');
      sendJson(req, res, 200, announcements?.list() || { revision: '', pinnedId: null, items: [] });
      return;
    }
    if (parts.rawPath.startsWith('/api/announcements/')) {
      res.setHeader('Cache-Control', 'no-store');
      let id;
      try { id = decodeURIComponent(parts.rawPath.slice('/api/announcements/'.length)); } catch { /* invalid URL */ }
      const article = isAnnouncementId(id) ? announcements?.read(id) : null;
      sendJson(req, res, article ? 200 : 404, article || { error: 'ANNOUNCEMENT_NOT_FOUND' });
      return;
    }
    if (parts.rawPath === ANNOUNCEMENT_ASSET_URL_PREFIX.slice(0, -1) || parts.rawPath.startsWith(ANNOUNCEMENT_ASSET_URL_PREFIX)) {
      await serveAnnouncementAsset(req, res, parts.rawPath.slice(ANNOUNCEMENT_ASSET_URL_PREFIX.length), announcements, log);
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
