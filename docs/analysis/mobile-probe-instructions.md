# Mobile blur / adaptation — how to collect the device measurements (TASK-008)

## Why the earlier instruction was wrong

I first told you to paste a `javascript:` snippet into the phone's address bar. **That cannot work.** Every current
mobile browser (Chrome, Safari) strips the `javascript:` scheme when it is pasted and treats the text as a search
query — the address bar only runs it if you type it by hand, which is not something anyone should have to do.

The replacement below needs **no typing on the device at all**.

## Method A — the probe page (recommended, no typing)

I added `public/dev/mobile-probe.html`: a dev-only page that renders the **real game in an iframe** at this device's
own viewport and reads the live geometry from inside it. It measures without changing anything: no CSS, no asset, no
setting, and it sends nothing anywhere.

### Steps

1. **On the PC**, from the repository root, start the local server (it is already running as I write this):

   ```powershell
   node server/index.js
   ```

   It listens on port 3000 on all interfaces and prints the LAN URLs. If Windows asks whether to allow Node.js on
   **private networks**, click **Allow** — without it your phone cannot reach the PC.

2. **On the phone**, open this URL in the browser (same Wi-Fi as the PC):

   ```
   http://192.168.0.100:3000/dev/mobile-probe.html
   ```

   Replace `192.168.0.100` with the PC's address if it changes; the server prints the right one at boot.

3. On the page, tap in this order:
   - **① 载入游戏** — the real app renders in the frame. (This is the title screen; it has **no canvas**, which is
     normal — the frame simply shows the title.)
   - **② 载入对局页（COMBAT）** — the in-match screen, which is where the board canvas and the HUD exist.
     **This is the measurement that matters for blur.**
   - **③ 测量** — the numbers appear, including one line per `<canvas>`, plus a "usable height" line.
   - *(optional)* **④ 旋转测试** — then **rotate the phone to landscape** and keep the page in the foreground. The page
     samples the game frame at 0 / 700 / 1400 / 2500 / 4000 ms and fills the "旋转 / 恢复重建" table, which answers
     whether the canvas is rebuilt for the new orientation and whether it settles. It rotates nothing itself.
4. Tap **⑤ 复制结果** and send me the JSON (or just screenshot the page — it fits on one screen).

### What to look for yourself

Each canvas line ends with a ratio:

```
后备/CSS·dpr = 1.000        → the canvas is drawn at full device resolution: not the cause
后备/CSS·dpr = 0.667  ← 被放大，会发虚
                            → the backing store is smaller than the screen asks for: THIS is blur
```

If the number is below ~0.95 the picture is being upscaled, and the fix is in the resolution cap, not in the assets.
If it is 1.0 and the picture still looks soft, the cause is elsewhere (asset resolution, CSS transform, or the board's
own lower cap) and the other fields say which.

### Also worth capturing on the phone

- A **screenshot of the whole blurry screen** — this separates "the whole frame is soft" from "only the board" from
  "only the HUD text". Those have different causes and I must not guess between them.
- The same screenshot **with 设置 open**, so the selected 分辨率 / 文字大小 are visible in the picture.
- One **after rotating the device once** (rotation rebuilds the field view).
- Do **not** change 分辨率 or 质量 between runs — that invalidates the comparison.

## Method B — the native client itself (the one that actually blurs)

The probe page runs in the phone's **browser**, which shares the device but **not** the app's WebView viewport. If the
blur is specific to the Windows or Android client, its own viewport has to be read from inside the app:

1. Android: enable **USB debugging** in developer options, connect the phone, and confirm the client is debuggable at
   `chrome://inspect/#devices` on the PC. If the app does not appear, the wrapper has not enabled WebView debugging
   (`WebView.setWebContentsDebuggingEnabled(true)`) — tell me and I will note it as a wrapper gap rather than guess.
2. Windows client: it is a WebView2 host, so the same idea applies through WebView2's remote debugging, which the
   wrapper has to enable.
3. Once attached, open the **console** and paste the snippet from `docs/analysis/mobile-probe-instructions.md`
   (Method B section) — in the console, unlike an address bar, `javascript:` is **not** needed and pasting works.
   Or simply re-run the measurement there once the probe page is loaded in that WebView.

If the wrapper does not expose either, say so: the honest outcome is then "client-side viewport could not be measured",
and the report will say that instead of inventing a cause.

## What I do with the results

| Measurement | Question it settles |
|---|---|
| canvas `back` vs `css × dpr` | Is the frame upscaled (a cap/resolution issue) or drawn 1:1 (an asset or transform issue)? |
| board canvas vs HUD canvas, separately | Board blur and sprite/HUD blur may have **different** causes; the 3D board has its own lower cap. |
| `safeArea` all `0px` | The `env(safe-area-inset-*)` rules never engage on that device — so any inset-dependent layout did nothing. |
| `visualViewport` vs `inner` vs `doc` | Which of the three the visible-height logic (`--sp-vh`) is actually following. |
| `transform` on a canvas | A CSS `scale()` on a full-resolution canvas still looks soft — a different fix from a low backing store. |
| image `natural` vs `css` | Is a small source being stretched? (e.g. a 102×100 bond icon shown at 14 px is fine; the reverse is not.) |
| image `currentSrc` `.png` vs `.webp`, `/assets/local/` vs `/assets/` | Settles the PNG→WebP question **before** any asset or quality parameter is touched. |
| `prefs.textSize` / `resolution` | Whether the reported blur happens at a non-default display setting. |

## Rule still in force

**No CSS, no asset, no image-quality parameter changes** until a cause is proven from these numbers. That is TASK-008's
whole point, and the reason this document exists instead of a patch.
