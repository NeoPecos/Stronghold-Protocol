# Mobile blur — root cause report (TASK-008)

Measured: 2026-10-12, on the maintainer's phone, via `public/dev/mobile-probe.html` (TASK-008 finding only; no CSS,
asset or quality parameter was changed to produce this).

## Verdict

**The field canvas is drawn at 2 device pixels per CSS pixel on a 3-pixel-per-CSS-pixel screen, so the browser
upscales it by 1.5×.** That is the blur. It is not an asset problem and not a WebP problem.

| | |
|---|---|
| Device | dpr **3**, screen 407×904, `portrait-primary` |
| Game viewport (in the probe's frame) | CSS 384×320, host 385×320 |
| Canvas backing store | **770×640** |
| Backing ÷ (CSS × dpr) | **0.667** ← upscaled |
| What 1:1 would need | **1155×960** |
| Missing | **1.5× in each axis** |

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

**The 3.7 M pixel budget is not involved**: at 385 px wide it only starts to bind above 9610 px of height, so the cap
is the sole limiter here. It would bind on a large desktop surface (the code comment says exactly that: "keep
automatic rendering work bounded when fullscreen increases the canvas area").

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

## What this report does NOT establish

- **The native clients were not measured.** The probe ran in the phone's browser. The app's WebView viewport and its
  `devicePixelRatio` are unverified; if the app reports a different dpr or size the numbers above change. TASK-008's
  Method B (remote debugging into the client WebView) is still open.
- **No CSS `transform` on the canvas was observed** in this run (the probe reports it per canvas); a `scale()` would
  show up there and would be a separate cause.
- The screenshot set (whole frame vs board only vs HUD text only) was not supplied, so this report cannot say how much
  of the perceived blur is the field canvas versus the HUD glyphs. The canvas numbers are unambiguous; the *perceived*
  split is not.
- `safeArea` resolved to `0px` on all four sides **in the browser on that phone**, which is expected for a browser
  (no display cutout reported to the page) and says nothing about the wrapper.

## Fix plan (not started — needs a task and review)

1. **Let the resolution cap reach the device ratio.** Either raise the ceilings (`RES_CAP`, `QUALITY_RES`/`BOARD_RES`)
   so a 3× phone can reach 3, or make `native` mean `devicePixelRatio` instead of the constant 2. Keep the pixel
   budget as the bound — it is what actually protects fill-rate, and it already exists.
2. **Decide deliberately whether the default should change.** Raising `QUALITY_RES.high` from 2 to 3 changes rendering
   cost for every phone on default settings; the 3.7 M budget bounds the worst case, but this needs a perf check on a
   real device, not a guess. Offer it as an explicit 分辨率 choice first if the default is contentious.
3. **Keep the board's own lower cap separate** (`boardResolutionCap`: 1.25 on the mid tiers). The 3D board is
   fill-bound; raising the sprite cap must not silently raise the board's.
4. **`icon_hp.png`**: give it a source at least 3× its CSS box, or draw it from the atlas. Independent of 1–3.
5. **Re-measure after the fix** with the same probe and require `后备/CSS·dpr ≈ 1.0` on the target device.

## Reproduce

```powershell
node server/index.js
# phone, same Wi-Fi:  http://<pc-lan-ip>:3000/dev/mobile-probe.html
#  ① 载入游戏  ③ 载入对局页（COMBAT）  ② 测量  ④ 复制结果
```

Read the `后备/CSS·dpr` line per canvas: below ~0.95 means upscaled. The probe page is dev-only and excluded from
release packaging (`tools/package.mjs` allowlist).
