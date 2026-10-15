# Browser pre-cache and upstream 0.2.6 — released

Status: deployed 2026-10-13 19:55 +08 at the maintainer's timed instruction. No Git commit, push, native-package rebuild or client-update-manifest change.
Tasks: TASK-038, TASK-039. Source: `F:\DSH-workspace\stronghold-026-integration` (detached, unfinished merge from `4c517699` plus upstream `v0.2.6`). The exact deployed runtime artifact is frozen below, separate from the still-uncommitted source tree.

## Intended release

- Preserve the existing native-client asset bundle and the fixed-path browser CDN for legacy URLs.
- Serve v0.2.6 content-hashed `/assets/`, `/fonts/` and `/media/` URLs with immutable browser caching. Until the CDN supports those exact hash paths, they must stay on the local origin; redirecting to a fixed CDN key would defeat version safety.
- Start bounded baseline asset pre-cache in the browser lobby, show progress/retry, and keep the existing match-specific warmup. It is best-effort HTTP caching, not a complete offline pack or a gameplay gate.
- Keep the browser gate closed until the maintainer confirms that the current match has ended. The former 04:00 timer is disabled.

## Files and provenance

- Upstream source: official `v0.2.6` tag `488db49f11daf862b67ce26fa4cf89aa6cba2466`, merged with fork-specific conflict resolution.
- Fork source: current `4c517699` plus the main checkout's uncommitted UI/runtime edits, overlaid only in the isolated worktree.
- Production-only CDN: `/opt/sp2/server/http/assetCdn.js` copied into the isolated source; generated `data/cdn-*.json` stay on production and must not be replaced with absent local files.
- Nginx candidate: `.local/task038/stronghold-static.conf` adds the hash-path proxy before the existing fixed-path rules. It is staged locally only.
- No native package, updater manifest, ignored game art, account data or player records belong in this release.

## Actual activation

1. Froze 52 runtime files (no dev previews or ignored game art) in `/root/sp2-backups/release-026-20261013-1955/release-runtime.tar.gz`, SHA256 `ffa0c3d42d9cbb5e3b7a9fe784a603791f18532d46035afc3e9f9341a18f366e`. The 46 prior existing files were backed up as `pre-release-runtime.tar.gz`, SHA256 `20773bcd635a619d73c6ad2c3a1d8f8955360ec4e06588cf0dcb8efb5e63f`.
2. Backed up the prior Nginx snippet and service unit/drop-ins in the same directory. Installed the hash-path Nginx snippet, SHA256 `0fe91ffbfb67b8ad8bf927545b35c59d5f1985c34cfc29e8b2e0cce7e05dbdcc`, and the staged `SP_CLIENT_ONLY=0` service drop-in. Production `data/cdn-*.json`, accounts, records, art, native packages and updater files were preserved.
3. Reloaded Nginx and restarted `sp2` on the maintainer's instruction to proceed after three minutes regardless of ongoing matches. Five active matches were interrupted; the new process is PID `1441657`, `/healthz` reports `app: 0.2.6` and build `a25d24fec134`.
4. Public browser roots on `sp.bs.leio.fun` and `sp2.bs.leio.fun` serve the game, a browser WebSocket upgrade returns 101, the pre-cache modules return 200, and a sampled hashed asset returns 200 with `public, max-age=31536000, immutable`. The existing fixed-path CDN route resumed 302 after a transient startup probe failure. Maintainer visual/play acceptance remains pending; no project tests, lint, screenshot comparisons or CI were run.

## Rollback

Restore `pre-release-runtime.tar.gz` and the prior Nginx snippet, remove the browser-open drop-in, reload systemd/Nginx and restart `sp2` at a maintainer-approved safe time. The six newly added runtime files may remain inert or be removed after checking the manifest. The old fixed-path CDN assets and native bundles remain untouched.

## Checkpoint

2026-10-13 19:55 +08: runtime deployed and browser entry opened. Source remains uncommitted in the isolated worktree and has not been pushed; no project tests or visual verification.
