# Mobile blur / adaptation — device probe (TASK-008)

This file exists so the maintainer can collect the measurements the implementer cannot produce from a workstation.
Everything here is **read-only**: it measures, it changes nothing, and it does not send anything anywhere.

## How to run

1. Open the game on the phone — **once in the browser** (`https://sp.bs.leio.fun`) and **once in the app**
   (Windows or Android client). Run it in both: the comparison is half the diagnosis.
2. Get to the screen that looks blurry (a match in progress is the interesting one) and **stay there**.
3. Paste the whole `javascript:` snippet below into the address bar and press Enter.
4. Copy the alert text back (or screenshot it). If the address bar strips `javascript:`, type it manually — the
   browser usually restores it once you start typing `javascript`.
5. Repeat at the exact moment it looks *most* wrong, and again after rotating the device once.

> Note: in the **native client** the address bar usually does not exist. Run the probe from the browser for the
> numbers, and use the app for the **screenshots** (below) — those two together still separate "the page thinks it is
> 844×390" from "the wrapper is showing it at a different size".

## What it collects, and why each field matters

| Field | Question it answers |
|---|---|
| `inner`, `outer`, `doc` | Which CSS viewport does the page actually have? |
| `vv` | Does `visualViewport` disagree with `innerHeight` (URL bar, keyboard, wrapper chrome)? |
| `sa` | What are the **resolved** `env(safe-area-inset-*)` values — `0px` everywhere means the inset rules never engage. |
| `dpr` | What does the hardware claim (2× / 2.625× / 3×)? |
| `screen`, `orient` | Real screen pixels and orientation. |
| `canvas` | **The blur number**: `canvas.width/height` (backing store) vs its CSS box. If backing < CSS × dpr, the canvas is being upscaled. |
| `--sp-vh`, `--sa-*`, `--t` | The app's own computed variables, as the CSS sees them. |
| `textSize`, `resolution` | Which display options this user has selected (both feed the pixel ratio cap). |
| `srcs` | The actual URLs the images came from — this is how we tell local art from mirror art, and PNG from WebP. |
| `fs` | Whether the page is inside fullscreen (the wrapper may be, the page may not know it). |

## The snippet

```js
javascript:(()=>{const px=el=>{const s=getComputedStyle(el);return[Math.round(el.getBoundingClientRect().width),Math.round(el.getBoundingClientRect().height),s.transform]};const probe=document.createElement('i');probe.style.cssText='position:absolute;left:-9999px;top:0;width:10px;height:10px';document.body.appendChild(probe);const gv=n=>getComputedStyle(probe).getPropertyValue(n).trim()||'-';const cs=[...document.querySelectorAll('canvas')].map(c=>({cls:c.className||c.id||'(canvas)',back:[c.width,c.height],css:[Math.round(c.getBoundingClientRect().width),Math.round(c.getBoundingClientRect().height)],tf:getComputedStyle(c).transform}));const imgs=[...document.images].slice(0,25).map(i=>({src:i.currentSrc||i.src,nat:[i.naturalWidth,i.naturalHeight],css:[Math.round(i.getBoundingClientRect().width),Math.round(i.getBoundingClientRect().height)]}));let ls={};try{ls=JSON.parse(localStorage.getItem('sp.pref.settings')||'{}')}catch{};alert(JSON.stringify({inner:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],doc:[document.documentElement.clientWidth,document.documentElement.clientHeight],vv:visualViewport?{w:Math.round(visualViewport.width),h:Math.round(visualViewport.height),scale:visualViewport.scale,top:Math.round(visualViewport.offsetTop)}:null,dpr:devicePixelRatio,screen:[screen.width,screen.height],orient:screen.orientation&&screen.orientation.type,sa:[gv('--sa-t'),gv('--sa-r'),gv('--sa-b'),gv('--sa-l')],vars:{vh:gv('--sp-vh'),t:gv('--t')},fs:!!document.fullscreenElement,html:document.documentElement.className,canvases:cs,images:imgs,prefs:{textSize:ls.textSize,resolution:ls.resolution,quality:ls.quality},ua:navigator.userAgent.slice(-60)},null,1))})()
```

## The screenshots that make the numbers actionable

Take these on the device, and say for each whether it looked wrong:

1. A **full-screen shot of the blurry match** — this shows whether the whole frame is soft, only the board, or only
   the HUD text. Those have different causes and I must not guess between them.
2. The same view **with the app's 设置 open**, so the chosen 分辨率 / 文字大小 are visible in the picture.
3. A shot **right after rotating** the device once (the rotation path rebuilds the field view).
4. If the Windows client is the one that blurs: the same screen in the **browser on that PC**, for comparison.

## What I will do with it

- Compare `canvas.back` against `css × dpr` to decide whether this is a **backing-store cap** (`resolution`
  setting / `canvasPixelRatio`) or an **upscale**, and separate the board (its own lower cap) from the sprites.
- Compare `sa` across browser and app to decide whether the safe-area path is even active on that device.
- Compare `vv` against `inner`/`doc` to decide whether the visible-height variable is the one being used.
- Compare `srcs` `.png` vs `.webp` and `/assets/local/` vs `/assets/` to settle the PNG→WebP question **before** any
  asset or quality parameter is touched.

## What NOT to change while measuring

Do not change the 分辨率 or 质量 settings between runs — a moving setting invalidates the comparison. If you must try
a different one, say which, and take a fresh full set.
