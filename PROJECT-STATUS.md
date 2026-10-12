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
- Current branch/commit: `integrate-upstream-0.2.3` at `2cadc618` (`origin/master`).
- Upstream game baseline included locally: `0.2.4`.
- The working tree contains uncommitted production-hotfix and browser-gate files plus test/measurement changes.
  Their provenance must be reconciled before feature work is packaged.
- `docs/MAINTENANCE-HANDOFF.md` is a historical incident record. It contains later and earlier states and must not be
  treated as current without verification.
- `docs/RELEASE-1.2.9.md` is an older preparation snapshot and is superseded by `docs/releases/1.2.9.md`.

## Active work

- Active task: `docs/tasks/TASK-002-release-baseline.md`.
- Next feature queue: hybrid deployment wheel and mobile result exit; selectable account avatar; room text chat and
  announcement/admin tools.
- Explicitly excluded from the next update: room voice, wholesale Paper-Yuan merge, unreviewed native Android runtime,
  and CDN activation.

## Immediate next action

Review and checkpoint the retained production hotfixes in Git, then rerun full CI so the package test sees the imported
modules as shipped files. Golden, smoke, lint, import boundaries, type checks and targeted mobile/browser tests already
pass. Freeze that baseline before porting the hybrid Paper-Yuan deployment wheel.

## Stop conditions

- Do not build or publish a client from the current dirty tree.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
