# TASK-008 — Mobile adaptation and blur: diagnosis before change

Status: `accepted` (browser blur contributor proven; native-client root cause explicitly remains unproven)

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

**Approved scope exception (Codex review, 2026-10-12):** `public/dev/mobile-probe.html` is the diagnostic harness.
It is the one allowed non-documentation file this task may modify, it is read-only with respect to the game (it
measures and displays; it changes no CSS, asset or setting and sends nothing), and it must stay out of release
artifacts. Checked: `tools/package.mjs` excludes `public/dev/`, and `test/package.test.js` asserts no packed path
matches `/^(?:test|handoff|\.github|types|public\/dev|docs\/img|docs\/design|docs\/history)\//`.

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

### 2026-10-12 — accepted as diagnosis; implementation split to TASK-023

Codex accepts the measured browser diagnosis and its explicit limits. Native WebView DPR and real usable landscape
height remain unmeasured and must not be represented as proven. They no longer block the separate, guarded
implementation of truthful `native` resolution under the existing pixel budgets.

### 2026-10-12 — blocked on device-only evidence

The browser-side contributor is proven, but the task's own native-client and real usable-landscape-height acceptance
evidence cannot be produced from this workstation. The report remains useful but is not accepted as a native-client
root-cause conclusion. TASK-008 is blocked until those measurements are available; this frees unrelated, non-overlap
UI work without authorising TASK-009 or any DPR/rendering change.

### 2026-10-12 20:10 — Codex review round 1 addressed (task stays `in_progress`)

All six points of the Codex review are now handled. The verdict is narrowed, the arithmetic is corrected, and three of
the originally missing probe areas are now measured rather than described.

**1. Arithmetic corrected.** The earlier "9610 px" was `3_700_000 / width`, which forgets the budget constrains
`ratio²·area`. Correct thresholds at width 385: ratio 1 → 9610, ratio 1.5 → 4271, **ratio 2 → 2403**, ratio 3 → 1068.
`3_700_000 / (385 × 2²) = 2403` — Codex's figure confirmed. The 385×320 result is unaffected (it is cap-bound, not
budget-bound). A binding-term table now shows **phones/tablets are cap-bound and desktops are budget-bound**.

**2. Verdict narrowed.** The report now says: *proven* that the browser field canvas renders at ratio 2 on a dpr-3
screen and is enlarged 1.5× — a definite blur contributor; *not proven* that this is the native client's root cause.
TASK-008 remains `in_progress` for that reason.

