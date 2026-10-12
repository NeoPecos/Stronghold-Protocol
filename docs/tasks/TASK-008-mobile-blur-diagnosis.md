# TASK-008 — Mobile adaptation and blur: diagnosis before change

Status: `in_progress` (device measurements pending from the maintainer)

Lead: Codex

Implementer: DeepSeek

Starting commit: `fee08aff`

## Goal

Produce a root-cause report for the phone-side adaptation and blur complaints, with a fix plan, before any CSS, asset
or image-quality parameter is touched. A report that cannot name the cause must say so rather than propose a change.

## Scope

Diagnose each of these separately and report what was actually observed, not what is assumed:

1. `visualViewport` — reported height vs `innerHeight` vs the CSS viewport, and how the app consumes it
   (`--sp-vh` in `public/js/ui/device.js:213`).
2. Safe-area insets — resolved values of `--sa-t/r/b/l` and which screens inset themselves
   (`css/devices.css:34`, the `.screen:not(.gm):not(.title-screen)` rule).
3. Usable landscape height — what is left after the safe area and any host chrome on the short phones
   (568×320, 640×360, 756×366, 812×375).
4. Device pixel ratio — `devicePixelRatio` vs the resolution mode in use.
5. Canvas internal resolution — the actual `canvas.width/height` (backing store) against its CSS size, and the
   pixel-ratio cap from `canvasPixelRatio()` (`public/js/ui/gameLogic/settings.js:42`) and the 3D board's own cap
   (`boardPixelRatioCap`).
6. CSS transform scaling — any `transform: scale()` between a canvas/sprite and the screen (the rem scale in
   `css/theme.css`, HUD scaling in `css/devices.css`).
7. Rotation / restore rebuild — what runs on `orientationchange`, `screen.orientation.change`, `resize`,
   `visualViewport.resize` (`public/js/ui/device.js:222`) and on a bfcache restore (`pageshow`, `public/js/main.js:377`).

For the assets, separately record and then reconcile:

- **Local client art** — `data/local-assets.json` read through `assets.localUrl()` (`public/js/assets.js:743`, `:914`).
- **Server / mirror art** — `data/assets.json` read through `data.assetUrls` and `artUrls` (`public/js/data.js:451`).
- **WebP mapping** — which manifest lists `.webp`, and whether the client can ever receive one.

For one and the same asset, record: raw file size, the actual request URL, the decoded dimensions
(`naturalWidth/Height`), the CSS display size, and the canvas/backing-store render size. Prove whether PNG→WebP
affects the client **before** changing anything.

## Protected areas

- No CSS change, no asset change, no re-extraction, no regeneration, no image-quality parameter change in this task.
  The WebP quality (95) and the losslessness of normal/data maps are fixed until a cause is proven.
- Do not touch `tools/fetch-assets.mjs`, `tools/assets/plan.mjs`, `tools/local-extract/extract.py` or `data/*.json`.
- Do not change `data/local-assets.json` or `data/assets.json` by hand; they are generated.
- Do not touch the custom combat HUD, the placement protocol or `server/sim/`.
- No deployment, no push to production, no client build, and no change to `latest.json`.

## Acceptance checks

- A report at `docs/analysis/` (name it there, e.g. `mobile-blur-diagnosis.md`) that lists, per probe area, the
  measured values and the command or harness that produced them.
- The asset section explicitly states, with evidence, whether a native client can receive a `.webp` URL, and how each
  of the three art sources resolves for the same asset.
- A root cause is either named with evidence or explicitly recorded as not reproduced, with the measurements that
  failed to reproduce it.
- A fix plan that separates "proven cause" from "would need another measurement", and that marks any unproven item
  `[ASSUMED]`.
- No file outside the report and the task/ops documentation is modified by this task
  (`git status` proves it).

## Starting reconnaissance (measured on 2026-10-12, this checkout)

- `public/js/ui/device.js` already tracks the real visible height: `--sp-vh` = `visualViewport.height || innerHeight`
  / 100, refreshed on `resize` and `visualViewport.resize`, and re-applied 350 ms after a rotation. So a wrong
  `100vh` is not automatically the explanation; the measurement must show which value each consumer uses.
- Resolution is a client display option with an explicit cap: `resolutionCap()` and
  `canvasPixelRatio() = max(0.75, min(deviceRatio, cap, sqrt(pixelBudget / area)))` — i.e. the backing store can be
  deliberately below `devicePixelRatio`, which is a **candidate** blur cause to measure, not a conclusion.
