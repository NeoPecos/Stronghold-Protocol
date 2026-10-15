# TASK-056 — 浏览器入服地图包与持久素材缓存

Status: `released` (browser acceptance pending)

Lead: Codex

Implementer: Codex (isolated worktree `F:\DSH-workspace\stronghold-browser-assets-hotfix`)

Starting commit: `4c517699` (dirty 0.2.6 integration worktree; isolate this task before implementation)

## Goal

Browser players finish the map/common-asset download before entering the lobby; assets first used later are retained for subsequent visits.

## Scope

- Before a browser user enters the lobby/opens a game WebSocket session, fetch the 11 available scene packs (JSON, bin, material/albedo textures, all referenced lightmaps), shared board art and other confirmed common large assets. Do not require the entire ~900-MB operator/audio library at entry.
- Block entry until this initial pack is complete, regardless of elapsed time. A failure must show progress, the missing item and retry; the old 60-second simplified-play escape hatch is **superseded** and must not be implemented for this gate.
- Keep successful assets in a browser-managed persistent cache, with content-versioned keys. A Service Worker should serve cached game assets and capture each later successfully loaded operator/effect/audio/scene asset for reuse on future visits. Request persistent storage when appropriate, handle denial/quota/eviction, and verify cached entries rather than trusting a saved progress flag.
- Use the exact URLs that later rendering requests through TASK-055's Cloudflare-first/source-only fallback channel. Count fully downloaded bytes and show accurate per-player progress; do not double-download a file already in the persistent cache.
- Show a download-page alternative: “不想等待浏览器素材下载？加入 QQ 群 1124360673，在群文件安装 Windows／Android 客户端。客户端无需等待本服浏览器地图包，并可切换至其他兼容的 HTTPS 服务器。” Other servers provide their own features and assets; do not promise compatibility with arbitrary servers or HTTP addresses.
- Browser refresh/reconnect checks the cache again. Native clients bypass this browser-only gate. Scope UI changes to the entry/download view; preserve the maintainer's lobby, room and battle designs.

## Protected areas

- No automatic full-library download or claim that browser storage is guaranteed forever. Never declare an asset ready based only on a response header, interrupted transfer or stale metadata.
- Do not pause existing matches or impose a new per-battle room-wide barrier. Do not enable the gate in native clients, change match rules or deploy a server restart as part of this task.
- Do not claim the currently distributed Windows/Android clients accept HTTP: both require HTTPS, and Android forbids cleartext traffic.

## Acceptance checks

- A fresh browser cannot enter the lobby until the initial 11-map/common pack is cached completely; there is no time-based bypass. An already-cached browser does not re-download unchanged assets.
- Every successful in-game asset request is reusable after a later visit; missing/evicted items are detected and fetched again, with bounded storage and no false completion indicator.
- A Pages failure uses only the TASK-055 source fallback. Failed items show accurate progress and retry; an origin outage does not appear as a successful download.
- The download page shows QQ `1124360673` and accurate Windows/Android client guidance; native clients and existing room/match flows remain unchanged. Maintainer must explicitly authorize tests/evidence-style checks and production deployment.

## Current checkpoint

- Completed: maintainer replaced the earlier per-battle 60-second proposal with a strict **browser-entry** map/common-asset gate, plus persistent cache-on-use for later assets. The prior 60-second fallback is obsolete. In the isolated worktree, `public/js/resources/entryAssets.js` now blocks fresh browser entry for the eleven scene groups plus map/mesh assets, reports progress/retry and QQ/client guidance, and rechecks cache entries on later visits. `public/js/entry.js` loads the game only afterward; isolated `public/index.html` changes the entry hook and suppresses its false nine-second error while waiting. Existing sessions with a session token are temporarily grandfathered to avoid disrupting their current match.
- Client-copy check: `F:\DSH-workspace\stronghold-app\windows\Program.cs` rejects non-HTTPS custom addresses; `F:\DSH-workspace\stronghold-app\android\src\fun\leio\stronghold\MainActivity.java` does the same and `android\AndroidManifest.xml` disables cleartext traffic.
- Loading caveat: `public/js/render/board3d/load.js` currently fetches scene JSON/bin with `cache: 'no-cache'`; prefetch must use compatible URLs/cache behavior or those files will still revalidate over the network during battle.
- Changed files: isolated `public/js/resources/entryAssets.js`, `public/js/entry.js`, `public/index.html`, and this checkpoint. No production game file changed.
- Tests run: none under the maintainer's no-self-validation rule. Cache quota/eviction, native UA bypass, live browser behavior and CDN completeness are not verified.
- Release: the production 0.2.6 index received only three entry/boot hunks; the new worker/entry/gate files were installed before index activation. HTTP 200 and artifact hashes matched on both public domains; `sp2.service` stayed active at PID `2603071` with no restart. See `docs/releases/2026-10-15-browser-assets-static.md` and backup `/opt/sp2/backups/task055056-browser-assets-20261015-2217/`.
- Next: maintainer opens a fresh browser tab to check the button, progress, 11-map availability and later cache reuse. Existing token-bearing tabs are intentionally grandfathered until a new tab/session; visual/gameplay acceptance remains pending.
- GitHub/production: unchanged. Existing lobby preload and partial room warmup remain live.

## Review notes

Awaiting implementation and maintainer acceptance.

## Rollback

Remove the browser-entry asset barrier and unregister only this feature's Service Worker/cache version; restore the previous background-only warmup without deleting unrelated browser data. Keep TASK-055's source fallback independently reversible.
