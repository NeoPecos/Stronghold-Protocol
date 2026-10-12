# TASK-002 — Reconcile and freeze the next release baseline

Status: `accepted`

Lead: Codex

Implementer: unassigned

Starting commit: `2cadc618`

## Goal

Turn the current mixed dirty tree into a reviewed, reproducible baseline before selected Paper-Yuan features or a new
client update are packaged.

## Scope

- Inventory every modified/untracked file and classify its origin and disposition.
- Preserve production hotfixes that are still intentional.
- Separate measurement scripts, temporary tests and obsolete release notes from runtime changes.
- Compare retained runtime files with JING where necessary.
- Freeze a clean candidate commit and update `docs/releases/1.2.9.md`.

## Protected areas

- Do not change game rules or regenerate golden results merely to clean the tree.
- Do not overwrite room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy, upload manifests or sign client metadata in this task.
- Do not import Paper-Yuan feature code until the baseline is frozen.

## Current checkpoint

- Production verified on 2026-10-12: server app `0.2.4`; Windows/Android manifests `1.2.8` code 11;
  `SP_CLIENT_ONLY` unset.
- Nine runtime files were hash-compared with JING and are byte-identical to production. They are retained production
  hotfixes: `public/index.html`, `public/js/main.js`, `public/js/render/units.js`, `server/http/static.js`,
  `server/http/websocket.js`, `server/index.js`, `public/browser-closed.html`, `public/js/ui/notice.js` and
  `server/http/clientOnly.js`.
- Browser-gate/notice tests and the related UI-test adjustments belong with those hotfixes and should be retained.
- `test/golden/matches.json` is the previously investigated intentional nine-stage-pool update; it still requires the
  full golden/CI gate before acceptance.
- `test/ui/community-layout.e2e.test.js` extends mobile result-exit coverage and is retained. All 12 viewport/text-size
  combinations pass without fullscreen in current source.
- `scripts/cdp-measure.mjs`, `scripts/measure-topbar.mjs`, `scripts/verify-local-api.mjs` and
  `test/ui/zz-topbar.mjs` were one-off measurement/verification helpers and have been removed from the candidate.
- Historical handoff/release notes are retained as evidence but explicitly superseded by the new status/release files.
- `npm run golden` passes all six suites (287 scenarios total). Browser gate/notice/docs checks pass 50/50; mobile
  result-exit E2E passes 12/12.
- Smoke, lint, import-boundary and type checks pass. The full unit/integration run reports one remaining candidate
  failure: packaging intentionally ignores the three untracked imported production-hotfix modules until they are
  formally added to the frozen Git baseline. Do not hide this by weakening the package test.
- Workflow documentation was committed as `324cda89`; the reviewed runtime/test baseline was committed as `e0231293`.
- Full `npm run ci` passes from the tracked baseline: setup, tests, smoke, lint, import boundaries and typecheck all
  completed successfully. Existing lint findings remain warnings only.

## Acceptance checks

- `git status` contains only intentional candidate changes or is clean.
- Every retained change has an originating task/log entry.
- Targeted tests for retained hotfixes pass.
- Full `npm run ci` and `npm run golden` results are recorded before release review.
- Release record states the exact frozen commit and truthfully lists unresolved failures.

## Next action

Baseline accepted. Continue with `TASK-003` from `e0231293`; keep each feature isolated from release packaging.

## Rollback

No production changes. Preserve unknown files until classified; do not use destructive cleanup commands.
