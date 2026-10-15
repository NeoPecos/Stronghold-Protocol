# Project Status

Updated: 2026-10-16 (Asia/Singapore)

This is the repository's single current-state entry point. Historical details belong in `docs/ops/` and archived
handoff files. Update this page whenever production state, the active task, a release decision or a blocker changes.

## Production truth

- **2026-10-16 source Git checkpoint (TASK-059):** The previously unfinished 0.2.6 merge is commit `7d531227`; remaining work is pending-validation checkpoint `59d56666`; the four other local commits are included by ancestry in merge `cb18947a`. `origin/integrate-upstream-0.2.3` was pushed to `cb18947a`. This Git operation did not deploy, restart, build a client or validate gameplay. A final documentation-only commit may advance the source tip.
- **2026-10-16 source TASK-058:** The pushed source scopes Touch and other teammate-targeted strategy/item effects to fixed groups and applies proportional group quotas with 50% extra damage in multiplayer boss fights. Boss fields pair within a group; browser local prediction uses server raw group totals. This is untested and was not deployed by this task; live production behavior was not inspected. It depends on the unvalidated TASK-045 group runtime, so do not ship it independently or infer that online players have it.
- **2026-10-16 source TASK-057:** The pushed source includes group-colored room/match member UI, capacity-based empty group slots and self-selection, an all-group setup-reroll pool fix, three-round unite helper rotation and a room-rules placement for AI-last. These edits were not tested, built or deployed by this task. The maintainer says a multiplayer update is already live, but this turn did not audit the production build; the 2026-10-15 global-pool statements below may therefore be stale. Reconcile production/source provenance before releasing any of these files.
- **2026-10-15 browser asset rollout (TASK-055/056):** All 13,725 production/source files and pinned Cloudflare Pages files were hash/length reconciled (one 6.5-MB scene binary needed a longer recheck). Four browser static files are live: Cloudflare-first Service Worker with 5-second no-response fallback to origin-only, strict fresh-browser 11-map/common pack gate, and cache-on-use. The 0.2.6 production index received only three surgical hunks. Backup `/opt/sp2/backups/task055056-browser-assets-20261015-2217/`; both public domains and `/healthz` returned 200, hashes matched, PID `2603071` stayed unchanged. Existing token-bearing tabs remain on their prior flow; maintainer browser/gameplay acceptance pending. The legacy CDN remains configured for old/non-worker clients until separate migration.
- **2026-10-15 local-only TASK-045/052/054:** The dirty worktree now contains occupied-seat four-player groups, host swaps and AI opening-strategy assignments, separate operator/item stocks, five groups choosing SP cards concurrently, a bounded 20-player strategy-order list, and the previously added configurable multi-wave unite. None of this work has been tested, played through, built or deployed. Production still has one global pool, one R11 draft and one two-helper unite wave; do not release these local rules without maintainer-authorized acceptance.
- **2026-10-15 read-only audit:** Production now contains the 20-seat lobby and historical announcement system, but the match still instantiates one shared operator pool and one shared item pool for all occupied seats; the round-11 draft is also global. The avatar manifest lacks Amiya and Goldenglow skins, and the boss HP helper caps co-op scaling at four alive players. These remain live defects. TASK-045's four-seat grouping helper / expanded boss scaling are local only, untested and not deployed.
- **2026-10-15 UI hotfix:** At the maintainer's direction, hot-deployed TASK-050's narrow-screen lobby breakpoint and bounded/scrollable/collapsible in-match member list. Only three static CSS/JS files changed; backup `/opt/sp2/backups/task050-ui-20261015/old/`. Remote hashes matched, `sp2.service` stayed active with unchanged PID `2366839`; visual acceptance is pending.
- **2026-10-15 announcement:** At the maintainer's explicit instruction, published and pinned `client-and-group-20261015` with QQ group `1124360673` and Windows/Android client guidance. The previous update notice remains in history; archive backup `/root/sp2-backups/announcements-20261015-task053/`. No game-service restart.
- **Current:** JING runs `0.2.6` build `a25d24fec134` since 2026-10-13 19:55 +08, and browser access is open on both public domains. The maintainer explicitly approved interrupting five active matches for this timed release. The 52-file runtime archive and rollback are at `/root/sp2-backups/release-026-20261013-1955/`; browser pre-cache, hash-addressed immutable origin assets and the legacy CDN route are live. The later source merge was pushed under TASK-059 without redeploying; no native package or update manifest changed. See `docs/releases/2026-10-13-browser-precache-026.md`.
- **Native asset incident:** 0.2.6's hash-prefixed manifest URLs bypassed the installed clients' plain-path bundle indexes, prompting 2D fallback reports. At 20:13 +08 a maintainer-approved Nginx-only hotfix gives `SPClient/Android` and `SPClient/Windows` the original plain manifests while browsers retain the hashed Node views. Backup `/etc/nginx/snippets/stronghold-static.conf.pre-task041-20261013-201313`; `sp2` PID `1441657` did not change. One Windows client received both plain manifests; in-game acceptance is pending. See `docs/tasks/TASK-041-native-bundle-hash-hotfix.md`. Clients missing the separately distributed scene pack may still need that pack.
- **Windows transition motion:** The Windows client showed static plates while Android animated because its reduced-motion preference disabled the production CSS animations. At 20:27 +08 the maintainer approved and released a one-file `device.js` override scoped to `SPClient/Windows` for the existing unite, battle-end/perfect and round-start transitions. Backup `/opt/sp2/backups/windows-motion-20261013-202735/device.js`; `sp2` PID stayed `1441657`, packages and other clients were unchanged. Restart the Windows client to load the file; visual acceptance is pending. See `docs/tasks/TASK-042-windows-client-transition-motion.md`.
- **Chat and animations:** The single-file chat scroll fix was hot-deployed around 20:02 +08 without restart; backup `/opt/sp2/backups/chat-scroll-20261013-2002/roomChat.js`. Earlier animation hotfixes were present on disk but missed by already-open pages because the process-cached build tag did not change without a restart. The 0.2.6 restart refreshed the tag; fresh pages receive the 联防、完美作战 and 回合开始 code. Visual acceptance is the maintainer's; no project tests or screenshots were run.
- Public service: `sp2.service` on JING is active. It serves **both** `sp.bs.leio.fun` (production) and
  `sp2.bs.leio.fun` (preview) from one process on `127.0.0.1:3810` — nginx cut production over from the home server
  (WG `10.0.0.2:3800`) on 2026-10-09. The unit's name and its "0.2.1 staging line" description are stale labels.
