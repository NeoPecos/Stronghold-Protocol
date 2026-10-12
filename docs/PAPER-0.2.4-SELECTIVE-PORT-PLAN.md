# Paper-Yuan 0.2.4 selective integration plan

Updated: 2026-10-12

This plan turns the useful Paper-Yuan `0.2.4` differences into small, reviewable tasks. It is not permission to merge
the Paper-Yuan branch wholesale. The current fork's room directory, accounts/passwords, records/cards, custom combat
HUD and placement behavior remain authoritative.

## Source baseline

- Current review baseline: `c8551823` plus the active TASK-007 worktree changes.
- Paper-Yuan comparison point: `e0a28445` on `paper/0.2.4`.
- Official game baseline already present in this fork: `0.2.4`.
- Paper code is reference material. Every imported block must name its source file and be adapted to this fork.

## Delivery order

### Phase 0 — Finish the active client cleanup

- Complete and review TASK-007: native clients hide the browser fullscreen button.
- Do not start another runtime task in the same worktree until TASK-007 is accepted.

### Phase 1 — Measure mobile adaptation and blur

- Execute TASK-008 exactly as a diagnosis task.
- Measure viewport, safe area, device pixel ratio, canvas backing resolution, CSS scaling and the actual asset URL.
- Outcome gate: no resource, CSS or quality change proceeds without an accepted root-cause report.

### Phase 2 — Make native local assets deterministic

- Execute TASK-009 after TASK-008 is accepted.
- Locate and freeze the real Windows/Android wrapper source before implementation.
- Adapt the useful Paper concepts: background extraction, request interception, local manifest verification, connecting
  feedback, WebGL capability fallback and diagnostics.
- A native client must not silently fall back to the production server for an asset declared local.

### Phase 3 — Add bounded preload and cache

- Execute TASK-010 after TASK-009 establishes the authoritative client asset route.
- Implement a manifest-driven preload/cache service without importing Paper's CDN or hosting assumptions.
- Prioritize the title screen, selected map, operator lineup and current battle. Do not preload the entire library on
  low-memory devices.

### Phase 4 — Add communication and operations tools

- Execute TASK-005 after the performance work is stable.
- Add room text chat, optional in-room floating messages, authenticated announcements and audited administration.
- Room voice and WebRTC remain excluded.

### Phase 5 — Integrate live combat statistics

- Execute TASK-011.
- Reuse the existing authoritative record collector; do not create a second damage truth.
- Add an optional live per-operator damage/DPS view and extend the post-match/card model only where fields are proven.

### Phase 6 — Evaluate quick matchmaking

- Execute TASK-012 last.
- Start with an instrumented queue and explicit cancellation. AI fill is feature-flagged and only enabled after queue
  behavior is validated on production-like load.

## Parallel work

- TASK-004 account-bound selectable avatars does not depend on Paper-Yuan and may run in an isolated worktree after
  the account identity contract is frozen.
- Documentation or read-only research may run alongside a runtime task. Runtime tasks that touch overlapping client,
  room or asset files must run serially.
- TASK-013 records a possible TeamSpeak/WebSpeak room-voice integration. It is explicitly deferred, independent of
  Paper-Yuan voice, and must not enter this roadmap until the maintainer resumes it.

## Permanent exclusions

- Paper room voice and WebRTC signaling. TASK-013's separately designed TeamSpeak/WebSpeak integration remains
  deferred and is not an exception until explicitly resumed.
- Hard-coded federation nodes, server picker domains and deployment branding.
- Cloudflare, Render, Hugging Face, Codespaces and automatic repository synchronization scripts.
- Paper's embedded native Node runtime unless a separate task proves it is required and reviewable.
- Stub UI such as an empty server picker or preload modal.
- Any change to the custom combat HUD merely to match Paper screenshots.

## Release gates

Every runtime phase requires all of the following before release:

1. Task status is `accepted`, not merely `review_ready`.
2. Provenance review confirms only the named Paper files or original fork code were used.
3. Targeted tests, `npm run ci` and `npm run golden` have recorded outcomes; golden changes require an explicit rule
   change and justification.
4. A release file freezes the commit, artifacts, hashes, update path, production backup and rollback steps.
5. Windows and Android packages are built from the same accepted web/runtime commit and tested as real upgrades.
6. Production deployment remains a separate maintainer-authorized action.

## Success criteria

- Native local assets load from a verified local manifest with no unexplained network wait.
- Mobile rendering is sharp at the selected quality tier and remains usable across the measured landscape sizes.
- Preloading is bounded, observable and safe on low-memory devices.
- Chat/admin/statistics/matchmaking can each be disabled independently without breaking normal room play.
- No Paper-specific domain, CDN, voice or native runtime dependency is introduced accidentally.
