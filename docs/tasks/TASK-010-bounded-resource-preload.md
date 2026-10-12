# TASK-010 — Bounded resource preload and cache

Status: `review_ready`

Lead: Codex

Implementer: Codex

Starting commit: `64578102`, on top of the in-progress selective v0.2.5 worktree

Depends on: TASK-009 accepted

## Goal

Required match assets are ready before they are first rendered, without downloading the complete art library or
coupling this fork to Paper's CDN and hosting layout.

## Scope

- Define one manifest-driven resource service for web and native callers while preserving native local ownership.
- Preload only the title essentials, selected map, current operator lineup, enemies and imminent battle effects.
- Bound concurrency, bytes, decoded image count and retries according to memory/network tier.
- Report progress, cache hits, failures and fallback reasons without exposing private paths or credentials.
- Version cache namespaces so an update can invalidate stale files without clearing unrelated browser storage.
- Use a feature flag and a no-preload path for diagnosis and rollback.

## Protected areas

- No CDN activation, external domain, service-worker takeover or full-library eager download by default.
- Do not replace native manifest-owned files with server/mirror files.
- Do not alter image format or quality in this task.
- Do not change gameplay, simulation, room, account, record or custom HUD behavior.

## Acceptance checks

- First-render requests for a selected test match are enumerated and the critical set is ready before match reveal.
- Low-memory mode stays within a documented decoded-image and byte budget.
- Interrupted preload resumes or fails cleanly and normal room play still works with the feature disabled.
- Cache-version upgrade and stale-entry eviction have automated tests.
- Browser and native tests prove they select the correct source for the same asset key.
- Targeted checks, `npm run ci` and `npm run golden` are recorded; goldens remain unchanged.

## Current checkpoint

- 2026-10-13: implemented bounded warmup using the existing asset manifest/resolver and HTTP cache, covering selected battlefield assets, up to six current operators and four imminent enemy models.
- Two concurrent requests, 20/40 files and 8/16 MiB per batch according to memory tier; stream responses without decoding or retaining textures. Room exit cancels pending work; new target lists replace the previous batch. Successful URLs are bounded to 256 per page. Normal HTTP validators and the existing build reload handle resource updates.
- Uses the native wrapper's existing local interception path. Paper's CDN challenge, service worker and complete-library download were deliberately excluded. The old roadmap dependency is superseded by the maintainer's request to complete a small integrated implementation.
- Targeted budget/concurrency tests pass. Manual loading/memory behavior remains for the maintainer.


## Review notes

- Reviewer must inspect memory bounds, cancellation, cache invalidation and source-selection tests before accepting.

## Rollback

Disable the preload feature flag, unregister only the task-owned cache/service-worker version if one is introduced,
and retain the existing direct-loading path.