- TASK-028/TASK-030 static hotfix went live on 2026-10-13: top-HUD proportions/rest tint/unite capsule alignment and the unite intro animation. Four CSS/JS files only, backup `/opt/sp2/backups/unite-hud-20261013-080054/old/`; post-deploy SHA256 matched and `sp2.service` kept PID `1093295`. The next video-based animation is not part of this release. See `docs/releases/2026-10-13-unite-hud-static.md`.
- Previous game/server application: `0.2.5`; its original `/healthz` build was `c13af814d77f` (server-only deploy 2026-10-13 01:52 +08 from
  `9497533d`; the client packages and the update manifest were `1.2.8` at that moment — the `1.2.9` incremental update
  was published the same night, see the TASK-025 bullet below).
- Client update manifest: Windows `1.2.9` (`versionCode` 12), Android `1.2.9` (`versionCode` 12) — signed
  `latest.json` / `latest.sig` published 2026-10-13 03:36 +08 (TASK-025).
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
- TASK-025 published the `1.2.8 → 1.2.9` incremental client update (2026-10-13 03:36 +08): the Windows installer
  `Stronghold-Protocol-Setup-1.2.9.exe` (584 961 214 B, `9510a7b2…`), the Android APK `Stronghold-Protocol-1.2.9.apk`
  (626 987 980 B, `8b84b683…`, `versionCode` 12, `apksigner` v2+v3 verified), the Windows patch
  `windows-1.2.8-to-1.2.9.zip` (2 134 089 B, `39644323…`, 6 changed files) and the APK patches
  `1.2.8-to-1.2.9.patch.gz` (3 861 651 B, `bd65c120…`, base = the published 1.2.8 APK `645de666…`) plus
  `1.2.8-local-to-1.2.9.patch.gz` (`720e6a6e…`, base = the locally built 1.2.8 APK `da98a468…`). Both clients now
  carry the rebuilt, re-armed asset bundle (new top-HUD art included). `latest.json` (`0eaef28a…`) is signed
  (`latest.sig` 512 B, `5e993d3d…`) and the signature verifies against the public keys embedded in **both** clients;
  every published hash was re-read from the server and matches. The previous manifest pair is backed up at
  `/root/sp2-backups/client-20261013-033604/`. Reaching `/client/` is deliberately restricted by nginx (2026-10-11):
  only `latest.json`, `latest.sig`, `*.patch.gz` and `windows-*.zip` are served (HTTP 200, `Cache-Control: no-store`);
  `/client/`, `/client/index.html` and every full installer return `410 Client downloads moved to the QQ group.` — so
  the in-client update path is live while the installers are distributed through the QQ group.
