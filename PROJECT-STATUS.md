# Project Status

Updated: 2026-10-12 (Asia/Singapore)

This is the repository's single current-state entry point. Historical details belong in `docs/ops/` and archived
handoff files. Update this page whenever production state, the active task, a release decision or a blocker changes.

## Production truth

- Public service: `sp2.service` on JING is active.
- Game/server application: `0.2.4`; `/healthz` reports build `7699325bd657`.
- Client update manifest: Windows `1.2.8` (`versionCode` 11), Android `1.2.8` (`versionCode` 11).
- Browser-only gate: `SP_CLIENT_ONLY` is not enabled in the service environment.
- These values were read directly from JING on 2026-10-12. Recheck before any release or incident conclusion.

## Repository truth

- Working repository: `F:\DSH-workspace\stronghold-base-0.2.1`.
- Current branch: `integrate-upstream-0.2.3`; frozen runtime baseline: `e0231293`.
- Upstream game baseline included locally: `0.2.4`.
- Production-hotfix and browser-gate files are now tracked in the frozen baseline and match JING byte-for-byte.
- `docs/MAINTENANCE-HANDOFF.md` is a historical incident record. It contains later and earlier states and must not be
  treated as current without verification.
- `docs/RELEASE-1.2.9.md` is an older preparation snapshot and is superseded by `docs/releases/1.2.9.md`.

## Active work

- Active task: `docs/tasks/TASK-003-mobile-deployment-ui.md`.
- Next feature queue: selectable account avatar; room text chat and
  announcement/admin tools.
- Explicitly excluded from the next update: room voice, wholesale Paper-Yuan merge, unreviewed native Android runtime,
  and CDN activation.

## Immediate next action

Implement the hybrid Paper-Yuan deployment wheel on top of baseline `e0231293`, preserving this fork's direct
direction-tap behavior and custom combat HUD. Reproduce the mobile-wrapper result-screen issue before further layout
changes.

## Stop conditions

- Do not build or publish a client until the active feature tasks and release gates are accepted.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
