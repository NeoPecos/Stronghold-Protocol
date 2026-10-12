# TASK-024 — 顶栏素材上线与裁剪比例修复

Status: `review_ready` (implemented and deployed at the maintainer's direction; awaiting Codex review)
Lead: Codex
Implementer: DeepSeek (2026-10-13, maintainer-reported defect on the live 0.2.5 server)
Starting commit: `63dadddb` (`integrate-upstream-0.2.3`, the revision deployed to production)

## Background

The maintainer reported (2026-10-13, after the 0.2.5 server deploy): 「游戏内顶部ui有问题，刚进游戏一开始还是更新前的，
进去后变为更新后的，但更新后的显示也不正确…应该是大小比例没调好，现在的过于大了」, with material images (top frame,
`休息一下` capsule, amber 🔍▶▶ button) and in-game screenshots. After the first repair round the maintainer reported
「还是原样啊？？？」 with a fresh screenshot: the frame and capsule were still the old art in their client.

Three separate causes, all confirmed by measurement:

1. **The art was never deployed.** TASK-014 installed the new art only on this workstation, and `public/assets/` is not
   tracked (game art is git-ignored), so the hash-compared, file-copy deploy of `9497533d` could not carry it. The server
   still had the original `frame_mid_normal.png` (1 160 B) and `bg_rest.png` (7 503 B) while the CSS written for the
   2 172×724 art was live — the old 183×34 frame collapsed to a nearly invisible strip and the old 157×45 `bg_rest` was
   stretched into a blank capsule. This is the "更新后显示不正确" the maintainer saw.
2. **The crop ratios resampled the art.** `center / 100% 455%` drew the frame at aspect 2.93 instead of 3.00 (2.4%
   squeeze) and `center / 123% 153%` drew the `休息一下` capsule at 4.33 instead of 3.30 (31% horizontal stretch), which
   contradicts TASK-014's own checkpoint ("CSS crops only the transparent source margins; it does not resample or
   recompress either PNG") and distorts the baked text.
3. **Clients keep the old bytes.** `/assets/**` is served with `Cache-Control: public, max-age=2592000`, so a browser (or
   WebView profile) that cached the old art never revalidates it — a server-side art fix cannot reach it. A native client
   is worse: it serves the art from its own verified local bundle, whose copies are the old files. Only a rebuilt package
   puts the new art into a native client.

## Scope

- `public/css/screens/game.css`: `.gtop__meter` frame background `center / 100% auto` (visible band 159 px, centred in
  the .48 rem box); `.capsule--rest-art` `center / auto 153%` (no resampling; baked capsule 1.643 rem × .499 rem); both
  art URLs carry a `?v=20261013` cache token; comments record the ratios and the token.
- `public/css/devices.css`: only the file's own compact-row rules (unchanged from the accepted baseline).
- `public/assets/ui/hudPanel/btn_check_enemy.png`: **left at its original bytes** (`d459f654…`, 2 029 B, 61×29). The first
  repair round wrongly installed the maintainer's larger reference art here; the HUD never requests this path — it loads
  the sprite through `localAsset('ui/battle', 'btn_check_enemy')`, i.e. `/assets/local/ui/battle/btn_check_enemy.png`
  (61×29), which already *is* the supplied amber 🔍▶▶ art and was never changed. The wrong file and the width rules
  derived from it (`calc(.46rem * 1047 / 454)`) were reverted.
- `test/ui/top-hud-art.test.js`: ratio pins `100% auto` / `auto 153%` with the cache token, plus pins for the 35×29 /
  61×29 sprite boxes of both stylesheets.
- `CHANGELOG.md` (inside the existing `0.2.5` entry), `docs/ops/2026-10.md`, `PROJECT-STATUS.md`.

## Protected areas

No battle-rule, server, simulation, placement-protocol, room, account, record or result change; no change to the official
sprites `public/assets/local/ui/battle/btn_check_*.png`; no `data/*.json` edit; no game art committed (`public/assets/`
stays ignored); no client package, update manifest, nginx or service change.

## Acceptance checks and evidence

- `node --test test/ui/top-hud-art.test.js` → 2/2; with `test/ui/text-scale.test.js` and `test/client-static.test.js` →
  386/386 pass.
- Local 1920×1080 render of `dev/game-mock.html?phase=PREP&shot=1&render=fallback` through
  `.local/task-014-top-hud-art/screenshot.mjs` (puppeteer-core + Edge headless) matches the intended top bar.
- **Live production render** (`.local/task-014-top-hud-art/prod-check.mjs`, fresh browser, native UA `SPClient/Windows`,
  `https://sp.bs.leio.fun/dev/game-mock.html?phase=PREP`): frame 482 174 B, `bg_rest` 900 142 B, the HUD's own sprite
  `/assets/local/ui/battle/btn_check_enemy.png` 1 746 B; computed `background-size` `100% auto` (frame) and
  `auto 153%` (capsule, `aria-label` 休息一下); the amber button box is 96.7×46 px (`.967rem`, its 61×29 ratio).
- Production files byte-identical to this checkout, backed up in `/root/sp2-backups/hud-art-20261013-023224/`
  (first round) and `/root/sp2-backups/hud-art-20261013-025529/` (second round):
  `public/css/screens/game.css` `1c6b0567f7e69e5c1c13392221ddc64e5e2317a10ad7bdff03678dd8b724f01c` (58 980 B),
  `public/css/devices.css` `12d4e2993e4b2c34dcd05c95751757bec65a5adea65f9ccf0b96694a1a912156` (12 506 B),
  `public/assets/ui/hudPanel/frame_mid_normal.png` `4fa2e8dcd1a5f3b8f8eab748524a9ff41823edbc4ddd11aaeb35d64e7eb05704`
  (482 174 B), `public/assets/ui/hudPanel/bg_rest.png`
  `4b0eda5ebf8301e45c1ed9489b32ea59056817f16534e4c5689e8640449464ba` (900 142 B), and the restored
  `public/assets/ui/hudPanel/btn_check_enemy.png`
  `d459f654e693eba2af89f39c067e902e39e0276dd356e5916d61f11dc2d31e1f` (2 029 B). Static files need no restart
  (`sp2` stayed active).
- External recheck: `?v=20261013` URLs return 200 with those exact byte counts (nginx ignores the query), and the served
  `game.css` contains both tokens and `.967rem`, with no `1047 / 454` rule left.

## Known boundaries (not solved here)

- Native clients still carry the old art in their local bundle (verified: `F:\DSH-workspace\stronghold-app\bundle`
  proves `/assets/ui/hudPanel/frame_mid_normal.png` 1 160 B, `bg_rest.png` 7 503 B and its own
  `btn_check_enemy.png` copy for both trusted origins). A rebuilt package (`scripts/snapshot-assets.mjs` +
  `scripts/assemble-index.mjs`) is required; the repository's `public/assets/` already holds the new frame/capsule art.
- The `?v=` token is the only cache-busting convention in this repository. It is additive and safe: the server ignores
  the query and the native client's `ServerPolicy.CanonicalPath` uses `uri.AbsolutePath`, so its local-bundle matching is
  unaffected. If the project prefers a different convention (e.g. nginx `no-cache` for this directory), the token is a
  two-line change in one stylesheet.

## Rollback

- Server: copy the files back from `/root/sp2-backups/hud-art-20261013-025529/` (or `-023224/` for the art), static
  files, no restart.
- Repository: `git revert <this task's commit>`; the pre-task sprite copy is
  `.local/task014-hud/original/btn_check_enemy.png` (scratch, git-ignored).

## Checkpoint

### 2026-10-13 02:32 — TASK-024 — DeepSeek (顶栏素材上线 + 裁剪比例修复)

- Action: proved by hash that the server served the original art while the new-art CSS was live, and that the two
  `background-size` values resampled the art by 2.4% and 31%; installed the TASK-014 art on the server, changed the crops
  to their source aspect, updated the pinned test values and this record.
- Result: production matched this checkout byte-for-byte; local mock render matched the supplied art; 461/461 targeted
  tests passed.
- Verification: the commands and hashes in "Acceptance checks and evidence".
- Next: the maintainer should hard-refresh to re-check.
- Production/GitHub: static files only on `sp.bs.leio.fun`; commit pushed to `integrate-upstream-0.2.3`.

### 2026-10-13 02:55 — TASK-024 — DeepSeek (纠正查看按钮素材路径 + 加缓存标识)

- Action: the maintainer reported 「还是原样啊？？？」. Two findings: ① the first round wrongly replaced
  `public/assets/ui/hudPanel/btn_check_enemy.png` (a path the HUD never requests) and sized the button box from that
  1 047×454 canvas; the sprite the HUD loads through `localAsset()` is `/assets/local/ui/battle/btn_check_enemy.png`
  (61×29, and it already is the supplied amber art) → the file is restored and the `.967rem` / `61 / 29` boxes are back.
  ② the remaining staleness is client-side: `/assets/**` is immutable for 30 days, so both art URLs now carry
  `?v=20261013`; browsers pick the new art up on a normal reload, while native clients keep serving their local bundle
  until the package is rebuilt.
- Result: deployed `game.css` 58 980 B, `devices.css` 12 506 B and the restored 2 029 B sprite (hashes above); live render
  in a fresh browser shows the intended frame, `休息一下` capsule and 96.7 px amber button.
- Verification: `top-hud-art` 2/2 and the 386/386 net; live `prod-check.mjs` output; external curl checks of both
  `?v=20261013` URLs and the served stylesheet.
- Next: Codex review of this task file; the maintainer rebuilds the client package to carry the new art natively (the
  maintainer owns packaging), and `TASK-014`'s remaining sprites stay as shipped.
- Production/GitHub: static files only; commit pushed to `integrate-upstream-0.2.3`.