- The 0.2.5 battlefield scenes are deployed for browser clients (2026-10-13 04:08 +08, TASK-026):
  `public/assets/local/scene/**` (92 files, 61.44 MiB — eleven stages `act1autochess_m01`…`m07` and `act2autochess_m01`…`m04`
  plus the shared `tex/`, each stage being `scene.json` + `scene.bin` + `lm*.png/webp`) and `data/local-assets.json`
  (`82c322ca…`, 156 906 B, 1 532 entries with 57 `local/scene` refs, byte-identical to the served file). They had never
  landed because extracted local art is git-ignored and the official bundles of the finished season were pruned from the
  local client, so they were re-fetched from `ak.hycdn.cn` (version `26-04-13-12-31-42_e9b560`) and exported with the local
  official client as the dependency root. Nothing existing was overwritten (the only new files are the 92 under
  `local/scene`); the previous manifest is backed up at `/root/sp2-backups/local-assets-20261013-040810.json`. Native
  clients still need this pack inside their package/bundle before the scenes render offline.
- The scene pack is also packaged for out-of-band distribution (2026-10-13 04:25 +08, TASK-026):
  `dist/scene-patch/Stronghold-scenes-1.2.9.zip` is 17 497 681 B (16.69 MiB) sha256 `cb141645…`, carrying the 57
  manifest-referenced scene files plus the re-armed `bundle/index.json` (`03617f59…` → `594c45dc…`, 13 699 entries)
  and a self-contained installer (`apply-scenes-patch.ps1` / `.cmd`). It is NOT uploaded to the server — the maintainer
  posts it in the QQ group; applying it to an extracted real 1.2.9 install tree added 57 files / replaced 1 (exit 0),
  a second run is a no-op, and a 1.2.8 tree is refused with `当前版本与补丁不匹配`.
- TASK-027 static hotfix went live on JING at 2026-10-13 07:00 +08: reduced enemy stealth smoke, up to three tilted rising refraction hexagons, and a transparent funds badge background. Only `public/css/screens/game-shop.css`, `public/js/render/{app,units,statusAura}.js` changed; the existing production equipment-slot hotfix was preserved. Backup: `/opt/sp2/backups/status-vfx-shopbadge-20261013-90adad7a/`. `sp2` stayed active with the same PID, and native client versions and update manifests were untouched. Already-open clients need a manual refresh; `/healthz.build` stays cached until the next normal restart. Maintainer visual acceptance is pending.
- TASK-031 static hotfix went live on JING on 2026-10-13: the settlement panel now follows the supplied “作战结束／完美作战！” presentation, `ROUND_START` shows the observed funds delta when known, and the top cue transitions into the existing rest art. Eight files were replaced without restarting `sp2`; backup `/opt/sp2/backups/battle-end-round-20261013-122950/old/`, read-back hashes matched, `/healthz` returned 200, and PID `1131763` stayed unchanged. Native packages, CDN, server rules and version metadata were untouched. See `docs/releases/2026-10-13-battle-end-round-transition.md`.
- TASK-032 static hotfix went live on JING at 2026-10-13 12:50 +08: ordinary equipment slots are white, golden equipment slots are gold, and empty equipment slots are hidden. Only `public/js/render/app.js` and `public/js/render/units.js` were replaced; backup `/opt/sp2/backups/equipment-slot-rarity-a7b6df3b/old/`. Public HTTPS hashes matched commit `a7b6df3b`; `/healthz` returned 200 and PID `1131763` stayed unchanged while 6 matches remained active. See `docs/releases/2026-10-13-equipment-slot-rarity.md`.
- Browser gate: `SP_CLIENT_ONLY=0` is active since 19:55 +08; browser HTTP and WebSocket entry are open. The superseded 04:00 timer remains inactive. The notice and QQ-group invitation were preserved.
- Media caching: TASK-021's nginx immutable-cache headers are live. TASK-022's Node/nginx ETag alignment is committed
  locally but is **not deployed** because deployment restarts Node.
