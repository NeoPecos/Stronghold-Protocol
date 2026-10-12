# Project Status

Updated: 2026-10-13 (Asia/Singapore)

This is the repository's single current-state entry point. Historical details belong in `docs/ops/` and archived
handoff files. Update this page whenever production state, the active task, a release decision or a blocker changes.

## Production truth

- Public service: `sp2.service` on JING is active. It serves **both** `sp.bs.leio.fun` (production) and
  `sp2.bs.leio.fun` (preview) from one process on `127.0.0.1:3810` — nginx cut production over from the home server
  (WG `10.0.0.2:3800`) on 2026-10-09. The unit's name and its "0.2.1 staging line" description are stale labels.
- Game/server application: `0.2.5`; `/healthz` reports build `c13af814d77f` (server-only deploy 2026-10-13 01:52 +08 from
  `9497533d`; client packages and the update manifest remain `1.2.8`).
- Client update manifest: Windows `1.2.8` (`versionCode` 11), Android `1.2.8` (`versionCode` 11).
- Deployed web assets now include the TASK-003 circular deployment wheel: `public/js/ui/facing.js` sha256 `93cca594…`,
  `public/js/ui/facingWheel.js` `0d5ebe94…`, `public/css/screens/game-panels.css` `9a31bf33…` (deployed 2026-10-12
  18:13, backup `/opt/sp2/backups/wheel-20261012-181314/`). The manifest was deliberately left unchanged.
- Deployed web assets also include the TASK-024 top-HUD art fix (deployed 2026-10-13 02:32, corrected 02:55):
  `public/assets/ui/hudPanel/` now carries the TASK-014 art (`frame_mid_normal.png` `4fa2e8dc…` 482 174 B,
  `bg_rest.png` `4b0eda5e…` 900 142 B — `public/assets/` is git-ignored, so the hash-compared 0.2.5 deploy never copied
  them). `public/css/screens/game.css` `1c6b0567…` (58 980 B) and `public/css/devices.css` `12d4e299…` (12 506 B) keep
  every art crop at its source aspect (the previous `100% 455%` / `123% 153%` squeezed the frame by 2.4% and stretched
  the `休息一下` capsule by 31%) and load both art files through a `?v=20261013` token, so a normal reload picks them up
  even though `/assets/**` is `max-age=2592000`. The enemy check sprite was **not** replaced: the HUD loads it through
  `localAsset('ui/battle', …)` → `/assets/local/ui/battle/btn_check_enemy.png` (1 746 B, 61×29, already the supplied
  amber art), and `public/assets/ui/hudPanel/btn_check_enemy.png` was restored to its original `d459f654…` (2 029 B)
  after the first round wrongly replaced that unused path. Backups `/root/sp2-backups/hud-art-20261013-023224/` and
  `-025529/`. Client packages still embed the old art, so a native client needs a rebuilt package.
- Browser-only gate: TASK-020 reports `SP_CLIENT_ONLY=1` is live; browsers receive the bandwidth notice while native
  clients still receive the game. Recheck directly before release work.
- Media caching: TASK-021's nginx immutable-cache headers are live. TASK-022's Node/nginx ETag alignment is committed
  locally but is **not deployed** because deployment restarts Node.
- These values were read directly from JING on 2026-10-12. Recheck before any release or incident conclusion.

## Repository truth

- Working repository: `F:\DSH-workspace\stronghold-base-0.2.1`.
- Current branch: `integrate-upstream-0.2.3` (historical branch name). Official v0.2.5 and the Paper-Yuan feature batch
  are committed in `9497533d` and pushed to the same origin branch. The previous checkpoint chain was included.
- Game source version: `0.2.5`; no merge into `master` and no client packaging. The public server was deployed to `0.2.5`
  on 2026-10-13 01:52 +08 (TASK-016, server-only, at the maintainer's explicit direction); client packages and the
  update manifest remain `1.2.8`.
- `npm run ci` is **green** on this line (last verified 2026-10-13 02:19; setup / test / smoke / lint / imports / typecheck
  all pass) after repairing three batch-carried gate failures: `CHANGELOG.md` dates the `0.2.5` entry, the quick-match
  text in `public/css/room-chat.css` sizes through `--t`, and `public/index.html` loads `room-chat.css` before
  `devices.css`. Both front-end files are live on the server (`room-chat.css` sha256 `89e4a06d…`, `index.html`
  `8464fd34…`). The one remaining test failure is environmental: `test/assets-env-proxy.test.js` assumes the process was
  not started with `NODE_USE_ENV_PROXY=1` (this workstation sets it plus `HTTP(S)_PROXY`); it passes 9/9 with those
  variables cleared.
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
  manifest assets, with phase-gated markup, CSS transparent-margin positioning and a focused regression test. Its CSS is
  pushed and live, but the art reached the server only through TASK-024 (see Production truth above): it is still absent
  from every client package, and TASK-024 removed the 2.4% / 31% crop resampling, added the `?v=` cache token and left the
  enemy check sprite untouched (`ui/battle/btn_check_enemy` is already the supplied art).
- TASK-015's official `v0.2.5` code/data integration is committed/pushed in `9497533d`; focused checks pass.
  The maintainer will perform gameplay/device testing before packaging or deployment.
- TASK-016 is the separate release task. Its **server-only** half ran on 2026-10-13 by direct maintainer order: the
  pushed `9497533d` code/data is live on `/opt/sp2` (`0.2.5`, build `c13af814d77f`) after a full backup (174 paths:
  125 replaced, 48 added; no `npm install` needed). Client packages (Windows/Android `1.2.9`), the update manifest,
  TASK-014's art in a package and the durable release file remain open, and TASK-014/TASK-015 still await Codex review.
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

The integration batch is pushed and its server half is **live** (`0.2.5`, build `c13af814d77f`, server-only; backup
`/root/sp2-backups/sp2-pre-025-20261013-015200.tgz`). Next: the maintainer's gameplay/device acceptance, then client
packaging (Windows/Android `1.2.9`) with the update manifest and Codex review of TASK-014/TASK-015/TASK-016. Fix the two
known CI failures on `9497533d` (CHANGELOG newest entry `0.2.4` vs `0.2.5`; `public/css/room-chat.css` font-size
assertion) together with that packaging work. Native wrapper work remains separate.

## Stop conditions

- Do not build or publish a client until the active feature tasks and release gates are accepted.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
