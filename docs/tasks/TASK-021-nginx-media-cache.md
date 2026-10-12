# TASK-021 — Make /media/ audio cacheable (nginx header layer)

> Renumbered from TASK-019 on the maintainer's instruction (2026-10-12) so the lead's TASK-018
> (native-wrapper Git) keeps its number and every DeepSeek record sorts after it. The nginx artifact
> and its backups carry no task number; only the commit message still reads "TASK-019".

Status: review_ready
Lead: Codex
Implementer: DeepSeek
Created: 2026-10-12

## Why

The maintainer reported that the server keeps saturating its uplink. Measured egress for one day
(`/var/log/nginx/access.log`): **13.84 GB total, of which `/media/` audio is 11.73 GB and the BGM loops
alone are 5.03 GB** from 3,296 GETs.

Two facts framed the fix:

1. `/media/` responses are re-downloaded in full: **43,278 × 200 vs 3,972 × 304** (89 % full bodies).
2. The heaviest consumers re-fetch the *same* URL at the *track's own length*: client `116.147.26.75`
   fetched `/media/bgm/m_bat_act1autochess_loop` (1,998,679 B) **174 times, median gap 120 s, always 200,
   never 304**, with a single page view (`GET /` count = 1). Same pattern at 65–105 repeats for three
   other clients.

The server headers were already correct (`Cache-Control: public, max-age=86400`, strong ETag,
`Accept-Ranges`), and a real Chrome honours them: asking twice from one page gives
`transferSize 1139073` then **`transferSize 0` + `fromCache: true`**. So the 174× client is not
re-downloading because of a missing header — but that client is exactly the one the change has to reach,
and the strongest legal signal is still the right server-side move.

## Scope (what changed)

Only the nginx snippet that both vhosts include, `/etc/nginx/snippets/stronghold-static.conf`:

- new `location ~* ^/media/(?:bgm|sfx)/[^/.]+$` that proxies to the same Node process
  (`http://127.0.0.1:3810`) and adds, on top of Node's headers:
  `Content-Disposition: inline`, `Expires: Thu, 31 Dec 2037 23:55:55 GMT`,
  `Cache-Control: public, max-age=31536000, immutable`, plus `X-Content-Type-Options`/`Referrer-Policy`
  and `default_type audio/mpeg`;
- two exact-match locations for the two tracks that dominate egress
  (`m_bat_act1autochess_loop`, `m_sys_act1autochess_loop`) so their type cannot depend on a regex.

Deliberately **not** changed: `server/` (no Node restart — the app was not touched and `sp2.service`
still shows `MainPID=677340`, `NRestarts=0`, started 20:31:47), `data/*.json`, any asset, the client
packages, `/data/*.json` caching, and the explicit-extension `/media/x.mp3` route.

Why the URL is safe to cache hard: it is query-less and stable, the resolver
(`server/http/media.js`) picks the extension from the requested stem, audio changes only with a client
release, and `Content-Disposition: inline` keeps WebView/browser heuristics from treating the response
as a download (which would bypass the cache).

## Acceptance checks (all run after the reload)

| Check | Result |
|---|---|
| `nginx -t` | syntax ok, configuration test successful |
| `nginx -s reload` | nginx active; no connection loss (`/healthz` uptime kept rising, 19 sockets / 4 rooms / 4 matches at 20:50) |
| BGM headers, both hosts | `content-type: audio/mpeg`, `content-disposition: inline`, `expires: … 2037`, second `cache-control: public, max-age=31536000, immutable` |
| Chrome asks twice | 1st `transferSize 1139073`, 2nd **0** + `fromCache true` — cache still works |
| Range through the new block | `206`, `content-range: bytes 0-1048575/1997679`, `content-length: 1048576`, `accept-ranges: bytes` |
| Body unchanged | `sha256` of `/media/bgm/m_bat_act1autochess_loop` = `bebcd9f0412e123fcf87eae6ca00c104cb9bba680ac301fdbdc3dbbccd100f51` = the same file via `/assets/audio/` |
| Unknown track | `/media/bgm/definitely_not_a_track` → `404` from Node (passthrough intact) |
| Traversal | `/media/../../etc/passwd` → `404` |
| Explicit `.mp3` | falls through unchanged (Node's headers, no `inline`/`Expires`) |
| App endpoints | `/` 200, `/healthz` 200, `/data/assets.json` 200, `/js/audio.js` 200 |

## Rollback

```bash
ssh -F F:/DSH-workspace/ssh-leio-config jing \
  "cp -a /opt/sp2/backups/nginx-media-cache-20261012-124845/stronghold-static.conf \
        /etc/nginx/snippets/stronghold-static.conf && nginx -t && nginx -s reload"
```

Backup sha256: before `1e028bda84e142b4921769fe91017d0b408d1b43cb091718f723f8962a971be8`,
after `1645c2ed1e49cb7f389fcfc91e29dbf6954cd8a3026e24f01cd8072084dc0b7c`.

## Honest limitation (do not oversell this)

This is a **signal strengthening, not a proven root-cause fix**. The client that fetched one track 174
times ignores `Cache-Control: public, max-age=86400` today; a longer max-age may not change its
behaviour. What it does guarantee: any client that ever consults its cache now has an unambiguous
one-year immutable grant with a legacy `Expires` fallback, and responses are marked inline so they are
not classified as downloads.

The remaining lever is client-side and needs an APK/EXE rebuild + re-sign + redistribution, which this
task deliberately does not authorize. Candidates, in order of confidence:

1. **The bundled-assets gate is not serving media on the installed clients.** The bundle genuinely
   contains both BGM files (extracted from the shipped 1.2.8 APK:
   `assets/payload/assets/audio/bgm/m_sys_act1autochess_{intro,loop}.mp3`, 1,138,773 B each), per-file
   verification passes for **13,642/13,642 paths on both hosts** (HEAD with the index's own ETag → 304,
   118 s per host, zero mismatches), yet 13,544 `/media/` requests arrive from `SPClient/Android`
   clients. Either the WebView's `shouldInterceptRequest` never sees these, or the origin/content gate
   fails at runtime. The wrapper exposes `localHits / localBytes / fallbacks / releaseChecks`
   (`BundledAssets.java:45-49`) and *nothing reads them* — surfacing those four counters is the cheapest
   way to settle it.
2. **The WebView never stores the response.** `MainActivity.java:98-112` sets no cache mode and does not
   clear the cache, so this is not configured-off; but a client that re-requests a 1-day-fresh URL every
   120 s behaves as if it were.
3. **The bundle is being bypassed for `/media/` specifically** — the media route is extension-less, and
   the client resolves it through `ResourcePolicy.canonicalPath`, which maps `/media/…` →
   `/assets/audio/…mp3` (`ResourcePolicy.java:48-54`).

Recommended follow-up task: surface the four bundle counters (or a one-line on-screen diagnostic), ship
it as the next client build, and read them on one affected device. That turns this from inference into a
measurement.

## Current checkpoint

2026-10-12 20:50 — change applied and verified (table above). Monitoring plan: re-run the per-device
repeat analysis on the next day's log; the metric to watch is "distinct (device, path) pairs repeated"
(was 9,013 pairs / 3,904.7 MB of redundant 200s) and the `/media/` 200:304 ratio (was 43,278:3,972).
Waiting for Codex review of the snippet change and this record.