- Browser assets are served from the maintainer's CDN since 2026-10-13 08:18 +08 (TASK-029, deployed on the
  maintainer's 「上线」 order): `weishucdn.jiangjiangze.icu` carries **13 375** verified keys (852.5 MiB under
  `/assets/**`, voice included). Every key was re-downloaded and byte-compared — **13 375/13 375 identical, 0
  mismatches, 0 errors** — and the one key whose CDN bytes differ from ours
  (`assets/local/scene/act2autochess_m03/scene.json`, CDN 6 841 B ≠ local 6 815 B) is denylisted, as are 483 other
  keys (484 total). Installed in `/opt/sp2`: `server/http/assetCdn.js` `2e8e965b…`, `server/http/static.js`
  `37ea98d3…`, `data/cdn-assets.json` `45703789…`, `data/cdn-denylist.json` `397be18c…`, `data/cdn-config.json`
  `6d77af84…` (`enabled: true`); local and server hashes match, `sp2` restarted to build `6b2e9a8cfbb7` (backup
  `/root/sp2-backups/static-20261013-0830.js`). Because nginx owns `location ~* ^/assets/` (TASK-021), the switch
  needed an nginx layer too: `/etc/nginx/conf.d/sp-cdn-keys.conf` (13 375-key `map`, `map_hash_bucket_size 512`) plus
  `error_page 418 = @sp_cdn_asset` in that location, which `proxy_pass`es matching keys to Node so Node still owns the
  health probe and the local fallback (nginx snippet backed up at
  `/root/sp2-backups/stronghold-static-20261013-0820.conf`). Verified from outside: a listed asset answers
  `302 Location: https://weishucdn.jiangjiangze.icu/…` with `X-Asset-Source: cdn`, the denylisted key and every
  unlisted path stay local (`/index.html` 200), and a headless Edge run of the production scene page made **128 CDN
  responses with 0 failures** (`ready`, no JS errors). Rollback: `enabled: false` in `data/cdn-config.json` (≤30 s, no
  restart) and/or delete the nginx map + restore the snippet (`nginx -t && systemctl reload nginx`).
- These values were read directly from JING on 2026-10-12. Recheck before any release or incident conclusion.

## Repository truth

- Current source checkpoint: `F:\DSH-workspace\stronghold-026-integration` is detached and contains merge `cb18947a`, pushed to `origin/integrate-upstream-0.2.3` by TASK-059. The separately checked-out local branch in `F:\DSH-workspace\stronghold-base-0.2.1` remains at `ef35dfe9` with uncommitted edits; do not overwrite or fast-forward it until those edits are preserved. The pushed multiplayer/Boss source is pending validation, not a production release.
- Working repository: `F:\DSH-workspace\stronghold-base-0.2.1`.
- Current branch: `integrate-upstream-0.2.3` (historical branch name). Official v0.2.5 and the Paper-Yuan feature batch
  are committed in `9497533d` and pushed to the same origin branch. The previous checkpoint chain was included.