- The 3D board keeps a lower cap than the sprites (`boardPixelRatioCap`: 1.25 on the mid tiers), so board blur and
  sprite blur may have different causes and must be measured separately.
- Local extraction exists on this machine: `data/local-assets.json` has 1475 entries — **1448 `.png`, 15 `.obj`,
  10 `.json`, 1 `.atlas`, 1 `.skel`, and zero `.webp`**. So on this checkout no local-client asset resolves to a WebP
  URL.
- `public/js/assets.js:743` fetches `/data/local-assets.json`; `assets.localUrl(group, name)` returns a path from that
  manifest. `public/js/render/board3d/load.js:10` states board URLs come from `data/local-assets.json` only and that
  nothing is guessed — so the board pack follows the local manifest, not `data/assets.json`.
- `docs/ASSETS.md:209` records the intended split: images stay PNG; WebP conversion is not done for the mirror, and the
  board textures are the exception — `tools/local-extract/extract.py` writes WebP copies of the 12 board textures the
  3D board downloads, and `data/local-assets.json` lists those copies. **That means a client on a machine extracted
  with `--webp` would be served the WebP copies, while this checkout's extraction has none.** Whether that changes what
  the client renders is exactly what must be proven.
- Safe-area handling depends on `env(safe-area-inset-*)`, which is `0px` unless the page declares
  `viewport-fit=cover` — `public/index.html:7` does declare it. A wrapper that reports no insets therefore yields
  zeros, which is a plausible "why did the inset do nothing" cause to confirm on a device.

## Current checkpoint

### 2026-10-12 19:00 — root cause found and reported

- The maintainer ran the probe on the phone and sent the output. **Cause identified and reproduced offline:**
  the field canvas renders at 2 device pixels per CSS pixel on a dpr-3 screen (`back=770×640` for a 385×320 CSS box),
  so the browser upscales it 1.5×. 1:1 would be 1155×960.
- Mechanism: `render/app.js:194` caps the pixel ratio with `QUALITY_RES[settings.quality]` (`host.js:82`:
  `high: 2`), and the default quality is `high`. The 3.7 M pixel budget is **not** involved at this size (it only
  begins to bind above 9610 px of height at this width). Reproduced with the project's own `canvasPixelRatio` for
  every quality and 分辨率 mode.
- **No setting can fix it**: `RES_CAP` (`settings.js:29`) tops out at 2 (`1440p: 2, native: 2`), so a 3× phone has no
  path to a native-resolution canvas — "native" stops at 2×.
- Secondary, independent finding: `public/assets/ui/hudPanel/icon_hp.png` is **12×19** but drawn at 17×17 CSS
  (≈51 device px at dpr 3) and has no `@2x`/`@3x` variant. The other sampled images (31×37, ~100×100, 35×35) are all
  drawn *down* and are fine.
- Report: `docs/analysis/mobile-blur-root-cause.md`, including the fix plan and an explicit "what this does NOT
  establish" section.
- **Still unmeasured**: the native client's own WebView viewport (`dpr`/size may differ from the browser's), and the
  screenshot set that would split perceived blur between the field canvas and the HUD glyphs. `safeArea` read `0px`
  everywhere in the browser, which is expected there and says nothing about the wrapper.
- **No CSS, asset or image-quality parameter has been changed** — the report is the deliverable, and the fix needs a
  task of its own plus a perf check on a real device.
- Next: maintainer decision on the fix plan (raise the cap so `native` reaches `devicePixelRatio`, and whether the
  default quality should change); optional client-side measurement via Method B; address `icon_hp.png` separately.

## Handoff — what the maintainer does

Method A is done (data received). Remaining, both optional but they close the two gaps above:

1. If the blur is also visible **in the app**, measure it there (Method B: remote debugging into the client WebView).
   If the wrapper does not expose debugging, say so and it is recorded as "client viewport unmeasured".
2. The four screenshots (whole frame / with 设置 open / after rotating / in-app if applicable) — they decide how much
   of the complaint is the field canvas versus the HUD glyphs.

## Rollback

Nothing to roll back: this task is read-only apart from the report and the task/ops documentation. If a later task
acts on the findings, that task carries its own rollback.

## Verification commands

```bash
git status --porcelain            # must show only the report + docs, no runtime file
node --test test/docs-consistency.test.js test/docs-paths.test.js
```
