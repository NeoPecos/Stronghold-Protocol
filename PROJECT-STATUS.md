# Project Status

Updated: 2026-10-12 19:23 (Asia/Singapore)

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
- Browser-only gate: TASK-020 reports `SP_CLIENT_ONLY=1` is live; browsers receive the bandwidth notice while native
  clients still receive the game. Recheck directly before release work.
- Media caching: TASK-021's nginx immutable-cache headers are live. TASK-022's Node/nginx ETag alignment is committed
  locally but is **not deployed** because deployment restarts Node.
- These values were read directly from JING on 2026-10-12. Recheck before any release or incident conclusion.

## Repository truth

- Working repository: `F:\DSH-workspace\stronghold-base-0.2.1`.
- Current branch: `integrate-upstream-0.2.3`; current local HEAD `a0503d46`; remote branch currently ends at
  `7bc9a3c7`, so the local branch is seven commits ahead before TASK-017. It is **not** merged into `master`.
- Upstream game baseline included locally: `0.2.4`.
- Production-hotfix and browser-gate files are now tracked in the frozen baseline and match JING byte-for-byte.
- `/opt/sp2` was deployed from this same checkout by file copy, not by `git pull`: its `.git` is a leftover gitfile
  pointing at a Windows worktree, so it cannot be treated as a Git-based install.
- `docs/MAINTENANCE-HANDOFF.md` is a historical incident record. It contains later and earlier states and must not be
  treated as current without verification.
- `docs/RELEASE-1.2.9.md` is an older preparation snapshot and is superseded by `docs/releases/1.2.9.md`.

## Active work

- Accepted tasks: TASK-003 (deployment wheel), TASK-006 (its production deployment record) and TASK-007 (hide the
  browser fullscreen control in native clients). TASK-007 commit `fe54953c` passed Codex review on 2026-10-12; it has
  not been packaged or deployed as a client update.
- TASK-003 **passed** Codex review on 2026-10-12 with no runtime-code problems; `server/`, the placement protocol, the
  simulation logic, the combat HUD, room voice and the Android runtime were confirmed unmodified, and the fork-only
  chevron tap, `r=22` hit circle, audio blip, keyboard operation, `boardDir` mirroring and range preview were
  confirmed preserved.
- The only review finding was in TASK-006's rollback command (bare filenames instead of the backup's `public/...`
  paths). Corrected in `bd68fe17`; documentation only.
- TASK-003 was **deployed before review**, at the maintainer's explicit direction on 2026-10-12.
- TASK-008 is `blocked`: the browser-side DPR cap contributor is proven, but native WebView and real usable-landscape
  measurements require maintainer device access. This does not authorise rendering changes or TASK-009.
- TASK-014 is accepted locally: the supplied top-frame and literal `休息一下` art replace the two existing ignored
  manifest assets, with phase-gated markup, CSS transparent-margin positioning and a focused regression test. It is
  not built, deployed or pushed.
- TASK-015 assigns the selective upstream `v0.2.5` integration to DeepSeek under Codex review. The fetched upstream
  target is tag `v0.2.5` / `cf7a9400`; its 221-file range is too broad for a wholesale merge.
- TASK-016 is the separate planned release task. It packages the accepted TASK-015 result together with TASK-014's
  art, proves a real deployed-baseline increment, then backs up and deploys; it is not yet authorised to run.
- TASK-017 is the immediate Git checkpoint task assigned to DeepSeek. It splits the current tree into a TASK-014
  runtime/test commit and a governance/roadmap commit, preserves ignored art by hash, stops for Codex review and does
  not push or begin v0.2.5 integration.
- TASK-018 follows TASK-017 and creates a separate local Git repository for the currently unversioned
  `F:\DSH-workspace\stronghold-app` wrapper source. Signing keys, toolchains, 800+ MiB bundles, outputs and release
  files are excluded; no remote or publication is authorised.
- TASK-020 and TASK-021 are `review_ready` after production changes: the browser gate and nginx media-cache headers
  are live. TASK-022 is `review_ready` with a local Node ETag fix that is not deployed. TASK-017 preserves and audits
  these existing commits rather than rewriting them.
- Shelved at the maintainer's direction: the mobile result-exit / native-wrapper item. It still needs an APK and
  on-device safe-area measurements to reproduce.
- Next feature queue: selectable account avatar; room text chat and
  announcement/admin tools. Paper-Yuan `0.2.4` follow-up work is now split into TASK-008 through TASK-012 and ordered
  by `docs/PAPER-0.2.4-SELECTIVE-PORT-PLAN.md`: diagnose mobile blur, establish deterministic native local assets,
  add bounded preload/cache, then communication/admin, live combat statistics and optional quick matchmaking.
- Explicitly excluded from the next update: room voice, wholesale Paper-Yuan merge, unreviewed native Android runtime,
  and CDN activation.
- TASK-013 records a future TeamSpeak/WebSpeak temporary-channel integration, but the maintainer explicitly deferred
  it. Do not implement it or include voice in a release. WebSpeak secret-bearing startup logs must be redacted and the
  affected TeamSpeak/WebQuery credentials rotated before that task can ever resume.
- TASK-008 proves a DPR-3 browser field canvas is capped at ratio 2 and enlarged 1.5×, but remains blocked on native
  WebView and usable-height evidence. Do not change rendering quality until its implementation plan is accepted.

## Immediate next action

DeepSeek executes TASK-017 Checkpoint A, then B, and stops at `review_ready`. After Codex review it performs TASK-018's
safe local client-wrapper Git initialisation. Only then does TASK-015 receive the accepted main-repository baseline;
TASK-016 remains blocked on TASK-015 acceptance. TASK-008/009 rendering work remains blocked. Nothing is merged to
`master`, and no wrapper remote is created yet.

## Stop conditions

- Do not build or publish a client until the active feature tasks and release gates are accepted.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