- Game source version: `0.2.5`; no merge into `master`. The public server was deployed to `0.2.5`
  on 2026-10-13 01:52 +08 (TASK-016, server-only, at the maintainer's explicit direction). TASK-025 then built both
  clients at `1.2.9` in the wrapper repository (`F:\DSH-workspace\stronghold-app`, branch `task-009-native-local-assets`)
  and published the incremental update to `/opt/sp2/public/client/` — the wrapper change is the six version literals
  plus the asset-index exclusion, not a game-source change.
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

- TASK-047 locally replaces only the mobile portrait prompt's PWA button with a fullscreen/landscape request and manual-rotation fallback; title/lobby PWA buttons remain. TASK-048 now locally replaces the old browser notice and ephemeral broadcast route with the 20-person fork's historical Markdown announcements, title/lobby entries and explicit urgent notices. The existing QQ/update copy was not migrated, so the archive is empty until publication. Neither task was tested, visually checked or deployed. Paper-Yuan `master` is older; its `0.2.6` branch was reviewed read-only at `d0d2023d` and was not merged.
- TASK-046 is a separate local review-ready edit: the co-op host can switch new spectator entry on/off, and running rooms no longer advertise “期望路人加入”. Existing spectators remain. No visual/play validation or deployment; see `docs/tasks/TASK-046-room-spectator-switch.md`.
- TASK-045/052 are locally integrated but unvalidated: the owner chose to keep this project's room-list lobby and room buttons, add a 6-person tier, assign AI strategies in a separate room-rules page and let up to five groups draft concurrently. The earlier branch preview remains at `http://127.0.0.1:3917/`; the local room-rules preview is at `http://127.0.0.1:3921/`, but was opened before the later gameplay edits. TASK-054's strategy-order scrolling is local-only. See their task files; nothing here is approved for release.

- TASK-044 is implemented locally in this 0.2.6 integration checkout: co-op spectator cap 2→4 and account avatar selection extended to base/E2/skin art with an initially empty, search-only picker. No agent-run tests or visual verification (maintainer instruction), no commit or deployment; existing native packages need an update to render new avatar variants. See `docs/tasks/TASK-044-spectator-avatar-options.md`.
- TASK-043: Browser transition motion is patched locally in `public/js/ui/device.js` so the three game transitions override host reduced-motion in browsers as they already do in Windows clients; Android-native and other motion remain unchanged. This is not deployed or visually accepted. The maintainer clarified that all eleven 0.2.5 official scenes appear missing in browsers (procedural 3D board instead). JING has their files and manifest entries; the production loader code matches the worktree, but the shared browser failure is not yet identified, so no scene code was changed. See `docs/tasks/TASK-043-browser-scene-and-transition.md`.
- TASK-030 unite-phase intro is `released` as a static hotfix at the maintainer's direct request. The UNITE mock replay button remains local-only; production still respects reduced-motion. Maintainer visual feedback may require follow-up; the next video animation is separate.
- TASK-032 equipment-slot rarity fix is `released` as a static hotfix; maintainer visual confirmation is pending after refresh.
- TASK-029 browser CDN foundation is planned for DeepSeekharness in an isolated worktree. The two supplied ZIPs do not enable CDN routing or WS compression; no CDN upload, server switch, browser reopening or deployment has happened in this task.
- TASK-028 top-HUD proportions/rest tint and unite capsule alignment are `released` as the same static hotfix. Maintainer visual feedback remains open; no agent-run gameplay tests or screenshots.
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

Ask the maintainer to reload only after leaving a match, then check browser-lobby pre-cache, the three transition
animations and chat scroll. The original `1.2.9` native client update and scene patch remain unchanged. A static-only
hotfix does not change the process-cached build tag, so old pages need a manual reload. Reconcile, review, commit and
push the isolated 0.2.6 merge separately; do not mistake the deployed runtime archive for a source commit.

## Stop conditions

- Do not build or publish a client until the active feature tasks and release gates are accepted.
- Do not overwrite the custom room directory, accounts/passwords, records/cards or custom combat HUD.
- Do not deploy merely because implementation tests pass; follow the release task and verify production backups.
