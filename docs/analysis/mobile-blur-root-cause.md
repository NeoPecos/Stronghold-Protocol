# Mobile blur — root cause report (TASK-008)

Measured: 2026-10-12. Run A on the maintainer's phone (dpr 3) and run B reproduced in this checkout's headless
Chrome at the same numbers — both through `public/dev/mobile-probe.html`, which renders the real app in an iframe and
reads the frame's live geometry from inside. TASK-008 finding only: **no CSS, asset or image-quality parameter was
changed to produce this.**

## Verdict

**Proven: in the phone's browser the game's canvases are drawn at 2 device pixels per CSS pixel on a 3-pixel-per-CSS-pixel
screen, so the browser upscales them by 1.5×. That is a definite blur contributor, and it is not an asset or WebP
problem.**

**Not proven: that this is *the* root cause of the blur reported in the native clients.** They were not measured (see
"What this report does NOT establish"), so if the app renders at a different pixel ratio or viewport the picture there
may differ. TASK-008 stays `in_progress` until the client is measured or that branch is closed as unavailable.

| | |
|---|---|
| Device | dpr **3**, screen 407×904, `portrait-primary` |
| Game viewport (in the probe's frame) | CSS 384×320, host 385×320 |
| Canvas backing store | **770×640** |
| Backing ÷ (CSS × dpr) | **0.667** ← upscaled |
| What 1:1 would need | **1155×960** |
| Missing | **1.5× in each axis** |

## Measured values per probe area

Two runs, both through `public/dev/mobile-probe.html` (read-only; it renders the real app in an iframe and reads the
frame's live geometry from inside):

- **A — the maintainer's phone** (the authoritative one): the values quoted as "phone".
- **B — this checkout in headless Chrome, same numbers emulated** (viewport 385×320, dpr 3, mobile UA): a
  reproduction used to fill the areas the maintainer's single screenshot could not cover. It reproduced the
  maintainer's canvas measurement exactly: `back=726,640 css=363,320 dpr=3 → ratio 0.667` vs the phone's
  `back=770,640 css=385,320 dpr=3 → ratio 0.667`. (The 363 vs 385 px width is the probe page's own stage margin in
  run B; the *ratio* is the quantity under test and it matches to the digit.)

| # | Probe area | Phone (A) | Checkout reproduction (B) | Reading |
|---|---|---|---|---|
| 1 | `visualViewport` vs `innerHeight` vs CSS viewport | probe page: inner 410×732, visualViewport 407×725; game iframe inner/doc 384×320 | page: inner 389×324, visualViewport 385×320; iframe inner/doc 363×320, visualViewport 363×320, `scale 1` | **`--sp-vh` is right**: it reads `visualViewport.height` (`public/js/ui/device.js:241-243`), and the measured value `3.2px` = 320/100 — the game frame's real visible height, not a wrong `100vh`. No mismatch to fix here. |
| 2 | Safe-area insets | all `-`/`0px` | all `0px` | expected in a browser (no cutout reported to the page); says nothing about the native wrapper. |
| 3 | Usable landscape height | not measured | iframe doc height **320** in both orientations (the probe's stage is a fixed 320 px box, so the *game* height did not change) | **still open on a real device** — the probe's fixed stage masks this. Needs a real full-height run. |
| 4 | `devicePixelRatio` | **3** | **3** | matches. |
| 5 | Canvas internal resolution | field **770×640** on 385×320 → ratio 2.000 | field **726×640** on 363×320 → ratio 2.000; **both canvases identical** (board and field) | the ratio is 2 in both, i.e. the cap — see below. |
| 6 | CSS `transform` scaling | not reported | `transform: none`, `imageRendering: auto` on both canvases | **no transform scaling**; the blur is not a CSS `scale()`. |
| 7 | Rotation / restore rebuild | not measured | see the next section | **rebuild works and settles.** |

**Area 5 in detail — the board and the field behave identically at phone size.** `boardDpr()`
(`public/js/render/app.js:195`) uses a separate, lower budget (2.1 M) and `BOARD_RES` (`host.js:85`), so board and
field *can* diverge — but only on large surfaces, where the budget binds. At phone sizes the cap binds for both, so
both render at ratio 2:

| Viewport | field (3.7 M budget) | board (2.1 M budget) | board's binding term |
|---|---|---|---|
| 384×320 | 2.000 → 768×640 | 2.000 → 768×640 | cap |
| 780×360 | 2.000 → 1560×720 | 2.000 → 1560×720 | cap |
| 844×390 | 2.000 → 1688×780 | 2.000 → 1688×780 | cap |
| 1024×768 | 2.000 → 2048×1536 | 1.634 → 1673×1255 | budget |
| 1366×768 | 1.878 → 2565×1442 | 1.415 → 1933×1087 | budget |

So on the phone the board and the field are blurred by the *same* mechanism, and "board blur" and "sprite blur" do not
need separate explanations at this size.

**Area 7 in detail — rotation / restore rebuild (run B).** The probe's ④ samples the game frame before, during and
after a viewport change:

| Sample | Game frame inner/doc | Canvas backing | Ratio |
|---|---|---|---|
| `t0-before` (385×320) | 363×320 | 726×640 | 0.667 |
| `event resize`, `event visualViewport.resize` | 758×320 | *(no canvas yet — mid-rebuild)* | — |
| `t700ms` | 758×320 | **1516×640** | 0.667 |
| `t1400ms` | 758×320 | 1516×640 | 0.667 |
| `t2500ms` | 758×320 | 1516×640 | 0.667 |
| `t4000ms` | 758×320 | 1516×640 | 0.667 |
| rotate back → re-measure | 363×320 | **726×640** | 0.667 |

**The rebuild is not broken**: both canvases were re-sized for the new viewport within **700 ms**, they did not
oscillate afterwards, and rotating back restored the original size. The mechanism is `ResizeObserver` on the host
(`public/js/render/app.js:1776-1779`) calling `resize()`, which recomputes `dpr()` and sets
`app.renderer.resolution` before `app.renderer.resize(...)` (`app.js:1763-1769`). `installDeviceSupport` also
re-applies `--sp-vh` 350 ms after `orientationchange` and dispatches a synthetic `resize` (`device.js:249-257`).

**The ratio stays 0.667 across every rotation** — the rebuild preserves the same cap, so rotating does not blur the
picture further; it stays exactly as under-resolved as before.

*Run B's limitation, stated so it is not over-read:* a headless viewport change fires `resize` and
`visualViewport.resize` but **not** `orientationchange` (the probe still reported `portrait-primary`), and the probe's
fixed 320 px stage held the game frame's height constant so `--sp-vh` correctly did not change. Run B therefore proves
the **resize** rebuild path; the `orientationchange` path is read, not exercised, and area 3 remains unmeasured on a
real device.

## The mechanism

`public/js/render/app.js:194`:

```js
const dpr = () => { const s = size(); return canvasPixelRatio(s.width, s.height, globalThis.devicePixelRatio,
  resolutionCap(settings.resolution) ?? (QUALITY_RES[settings.quality] || 2), 3_700_000); };
```

`canvasPixelRatio` (`public/js/ui/gameLogic/settings.js:42`) returns
`max(0.75, min(deviceRatio, cap, sqrt(pixelBudget / area)))`. With `settings.resolution === 'auto'` the cap comes from
`QUALITY_RES` (`public/js/render/app/host.js:82`):

```js
const QUALITY_RES = { high: 2, medium: 1.5, low: 1 };
const BOARD_RES  = { high: 2, medium: 1.25, low: 1 };
```

The default quality is `high` (`DEFAULT_SETTINGS`, `settings.js:57`), so the cap is **2**, `deviceRatio` is 3, and the
result is 2. Reproduced with the project's own function (no browser needed):

| Configuration | ratio | backing on 385×320 |
|---|---|---|
| `quality=high` (cap 2) — **what ran** | 2.000 | **770×640** |
| `quality=medium` (cap 1.5) | 1.500 | 578×480 |
| `quality=low` (cap 1) | 1.000 | 385×320 |
| `resolution=native` (cap 2) | 2.000 | 770×640 |
| `resolution=1080p` (cap 1.5) | 1.500 | 578×480 |
| no cap (device 3) | 3.000 | 1155×960 |

**Where the pixel budget actually binds** (dpr-3 device, sprite canvas, `quality=high`): the budget term is
`sqrt(3_700_000 / (w·h))`, so it only overtakes the cap of 2 once the CSS area exceeds about 925,000 px. At 385 px
wide that is a height of about **2403 px** — not the 9610 px an earlier revision of this report claimed (that figure
was `3_700_000 / width`, which forgets that the budget constrains `ratio²·area`). The corrected thresholds for the
record: ratio 1 → 9610 px, ratio 1.5 → 4271 px, **ratio 2 → 2403 px**, ratio 3 → 1068 px.

Because the real phone viewports are far below 2403 px tall, **the cap is the binding term on phones and tablets, and
the budget becomes the binding term on desktop-size surfaces**:

| Viewport | cap | resulting ratio | backing | binding term |
|---|---|---|---|---|
| phone portrait 384×320 | 2 | 2.000 | 768×640 | **cap** |
| phone landscape 780×360 | 2 | 2.000 | 1560×720 | **cap** |
| phone landscape 844×390 | 2 | 2.000 | 1688×780 | **cap** |
| tablet 1024×768 | 2 | 2.000 | 2048×1536 | **cap** |
| desktop 1366×768 | 2 | 1.878 | 2565×1442 | budget |
| desktop 1920×1080 | 2 | 1.336 | 2565×1443 | budget |
| fullscreen 2560×1440 | 2 | 1.002 | 2565×1443 | budget |

This matters for the fix: raising the ceiling for a 3× phone costs little, because the budget still has headroom at
phone sizes (768×640 is 0.49 M device pixels against a 3.7 M budget). The budget is doing its intended job on large
surfaces and must stay.

## Why the user cannot fix it from 设置

`RESOLUTION_MODES` offers `auto / 720p / 1080p / 1440p / native`, and `RES_CAP` maps them to
`{720p: 1, 1080p: 1.5, 1440p: 2, native: 2}` (`settings.js:29`). **The maximum any setting can reach is 2**, so a
3× phone has *no* path to a native-resolution canvas — "native" is a misnomer for this device: it stops at 2×.

## Secondary finding — undersized HUD art (independent of the above)

From the same measurement, several images are drawn larger than their source:

| Asset | natural | CSS box | Note |
|---|---|---|---|
| `/assets/ui/hudPanel/icon_hp.png` | **12×19** | 17×17 | source is **smaller than the CSS box**; at dpr 3 it is stretched to ~51 device px wide. No `@2x`/`@3x` variant exists in `public/assets/ui/hudPanel/`. |
| `/assets/ui/hudPanel/icon_battle.png` | 31×37 | 14×14 | drawn *down*, fine |
| `/assets/bond/*Ship.png` | ~100×100 | 14×14 | drawn *down*, fine |
| `/assets/ui/modeIcon/mode_hard_icon.png` | 35×35 | 7×7 | drawn *down*, fine |

Only `icon_hp.png` is upscaled. It is a real blur source for that one glyph, it is **not** the field blur, and it is a
different kind of fix (a larger source, not a pixel-ratio change).

## Asset provenance — the three sources, and why WebP is not involved

The same picture can reach a browser from three different places. Checked in this checkout:

| Source | Manifest | Images | WebP |
|---|---|---|---|
| Local client extraction (`public/assets/`, DESIGN §13) | `data/local-assets.json` — 1475 entries | 1448 `.png`, plus 15 `.obj`, 10 `.json`, 1 `.atlas`, 1 `.skel` | **0** |
| Server mirror | `data/assets.json` — 12 834 file-like entries | **3782 images, all `.png`** | **0** |
| WebP copies | written only by `tools/local-extract/extract.py` | 12 board textures recorded back into `data/local-assets.json` | 12 |

Which one a given pixel comes from:

| Sampled asset | Resolved by | Path actually requested | In `local-assets.json`? | In `assets.json`? |
|---|---|---|---|---|
| `ui/hudPanel/icon_hp.png` | `Sprite` → `uiUrl(data.get('assets'), k)` (`gameComponents.js:73`) | `/assets/ui/hudPanel/icon_hp.png` | **no** | yes |
| `ui/hudPanel/icon_battle.png` | same | `/assets/ui/hudPanel/icon_battle.png` | **no** | yes |
| `bond/preciShip.png` | same | `/assets/bond/preciShip.png` | **no** | yes |
| `ui/modeIcon/mode_hard_icon.png` | same | `/assets/ui/modeIcon/mode_hard_icon.png` | **no** | yes |

So the four undersized images above come from the **server mirror**, and the mirror contains **no WebP at all** —
`data/assets.json` lists 3782 images, every one a `.png`, and zero `.webp` (non-image types are only
`skel/atlas/mp3/css/otf/woff2/ttf`).

**Therefore: a PNG→WebP conversion cannot be affecting these clients today.** Not because it was rejected, but
because it is not in the data the client is served. `docs/ASSETS.md:209` records the same policy: the mirror does not
do WebP, and the only WebP in the project comes from the 12 board textures written by the local extraction step.
**No image quality parameter was changed by this investigation**, as TASK-008 requires.

## What this report does NOT establish

Codex review (2026-10-12) held TASK-008 at `in_progress` because this list was incomplete. Current state: three of the
six gaps are now closed by measurement, three remain open.

**Closed since the review:**

- ~~No CSS `transform` scaling~~ — measured: `transform: none`, `imageRendering: auto` on both canvases. Not a cause.
- ~~Rotate-and-restore rebuild unverified~~ — measured in run B: both canvases rebuild within 700 ms and settle; the
  ratio is unchanged by rotation (see area 7). The `orientationchange` branch specifically is still read-not-exercised
  (a headless viewport change does not fire it) — the **resize** path is proven.
- ~~Board vs field canvases not separated~~ — measured: identical at phone sizes, diverging only on large surfaces
  (see area 5).

**Still open:**

- **The native clients were not measured.** The probe ran in the phone's browser. The app's WebView viewport and its
  `devicePixelRatio` are unverified; if the app reports a different dpr or size the numbers above change. TASK-008's
  Method B (remote debugging into the client WebView) is still open. **This is the reason the verdict above is narrowed.**
- **Usable landscape height was not measured on the device that reports the blur.** The probe's stage is a fixed 320 px
  box, so it held the game frame's height constant in both orientations and masked this. Needs a real full-height run.
- The screenshot set (whole frame vs board only vs HUD text only) was not supplied, so this report cannot say how much
  of the perceived blur is the field canvas versus the HUD glyphs. The canvas numbers are unambiguous; the *perceived*
  split is not.
- `safeArea` resolved to `0px` on all four sides **in the browser on that phone**, which is expected for a browser
  (no display cutout reported to the page) and says nothing about the wrapper.

## Fix plan (not started — needs a task and review)

Per TASK-008's acceptance check, every claim below that no measurement supports is marked `[ASSUMED]`. Nothing here is
authorised by TASK-008, which is diagnosis only.

1. **Let the resolution cap reach the device ratio.** Either raise the ceilings (`RES_CAP`, `QUALITY_RES`/`BOARD_RES`)
   so a 3× phone can reach 3, or make `native` mean `devicePixelRatio` instead of the constant 2. Keep the pixel
   budget as the bound — it is what actually protects fill-rate, and it already exists. On phones the budget does not
   bind (768×640 = 0.49 M device pixels against 3.7 M), so this is affordable *at phone sizes by the arithmetic*.
2. **Decide deliberately whether the default should change.** Raising `QUALITY_RES.high` from 2 to 3 changes rendering
   cost for every phone on default settings. **`[ASSUMED]` that this is affordable**: the budget bounds the pixel
   count, but the *per-frame* cost on a real 3× phone (fill rate, GPU memory, battery) has not been measured.
   This must be a perf check on a real device, not a guess, and the fix should not land on a default until it is.
3. **Keep the board's own lower cap separate** (`boardResolutionCap`: 1.25 on the mid tiers). The 3D board is
   fill-bound; raising the sprite cap must not silently raise the board's.
4. **`icon_hp.png`**: give it a source at least 3× its CSS box, or draw it from the atlas. Independent of 1–3.
   `[ASSUMED]` that a larger source exists upstream — `data/assets.json` lists only the current 12×19 file.
5. **Re-measure after the fix** with the same probe and require `后备/CSS·dpr ≈ 1.0` on the target device.
   `[ASSUMED]` that ≈1.0 removes the *perceived* blur: no before/after visual comparison has been made yet.

## Reproduce

```powershell
node server/index.js
# phone, same Wi-Fi:  http://<pc-lan-ip>:3000/dev/mobile-probe.html
#  ① 载入游戏  ② 载入对局页（COMBAT）  ③ 测量  ④ 旋转测试（可选）  ⑤ 复制结果
```

Run B (this checkout, headless Chrome at the same numbers) is reproducible too: `.local/probe-run.mjs` drives the
probe at viewport 385×320 / dpr 3 with puppeteer-core and the system Chrome. `.local/` is gitignored and is not part
of the deliverable — the harness is described here so it can be re-created; the probe page it drives *is* committed.

Read the `后备/CSS·dpr` line per canvas: below ~0.95 means upscaled. The probe page is dev-only and excluded from
release packaging (`tools/package.mjs` allowlist, asserted by `test/package.test.js`).
