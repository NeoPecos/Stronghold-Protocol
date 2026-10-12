# Project Status

Updated: 2026-10-13 (Asia/Singapore)

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
- Current branch: `integrate-upstream-0.2.3`; TASK-017's reviewed implementation chain ends at `24fe723c`; remote
  branch currently ends at `7bc9a3c7`. The accepted local checkpoint chain is not pushed or merged into `master`.
- Last committed upstream game baseline: `0.2.4`; an uncommitted selective `v0.2.5` integration is implemented locally.
- Production-hotfix and browser-gate files are now tracked in the frozen baseline and match JING byte-for-byte.
- `/opt/sp2` was deployed from this same checkout by file copy, not by `git pull`: its `.git` is a leftover gitfile
  pointing at a Windows worktree, so it cannot be treated as a Git-based install.
- `docs/MAINTENANCE-HANDOFF.md` is a historical incident record. It contains later and earlier states and must not be
  treated as current without verification.
- `docs/RELEASE-1.2.9.md` is an older preparation snapshot and is superseded by `docs/releases/1.2.9.md`.

## Active work

- 2026-10-13 integration batch: official v0.2.5 plus Paper-Yuan room text chat/floating messages, announcements/admin room removal, quick matching, live operator DPS and bounded resource warmup are implemented. Targeted backend checks, typecheck and changed-file lint pass. The maintainer owns gameplay/device testing and has authorized a repository push; no deployment is included.
- TASK-005/010/011/012/015 are `review_ready`. Historical sequential roadmap gates below are superseded for this grouped implementation. TASK-004 selectable account avatars remains a separate feature (not provided by Paper-Yuan), and TASK-013 voice remains deferred.

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
- TASK-008 is accepted as a bounded diagnosis: browser DPR-cap upscaling is proven, while native WebView and real
  usable-landscape conclusions remain explicitly unproven. TASK-023 owns the rendering-resolution implementation.
- TASK-014 is accepted locally: the supplied top-frame and literal `休息一下` art replace the two existing ignored
  manifest assets, with phase-gated markup, CSS transparent-margin positioning and a focused regression test. It is
  not built, deployed or pushed.
- TASK-015's official `v0.2.5` code/data integration is implemented locally against `a72aca6d`; focused checks pass.
  It is not committed, pushed, packaged or deployed; the maintainer will perform gameplay/device testing.
- TASK-016 is the separate planned release task. It packages the accepted TASK-015 result together with TASK-014's
  art, proves a real deployed-baseline increment, then backs up and deploys; it is not yet authorised to run.
- TASK-017 is accepted locally. It split the former dirty tree into a TASK-014 runtime/test commit, a
  governance/roadmap commit and a documentation-only execution record; ignored art remains outside Git with verified
  hashes. No TASK-017 commit has been pushed.
- TASK-018 is accepted: `F:\DSH-workspace\stronghold-app` now has a clean local Git baseline at `7ec87b40` with 51
  reviewed source files. Signing keys, toolchains, bundles, outputs, publication files and deferred `deploy/` files
  remain ignored; the wrapper repository has no remote and is not published.
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
- TASK-023 is planned for DeepSeek: make `native` resolution follow the real device DPR under the existing field and
  board pixel budgets, preserve all fixed modes, and require physical Android evidence before any default changes.

## Immediate next action

Commit and push the integration batch to the existing origin branch, as explicitly authorized on 2026-10-13.
The maintainer tests gameplay/device behavior before packaging or production release. Native wrapper work remains separate.

## Stop conditions

- Do not build or publish a client until the active feature tasks and release gates are accepted.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
