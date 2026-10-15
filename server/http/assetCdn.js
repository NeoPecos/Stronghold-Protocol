// server/http/assetCdn.js — TASK-029：浏览器端素材走素材 CDN（默认关闭，故障回源本地）。
//
// 背景：素材 CDN（https://weishucdn.jiangjiangze.icu）只托管本 fork 已确认公开、且逐字节核对过的文件。
// 本模块只做一件事：对「已核对清单」里的键，把浏览器请求 302 到 CDN；其余一切照旧由本地 public/ 提供。
//
// 三份数据（都在 data/ 下，由 tools/build-cdn-assets.mjs 生成，勿手改）：
//   cdn-assets.json    已核对清单：{ base, generatedAt, keys: { "<键>": { size, sha256 } } }
//   cdn-denylist.json  永久屏蔽：{ prefixes: ["assets/ui/", …] } —— 即使 CDN 上有也绝不外链
//   cdn-config.json    开关（可选）：{ enabled: true, base: "https://…", probeKey: "assets/…" }
//
// 开关优先级：环境变量 SP_ASSET_CDN=1/0 > data/cdn-config.json 的 enabled > 默认 false。
// 健康探测：每 PROBE_TTL_MS 用 HEAD 打一次 base + probeKey（默认取清单里最小的键）；探测失败即回源本地，
// 不让任何一台机器因为 CDN 抖动而拿不到素材。响应头 X-Asset-Source: cdn|local 便于核对。
//
// 自查（离线，不产生线上流量）：node server/http/assetCdn.js --check [--base=<url>] [--data=<dir>] [--hosted=<hosted.json>]

import fsp from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './config.js';

export const CDN_DEFAULT_BASE = 'https://weishucdn.jiangjiangze.icu';
export const PROBE_TTL_MS = 60_000;
export const CDN_REDIRECT_TTL = 300; // 浏览器缓存这次跳转的秒数：CDN 出问题时最多 5 分钟就回到本地

const noop = () => {};

/**
 * @param {{ dataDir: string, log?: { warn?: Function, info?: Function }, base?: string, fetchImpl?: Function }} options
 */
