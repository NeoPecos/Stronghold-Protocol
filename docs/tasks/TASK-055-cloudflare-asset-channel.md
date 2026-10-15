# TASK-055 — Cloudflare 素材主通道与源站兜底

Status: `released` (browser acceptance pending)

Lead: Codex

Implementer: Codex (isolated worktree `F:\DSH-workspace\stronghold-browser-assets-hotfix`)

Starting commit: `4c517699` (dirty 0.2.6 integration worktree; isolate this task before implementation)

## Goal

Browser asset requests use our complete Cloudflare Pages copy by default, without using the old third-party CDN; the game server serves an asset only when Cloudflare fails.

## Scope

- Trial Pages project: `https://leio-stronghold-assets.pages.dev/`; full source asset directory `F:\DSH-workspace\stronghold-base-0.2.1\public\assets` (13,725 files, 900,238,340 bytes) was uploaded to Pages. The upload command reported success, but full per-file remote integrity has not been established and no game route has switched.
- Reconcile the exact asset manifest and content hashes against the deployed Pages revision before cutover. Publish a coherent revision first; never let a hash-prefixed game URL return different bytes.
- Use an immutable asset URL or a deployment-pinned Pages revision for long browser caching; the current Pages trial has only a one-hour cache header and must not be described as the finished long-cache channel.
- Browser URL generation and origin/Nginx routes must send both ordinary and hash-prefixed asset requests to Pages first. Remove the old third-party CDN from browser fallback paths. Preserve native clients' local/plain bundle path.
- On a missing or failed Pages asset, use the game server as the only fallback. Treat a request still unanswered after 5 seconds as failed; after a channel-wide outage, try Pages again after 10 minutes. A single missing asset must not turn every player into an origin downloader.
- Prepare a separate release file with frozen source/artifact hashes, origin-bandwidth safeguards and rollback. A server/Nginx routing change needs a separately approved restart window; this task does not authorize it.

## Protected areas

- No changes to gameplay, client packages, update manifests, DNS, the old CDN account, or production routes without a separate release decision.
- Do not copy another tree over the dirty 0.2.6 source or imply Wrangler upload success proves every asset is correct.
- Do not expose a public bulk-download fallback that bypasses Cloudflare and exhausts the game server.

## Acceptance checks

- Current browser manifest URLs, including `~hash` addresses, resolve to byte-identical Pages assets; cache keys change when content changes.
- Simulated Pages timeout/missing asset falls back to source for that asset, while healthy assets keep using Pages; the 10-minute retry restores Pages after an outage.
- Native Windows/Android continue loading their packaged assets, and no third-party CDN request is made by the browser asset path.
- Maintainer must explicitly authorize any testing/evidence-style validation and production deployment under `AGENTS.md`.

## Current checkpoint

- Completed: isolated detached worktree at `4c517699`; local `public/asset-cache-sw.js` routes browser assets to the pinned Pages deployment first, reads the full body within five seconds, backs off channel failures for ten minutes, and uses hash-prefixed same-origin routes for origin-only fallback without the legacy CDN. Production Nginx already routes hash-prefixed assets to Node; its existing process remains untouched. This is local implementation only.
- Changed files: isolated `public/asset-cache-sw.js`; this task checkpoint. See TASK-056 for browser entry files. Pages artifact exists outside the repository.
- Tests run: none under the maintainer's no-self-validation rule. Full remote per-file integrity, browser behavior and production route checks have not been run.
- Release: all 13,725 production/source asset SHA-256 hashes matched; all Pages files returned matching hashes and lengths after a single large scene binary was rechecked with a longer transfer timeout. Browser-only worker was statically deployed with the TASK-056 entry hook, backed up at `/opt/sp2/backups/task055056-browser-assets-20261015-2217/`. Both domains and `/healthz` returned 200, hashes matched, and PID `2603071` did not change. See `docs/releases/2026-10-15-browser-assets-static.md`.
- Next: maintainer checks fresh-browser download and 3D maps. Future asset-byte changes must ship a matching pinned Pages revision and worker together.
- GitHub/production: unchanged by this task. The separate Pages trial is live, but the game has not been cut over.

## Review notes

Awaiting implementation and maintainer acceptance.

## Rollback

Restore the backed-up browser URL routing and Nginx/server configuration in the release window. Keep the source asset route available; do not delete the Pages project or native bundle while rolling back.
