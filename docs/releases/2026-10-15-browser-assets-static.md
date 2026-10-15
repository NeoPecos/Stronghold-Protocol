# 2026-10-15 browser asset static cutover

Status: `released` at 2026-10-15, maintainer browser acceptance pending. Owner approved necessary asset integrity and post-release health checks, with no project tests or match-server restart.

## Source and scope

- Isolated source: detached `F:\DSH-workspace\stronghold-browser-assets-hotfix` at base commit `4c517699`, exact file hashes below. No full file from its old `public/index.html` may replace the 0.2.6 production page.
- Pages revision: `https://c26f1811.leio-stronghold-assets.pages.dev/`, pinned in the worker. Stage/upload source: `F:\DSH-workspace\cf-pages-cdn-trial\assets`, 13,725 files, 900,238,340 bytes. This local source matched every production asset SHA-256 (13,725/13,725). Pages returned matching SHA-256 and length for 13,724 files in the first pass; one 6.5-MB scene binary hit the verifier's 30-second total-transfer timeout and passed a dedicated 120-second recheck (same SHA-256 and length). Thus all 13,725 files have a matching remote response; there was no content mismatch.
- Any later release that changes asset bytes must publish a matching Pages revision and update the worker's pinned deployment URL in the same static release. Otherwise a new `~hash` game URL could receive old CDN bytes; do not update only one side.
- Four static artifacts only; no `sp2.service`, Nginx, game rules, native package, updater, data manifest or DNS change. Existing open tabs and rooms keep running their already-loaded code. Browser tabs with an existing session token temporarily bypass the new gate on reload; fresh browser tabs must complete it.

## Exact artifacts

| Production target | Staging source | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `/opt/sp2/public/asset-cache-sw.js` | `F:\DSH-workspace\stronghold-browser-assets-hotfix\public\asset-cache-sw.js` | 4,253 | `079cb78dd0ee888b243e395c6cb56dd87cb91b19d164cd0241e2007d2792993b` |
| `/opt/sp2/public/js/entry.js` | `F:\DSH-workspace\stronghold-browser-assets-hotfix\public\js\entry.js` | 211 | `13321553c90da707fdab920058859e1df742d12b9b5474f0d9aefebfb88f80c6` |
| `/opt/sp2/public/js/resources/entryAssets.js` | `F:\DSH-workspace\stronghold-browser-assets-hotfix\public\js\resources\entryAssets.js` | 7,213 | `cb6b6c8aba92d77acae1c85fb3d33c5e142637b8ff31b645d275d9f652e11b3e` |
| `/opt/sp2/public/index.html` | `F:\DSH-workspace\cf-pages-cdn-trial\prod-index.html` (only three surgical edits against production) | 6,814 | `c523ed74bbb5fb4a9d0c3bd3e11eaf102c37187e4494e5b0904e768575f7c039` |

Production index before this release: SHA-256 `3cb983766b5fb1ed89cb3a5dcfc99af7eaa97802743c8ebd9e9bbc34ac535d1e`. If this preimage differs immediately before upload, stop and rebuild the surgical index from current production.

## Pre-release gate

1. Finish remote Pages per-file SHA-256 comparison; zero mismatches and zero missing files required.
2. Confirm current production index preimage and service PID, Pages CORS header, and the 11-scene manifest's 131 hashed scene/map/mesh entries. These are operational checks, not project tests.
3. Back up the exact production index and any pre-existing copies of the three new paths under a timestamped `/opt/sp2/backups/` directory; record hashes and PID. Staging/backup is at `/opt/sp2/backups/task055056-browser-assets-20261015-2217/`; the three new paths did not previously exist. Pre-release service PID `2603071`.

## No-restart rollout

1. Stage the three new files and the surgical production-index copy under the backup directory; hash-compare all staged files with the table.
2. Atomically install the worker, resource gate and entry module first, then atomically install `index.html` last as the activation switch. No service restart, Nginx reload or WebSocket route change.
3. Read back target hashes and HTTP status/content types; compare `sp2.service` PID and health status to pre-release values. Maintainer checks fresh-browser entry and map loading separately.

Rollout completed in this order. All four production hashes matched the table. Both `sp.bs.leio.fun` and `sp2.bs.leio.fun` returned the new index and HTTP 200 for the worker, entry module, resource gate and `/healthz`; JavaScript content types were valid. `sp2.service` remained `active` at PID `2603071`, unchanged from before the rollout. No room or game process was restarted. Fresh-browser visual/gameplay acceptance is still the maintainer's check.

## Rollback

- Restore the backed-up production `index.html` atomically first. New page loads then import `main.js` directly again; running matches are not restarted.
- Keep the three new static files during rollback until old controlled browser tabs close. A previously registered Service Worker can still intercept those tabs' `/assets/` and `/media/` requests; restoring the index alone cannot forcibly unregister a worker already installed in a user's browser. If the worker itself is faulty, publish a scoped no-op replacement and have affected users close/reopen or clear this site's storage. Do not delete caches blindly or claim immediate client-wide rollback.
- Record hashes, PID and live outcome in `docs/ops/2026-10.md`; keep the backup directory until maintainer acceptance.

## Validation limits

No `node --test`, build, browser screenshot comparison or gameplay validation is planned without a separate request. `node --check` passed for the three new JavaScript files; exact HTML hunk diff, asset hashes, CORS and origin-only fallback routes were inspected. Hash/status checks and live observation only were authorized. Stop the release if Pages integrity, artifact hashes, CORS or no-restart conditions fail.
