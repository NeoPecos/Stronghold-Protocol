# Project Status

Updated: 2026-10-12 18:13 (Asia/Singapore)

This is the repository's single current-state entry point. Historical details belong in `docs/ops/` and archived
handoff files. Update this page whenever production state, the active task, a release decision or a blocker changes.

## Production truth

- Public service: `sp2.service` on JING is active. It serves **both** `sp.bs.leio.fun` (production) and
  `sp2.bs.leio.fun` (preview) from one process on `127.0.0.1:3810` — nginx cut production over from the home server
  (WG `10.0.0.2:3800`) on 2026-10-09. The unit's name and its "0.2.1 staging line" description are stale labels.
- Game/server application: `0.2.4`; `/healthz` reports build `7699325bd657`.
- Client update manifest: Windows `1.2.8` (`versionCode` 11), Android `1.2.8` (`versionCode` 11).
- Deployed web assets now include the TASK-003 circular deployment wheel: `public/js/ui/facing.js` sha256 `93cca594…`,
  `public/js/ui/facingWheel.js` `0d5ebe94…`, `public/css/screens/game-panels.css` `9a31bf33…` (deployed 2026-10-12
  18:13, backup `/opt/sp2/backups/wheel-20261012-181314/`). The manifest was deliberately left unchanged.
- Browser-only gate: `SP_CLIENT_ONLY` is not enabled in the service environment.
- These values were read directly from JING on 2026-10-12. Recheck before any release or incident conclusion.

## Repository truth

- Working repository: `F:\DSH-workspace\stronghold-base-0.2.1`.
- Current branch: `integrate-upstream-0.2.3`; frozen runtime baseline: `e0231293`; TASK-003 implementation commit
  `198d5542`, pushed to `origin` (NeoPecos/Stronghold-Protocol) as a new branch on 2026-10-12 and **not** merged into
  `master`.
- Upstream game baseline included locally: `0.2.4`.
- Production-hotfix and browser-gate files are now tracked in the frozen baseline and match JING byte-for-byte.
- `/opt/sp2` was deployed from this same checkout by file copy, not by `git pull`: its `.git` is a leftover gitfile
  pointing at a Windows worktree, so it cannot be treated as a Git-based install.
- `docs/MAINTENANCE-HANDOFF.md` is a historical incident record. It contains later and earlier states and must not be
  treated as current without verification.
- `docs/RELEASE-1.2.9.md` is an older preparation snapshot and is superseded by `docs/releases/1.2.9.md`.

## Active work

- Active tasks: `docs/tasks/TASK-003-mobile-deployment-ui.md` and its deploy record
  `docs/tasks/TASK-006-deploy-wheel.md` — both `review_ready`, awaiting Codex review.
- TASK-003 was **deployed before review**, at the maintainer's explicit direction on 2026-10-12.
- Shelved at the maintainer's direction: the mobile result-exit / native-wrapper item. It still needs an APK and
  on-device safe-area measurements to reproduce.
- Next feature queue: selectable account avatar; room text chat and
  announcement/admin tools.
- Explicitly excluded from the next update: room voice, wholesale Paper-Yuan merge, unreviewed native Android runtime,
  and CDN activation.

## Immediate next action

Codex reviews TASK-003 and the TASK-006 deploy record. If the wheel port is accepted, close both tasks; if it is
rejected, restore the three files from `/opt/sp2/backups/wheel-20261012-181314/` and return TASK-003 to
`in_progress`. Keep the result-exit item shelved until wrapper reproduction is possible.

## Stop conditions

- Do not build or publish a client until the active feature tasks and release gates are accepted.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