export function createAssetCdn({ dataDir, log = {}, base = CDN_DEFAULT_BASE, fetchImpl = fetch }) {
  const warn = log.warn || noop;
  const info = log.info || noop;
  const files = {
    assets: path.join(dataDir, 'cdn-assets.json'),
    deny: path.join(dataDir, 'cdn-denylist.json'),
    config: path.join(dataDir, 'cdn-config.json'),
  };
  let state = { enabled: false, base, probeKey: '', keys: new Map(), deny: [], denyKeys: new Set(), overrides: new Map(), loadedAt: 0 };
  let probe = { at: 0, ok: false };
  let loading = null;

  const readJson = async (file) => {
    try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch (error) {
      if (error && error.code !== 'ENOENT') warn('[cdn] 读不出', file, error.message);
      return null;
    }
  };

  async function load(force = false) {
    if (loading) return loading;
    if (!force && state.loadedAt && Date.now() - state.loadedAt < 30_000) return state;
    loading = (async () => {
      const [assets, deny, config] = await Promise.all([readJson(files.assets), readJson(files.deny), readJson(files.config)]);
      const keys = new Map();
      for (const [key, meta] of Object.entries((assets && assets.keys) || {})) {
        if (typeof key === 'string' && meta && typeof meta.size === 'number') keys.set(key, { size: meta.size, sha256: meta.sha256 || '' });
      }
      const denyKeys = new Set(Array.isArray(deny && deny.keys) ? deny.keys : []);
      // 同路径异字节的例外：URL 仍是本站路径，但内容放在另一个已核对的键上（例如维护者特调的 UI 图）。
      // 有 override 时不再看 denyKeys（deny 说的是「同路径那份 CDN 字节不能用」，与 override 无关）。
      const overrides = new Map();
      for (const [uri, key] of Object.entries((config && config.keyOverrides) || {})) {
        if (typeof uri === 'string' && uri.startsWith('/') && typeof key === 'string' && key) overrides.set(uri, key);
      }
      const envSwitch = process.env.SP_ASSET_CDN;
      const enabled = envSwitch === '1' || envSwitch === 'true' ? true : envSwitch === '0' || envSwitch === 'false' ? false : !!(config && config.enabled);
      const pick = (config && config.probeKey) || [...keys.keys()].sort((a, b) => (keys.get(a).size - keys.get(b).size))[0] || '';
      state = {
        enabled,
        base: ((config && config.base) || base || CDN_DEFAULT_BASE).replace(/\/+$/, ''),
        probeKey: pick,
        keys,
        deny: Array.isArray(deny && deny.prefixes) ? deny.prefixes : [],
        denyKeys,
        overrides,
        loadedAt: Date.now(),
      };
      return state;
    })().finally(() => { loading = null; });
    return loading;
  }

  async function health() {
    if (!state.enabled || !state.probeKey) return false;
    if (Date.now() - probe.at < PROBE_TTL_MS) return probe.ok;
    const url = `${state.base}/${state.probeKey}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetchImpl(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);
      probe = { at: Date.now(), ok: res.status === 200 };
      if (!probe.ok) warn('[cdn] 探测不健康，改回本地素材', url, res.status);
    } catch (error) {
      probe = { at: Date.now(), ok: false };
      warn('[cdn] 探测失败，改回本地素材', url, error.message);
    }
    return probe.ok;
  }

  /** 该键是否可以交给 CDN。 */
  async function decide(key) {
    await load();
    if (!state.enabled || !key) return null;
    const override = state.overrides.get(`/${key}`) || '';
    const target = override || key;
    if (!override) {
      if (state.denyKeys.has(key)) return null;
      if (state.deny.some((prefix) => key.startsWith(prefix))) return null;
    }
    const meta = state.keys.get(target);
    if (!meta) return null;
    return (await health()) ? `${state.base}/${target}` : null;
  }

  return {
    decide,
    load,
    files,
    stats: () => ({ enabled: state.enabled, base: state.base, keys: state.keys.size, deny: state.deny.length, denyKeys: state.denyKeys.size, overrides: state.overrides.size, probeOk: probe.ok, probeAt: probe.at }),
  };
}

/** 离线自查：本地清单 vs 上游 hosted.json（只比对，不请求 CDN）。 */
export async function checkCdnAssets({ dataDir = path.join(ROOT, 'data'), base = CDN_DEFAULT_BASE, hosted = '' } = {}) {
  const cdn = createAssetCdn({ dataDir, base });
  await cdn.load(true);
  const stats = cdn.stats();
  const out = { base: stats.base, enabled: stats.enabled, keys: stats.keys, deny: stats.deny, hosted: hosted || null, missingUpstream: [], sizeMismatch: [], ok: true };
  if (hosted) {
    const doc = JSON.parse(await fsp.readFile(hosted, 'utf8'));
    const upstream = new Map();
    for (const entry of doc.files || []) upstream.set(entry.key, entry);
    const state = await cdn.load(true);
    for (const key of state.keys.keys()) {
      const remote = upstream.get(key);
      if (!remote) out.missingUpstream.push(key);
      else if (Number(remote.size) !== state.keys.get(key).size) out.sizeMismatch.push({ key, local: state.keys.get(key).size, upstream: Number(remote.size) });
    }
    out.ok = out.missingUpstream.length === 0 && out.sizeMismatch.length === 0;
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const arg = (name, fallback = '') => {
    const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  if (!process.argv.includes('--check')) {
    console.log('用法：node server/http/assetCdn.js --check [--base=<url>] [--data=<dir>] [--hosted=<hosted.json>]');
    process.exitCode = 2;
  } else {
    const report = await checkCdnAssets({ dataDir: arg('data', path.join(ROOT, 'data')), base: arg('base', CDN_DEFAULT_BASE), hosted: arg('hosted') });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  }
}
