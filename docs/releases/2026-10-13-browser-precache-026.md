# Browser pre-cache and upstream 0.2.6 — prepared, not released

Status: preparation only; no frozen commit, hashes, upload or restart yet.
Tasks: TASK-038, TASK-039. Source: `F:\DSH-workspace\stronghold-026-integration` (detached, unfinished merge from `4c517699` plus upstream `v0.2.6`).

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

## Before any activation

1. Reconcile the remaining production-only source/config and main checkout edits; freeze one exact commit or artifact set and record its full hashes here.
2. Prepare a full backup of every file to be replaced and the current service/nginx configuration. Preserve production `data/cdn-*.json`, art, accounts and records.
3. Deploy source and the Nginx hash-path rule as one planned change, then open the browser gate only after the current match is finished and the maintainer confirms the timing.
4. Confirm actual browser pre-cache and CDN source behavior with the maintainer; project tests and visual validation have not been authorized.

## Rollback

Restore the backed-up source and Nginx snippet, return `SP_CLIENT_ONLY=1` if the browser entry was opened, and restart/reload only at a maintainer-approved safe time. The old fixed-path CDN assets and native bundles remain untouched.

## Checkpoint

2026-10-13: implementation remains local; no production restart, browser opening, GitHub push, project tests or visual verification.
