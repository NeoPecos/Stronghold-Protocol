# TASK-039 — 网页端开玩前预缓存素材

Status: `in_progress`
Lead / implementer: Codex
Starting commit: `4c517699`, in the isolated v0.2.6 merge worktree `F:\DSH-workspace\stronghold-026-integration`.

## Scope

- In the browser lobby, start a bounded download of shared UI assets before the player creates or joins a match; show item progress and allow retry without blocking gameplay.
- Reuse the existing room/match-specific warmup for the selected map, operators and imminent enemies as soon as that information exists.
- Request the same manifest URLs that the game will later use, so ordinary browser HTTP caching and the existing CDN redirect can be reused. Do not download the complete 852.5 MiB art library.
- Respect data-saver and the existing `resourceWarmup` preference for automatic work; allow an explicit manual start. Do not run this browser feature in packaged clients.

## Protected areas

- No service worker, forced CacheStorage interception, new CDN credentials, CDN upload, native-bundle changes or gameplay gate.
- Do not imply the browser downloaded everything or that cache storage survives browser eviction. A missing or failed prefetch must not prevent a match.
- The current CDN has fixed asset URLs. The separate v0.2.6 hash-path CDN change is still required before hashed game URLs can come from CDN rather than the local origin.

## Acceptance

- The lobby exposes progress, complete and retry states while preserving the primary room action and short-viewport layout.
- Selected baseline URLs come from the served asset manifest; the existing match-specific warmup remains bounded.
- Successful downloads consume responses completely, so browser HTTP caching can retain them; later game requests use those same URLs.
- Native clients do not auto-start browser pre-cache and the feature does not interrupt active matches.
- Per maintainer instruction, no project tests, lint, screenshots or evidence-style validation without an explicit request.

## Rollback

Remove the lobby component import/render and the `browserPrecache` module. The existing match-specific warmup and direct-loading path remain available; production is unchanged until a separate release.

## Checkpoint

2026-10-13: Maintainer chose shared assets plus the current match, not the full art library. Added a bounded automatic browser-lobby prefetch (28 shared UI keys plus up to five local battle sprites, two concurrent downloads, 12/24 MiB budget), visible item progress and manual retry. The current-match warmup now waits for chess data before resolving operator models; it still begins only when the server reveals the map and pieces. Source is in an isolated worktree, not deployed or pushed. CDN hash-path routing is not yet available, so v0.2.6 hashed URLs currently fall back to origin. No project tests run. Next: reconcile the CDN hash-path contract and release timing after the current match ends.