**3. Probe areas completed or explicitly marked.** Measured in a local reproduction run (headless Chrome, viewport
385×320, dpr 3, mobile UA — it reproduced the maintainer's canvas numbers exactly, `ratio 0.667`):
  - area 1 `visualViewport`: `--sp-vh` = 3.2px = 320/100, i.e. it reads the real visible height (`device.js:241-243`)
    — **not** a wrong `100vh`. No defect.
  - area 5 board vs field: **identical at phone sizes** (both cap-bound at 2.000); they diverge only on large
    surfaces where the board's lower 2.1 M budget binds (1024×768 → 1.634).
  - area 6 `transform`: `none` on both canvases; `imageRendering: auto`. Ruled out.
  - area 7 rotation/restore: both canvases rebuild for the new viewport within **700 ms**, settle, and rotate back
    correctly; the ratio stays 0.667 throughout, so rotation does not add blur. Path is `ResizeObserver` →
    `resize()` → `renderer.resolution` + `renderer.resize` (`app.js:1763-1769`, `:1776-1779`).
  - **Still open:** area 3 usable landscape height (the probe's fixed 320 px stage masked it — needs a real
    full-height run) and the native client's own dpr/viewport (Method B).
  - **Stated limitation:** a headless viewport change fires `resize` and `visualViewport.resize` but not
    `orientationchange`, so run B proves the resize path; the `orientationchange` branch is read, not exercised.

**4. Asset three-source comparison completed.** For `hudPanel/icon_hp` (and `icon_battle`, `bond/preciShip`,
`modeIcon/mode_hard_icon`) the report now records: resolved by `Sprite` → `uiUrl(data.get('assets'), k)`
(`gameComponents.js:73`), requested at `/assets/ui/hudPanel/icon_hp.png`, **absent from
`data/local-assets.json`, present in `data/assets.json`**. Counts: mirror = 3782 images, **all `.png`, zero
`.webp`**; local manifest = 1475 entries, zero `.webp`. **Answer to the acceptance question: no, a client cannot
receive a `.webp` URL from this checkout's data** — WebP exists only as the 12 board textures written by
`tools/local-extract/extract.py` and recorded in `data/local-assets.json`.

**5. `[ASSUMED]` markers added** to fix-plan items 2, 4 and 5 (perf cost of raising the default cap; existence of a
larger `icon_hp` source; that ≈1.0 ratio removes the *perceived* blur).

**6. Probe retention recorded** in the acceptance checks above, with the packaging exclusion check.

**Probe improved (the one approved non-doc file).** `public/dev/mobile-probe.html` gained a ④ rotation test (samples
the game frame at 0/700/1400/2500/4000 ms across an orientation change and reports a rotation table), a usable-height
line, and a `digest()` summary. Verified by driving it in real Chrome: buttons render ①–⑤, it loads `/` (title
screen, correctly has no canvas) then the COMBAT mock, and ④ refuses cleanly with no iframe loaded. The harness that
drives it (`.local/probe-run.mjs`) is gitignored and not part of the deliverable.

**Files changed by this task so far:** `docs/analysis/mobile-blur-root-cause.md`,
`docs/analysis/mobile-probe-instructions.md`, `docs/tasks/TASK-008-mobile-blur-diagnosis.md`, `docs/ops/2026-10.md`,
`public/dev/mobile-probe.html`. **No CSS, asset, `data/*.json` or image-quality parameter changed.**

**Next:** Codex re-review. If the native-client question must be closed first, run Method B (or record it as
"client viewport unmeasured"); fixing the cap needs its own authorised task, and `icon_hp.png` is independent.

### 2026-10-12 19:00 — root cause found and reported

- The maintainer ran the probe on the phone and sent the output. **Cause identified and reproduced offline:**
  the field canvas renders at 2 device pixels per CSS pixel on a dpr-3 screen (`back=770×640` for a 385×320 CSS box),
  so the browser upscales it 1.5×. 1:1 would be 1155×960.
- Mechanism: `render/app.js:194` caps the pixel ratio with `QUALITY_RES[settings.quality]` (`host.js:82`:
  `high: 2`), and the default quality is `high`. The 3.7 M pixel budget is **not** involved at this size — it only
  begins to beat a cap of 2 above ≈2403 px of height at 385 px wide (the 9610 px first written here was wrong: it
  divided by the ratio instead of its square; corrected in the 20:10 checkpoint). Reproduced with the project's own
  `canvasPixelRatio` for every quality and 分辨率 mode.
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

## Review notes

### 2026-10-12 — Codex final review: accepted as a bounded diagnosis

The report satisfies this task's diagnosis goal: it proves that a DPR-3 phone browser renders both game canvases at
ratio 2 and upscales them 1.5×, rules out WebP as the cause in the measured checkout, separates the undersized HP icon,
and records the native WebView and real usable-height branches as unmeasured. Acceptance does **not** upgrade those
unmeasured branches into conclusions about every native device.

Implementation moves to TASK-023. That task must preserve the existing pixel budgets, keep the 3D board cap separate,
make `native` resolution truthful, and obtain before/after evidence on a physical Android device before release. UI
fit and safe-area restructuring are not silently bundled into the rendering-resolution change.

### 2026-10-12 — Codex review: changes required, task remains `in_progress`

The browser measurement is useful and proves that the measured field canvas is rendered at pixel ratio 2 on a DPR-3
screen, then enlarged by the browser. It does **not yet prove that this is the root cause of the reported native-client
blur**, because the report explicitly says the native WebView was not measured and no before/after visual check tied
the user's exact symptom to the ratio change.

Required before `review_ready`:

1. Correct the pixel-budget arithmetic in the report. At width 385, the 3.7 M budget begins to beat a cap of 2 when
   height exceeds about `3,700,000 / (385 * 2^2) = 2,403`, not 9,610. It begins to beat DPR 3 at about 1,068. This
   does not change the measured 385×320 result, but the current explanation is numerically wrong.
2. Narrow the verdict to the proven statement: browser field-canvas under-resolution is a confirmed blur contributor.
   Do not call it the native client's root cause until Method B measures the client WebView, or explicitly close that
   branch as “not reproduced / unavailable” with the attempted method and evidence.
3. Complete or explicitly mark unmeasured every original probe area: `visualViewport` vs `innerHeight` vs document
   height, usable landscape height, rotation/restore rebuild, board and field canvases separately, and the same-asset
   source-resolution table. The report currently omits those values even though the probe can collect several of them.
4. Complete the asset acceptance check: for one asset key, record local-client, server/mirror and WebP resolution,
   actual URL, raw size, decoded size and display size. State with evidence whether the native client can receive a
   WebP URL. The sampled HUD files do not satisfy this three-source comparison.
5. Mark unproven fix-plan statements `[ASSUMED]`, especially performance/default-quality consequences until a native
   device measurement exists.
6. Scope exception: `public/dev/mobile-probe.html` is a useful red-capable diagnostic harness and is excluded from
   release packaging, so the lead approves retaining it. Update the task acceptance wording to name this one allowed
   non-documentation file and record a check proving it stays out of release artifacts.

No rendering, CSS, asset or quality fix is authorised yet. TASK-009 remains blocked on an accepted TASK-008 report.

## Rollback

Nothing to roll back: this task is read-only apart from the report and the task/ops documentation. If a later task
acts on the findings, that task carries its own rollback.

## Verification commands

```bash
git status --porcelain            # must show only the report + docs, no runtime file
node --test test/docs-consistency.test.js test/docs-paths.test.js
```
