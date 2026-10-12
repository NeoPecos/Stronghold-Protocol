# TASK-024 — 顶栏素材上线与裁剪比例修复

Status: `review_ready` (implemented and deployed at the maintainer's direction; awaiting Codex review)
Lead: Codex
Implementer: DeepSeek (2026-10-13, maintainer-reported defect on the live 0.2.5 server)
Starting commit: `63dadddb` (`integrate-upstream-0.2.3`, the revision deployed to production)

## Background

The maintainer reported (2026-10-13, after the 0.2.5 server deploy): 「游戏内顶部ui有问题，刚进游戏一开始还是更新前的，
进去后变为更新后的，但更新后的显示也不正确…应该是大小比例没调好，现在的过于大了」, with material images (top frame,
`休息一下` capsule, amber 🔍▶▶ button) and two in-game screenshots.

Two independent causes:

1. **The art was never deployed.** TASK-014 installed the new art only on this workstation, and `public/assets/` is not
   tracked (game art is git-ignored), so the hash-compared, file-copy deploy of `9497533d` could not carry it. The server
   still had the original files (`frame_mid_normal.png` 1 160 B, `bg_rest.png` 7 503 B, `btn_check_enemy.png` 2 029 B)
   while the CSS written for the 2 172×724 art was live — the old 183×34 frame collapsed to a nearly invisible strip and
   the old 157×45 `bg_rest` was stretched into a blank capsule. This is the "更新后显示不正确" the maintainer saw.
2. **The crop ratios resampled the art.** `center / 100% 455%` drew the frame at aspect 2.93 instead of 3.00 (2.4%
   squeeze) and `center / 123% 153%` drew the `休息一下` capsule at 4.33 instead of 3.30 (31% horizontal stretch), which
   contradicts TASK-014's own checkpoint ("CSS crops only the transparent source margins; it does not resample or
   recompress either PNG") and distorts the baked text.

## Scope

- `public/css/screens/game.css`: `.gtop__meter` frame background `center / 100% auto` (visible band 159 px, centred in
  the .48 rem box); `.capsule--rest-art` `center / auto 153%` (no resampling; baked capsule 1.643 rem × .499 rem);
  `.enemybtn.has-sprite.is-wide { width: calc(.46rem * 1047 / 454); }` because the supplied enemy art canvas is
  1 047×454 instead of the old 61×29; two comments record where the ratios come from.
- `public/css/devices.css`: the compact/touch override for the same button follows the new canvas ratio
  (`calc(max(.46rem, 26px) * 1047 / 454)`).
- `public/assets/ui/hudPanel/btn_check_enemy.png`: the supplied amber 🔍▶▶ art, cropped to its opaque bounding box
  (1 047×454, 681 639 B, sha256 `113260271c4b46f6e04634a8e1dda3490e8b21b6df81eef4118da630fa811026`). The previous
  sprite is kept at `.local/task014-hud/original/btn_check_enemy.png` (scratch, git-ignored).
- `test/ui/top-hud-art.test.js`: the ratio pins become `100% auto` / `auto 153%`, plus new pins for the `1047 / 454`
  widths in both stylesheets.
- `CHANGELOG.md` (inside the existing `0.2.5` entry), `docs/ops/2026-10.md`, `PROJECT-STATUS.md`.

## Protected areas

No battle-rule, server, simulation, placement-protocol, room, account, record or result change; no change to the other
top-bar sprites (`btn_check_player_normal/unfold/back`, `btn_check_enemy_unfold` stay as shipped); no `data/*.json` edit;
no game art committed (`public/assets/` stays ignored); no client package, update manifest, nginx or service change.

## Acceptance checks and evidence

- `node --test test/ui/top-hud-art.test.js` → 2/2.
- Regression net `top-hud-art + text-scale + client-static + playtest2 + playtest5-ui + issue5-fold-camera +
  docs-consistency + docs-paths` → 461/461 pass.
- Local 1920×1080 render of `dev/game-mock.html?phase=PREP&shot=1&render=fallback` through
  `.local/task-014-top-hud-art/screenshot.mjs` (puppeteer-core + Edge headless): `top-center.png` shows the capsule at
  its own ratio and the right button drawn from the new art with full-size chevrons, next to the pre-fix
  `before-top-center.png`.
- Production: the three files were backed up to `/root/sp2-backups/hud-art-20261013-023224/`, installed with
  `install -o sp2 -g sp2 -m 644`, and their remote sha256 match this checkout byte-for-byte —
  `public/css/screens/game.css` `9d7e0d616a89be139dfe6a0175121d283efe9f8b84b4b7b52eac0d759d414f0a` (58 952 B),
  `public/css/devices.css` `d04ea594149dbf48a1774a88e9e7361c6edfc53bfe6e5035a3659b8fab60bbd1` (12 683 B),
  `public/assets/ui/hudPanel/btn_check_enemy.png`
  `113260271c4b46f6e04634a8e1dda3490e8b21b6df81eef4118da630fa811026` (681 639 B). Static files need no restart
  (`sp2` stayed active).
- External recheck: `https://sp.bs.leio.fun/assets/ui/hudPanel/btn_check_enemy.png` → 200, 681 639 B, same sha256;
  the served `game.css` contains `100% auto`, `auto 153%` and `1047 / 454`, and no longer contains `100% 455%` or
  `123% 153%`.

## Known boundaries (not solved here)

- Client packages still carry the old art: the wrapper bundle (`F:\DSH-workspace\stronghold-app\bundle`) proves
  `frame_mid_normal.png` 1 160 B `5171110e…`, `bg_rest.png` 7 503 B `f1f2949d…`, `btn_check_enemy.png` 2 029 B
  `d459f654…` for both trusted origins, and offline-first clients read those. Only a rebuilt package
  (`scripts/snapshot-assets.mjs` + `scripts/assemble-index.mjs`) puts the new art into a native client.
- `/assets/**` is served with `Cache-Control: public, max-age=2592000`, so a browser that already cached the old art
  keeps it for up to 30 days: a hard refresh is required. HTML/CSS/JS/data are `no-cache`, so code is never stale.

## Rollback

- Server: copy the three files back from `/root/sp2-backups/hud-art-20261013-023224/` (same relative paths, static
  files, no restart).
- Repository: `git revert <this task's commit>`, and restore the previous sprite from
  `.local/task014-hud/original/btn_check_enemy.png` if that art change must also be undone.

## Checkpoint

### 2026-10-13 02:32 — TASK-024 — DeepSeek (顶栏素材上线 + 裁剪比例修复)

- Action: proved both causes by hash (server served the original art while the new-art CSS was live; the two
  `background-size` values resampled the art by 2.4% and 31%), installed the TASK-014 art on the server, replaced the
  enemy sprite with the maintainer-supplied art cropped to its opaque box, changed the crops to their source aspect,
  updated the pinned test values and this record.
- Result: production matches this checkout byte-for-byte (hashes above); the local mock render matches the supplied art;
  461/461 targeted tests pass.
- Verification: the commands and hashes in "Acceptance checks and evidence", plus
  `node --test test/docs-consistency.test.js test/docs-paths.test.js`.
- Next: the maintainer should hard-refresh the browser to re-check the top bar; a rebuilt client package is still
  required before native clients show the new art. The remaining check-button sprites (player/enemy-unfold) were not
  re-supplied and stay as shipped.
- Production/GitHub: static files only on `sp.bs.leio.fun`; client packages, update manifest, nginx and server data
  untouched; this task's commit is pushed to `integrate-upstream-0.2.3`.
