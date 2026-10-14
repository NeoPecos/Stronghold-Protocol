# TASK-043 — 阶段大字横幅「缩回」顶栏胶囊（休息一下的交接）

Status: `review_ready`
Lead: Codex
Implementer: DeepSeek (2026-10-14, maintainer-reported visual defect)
Starting commit: `edfc1104`

## 背景

维护者报告（2026-10-14）：休整期阶段大字横幅消失后，顶栏胶囊里又出现一次同样写着「休息一下」的胶囊，两者尺寸差很多、中间没有任何过渡，很突兀；要求做成「直接替换」（选定方案 A：大字缩回胶囊）。

真正的原因有两层：

1. `.pbanner--overlay`（屏幕中间的大字横幅）只负责自己出现/消失，与顶栏胶囊没有任何交接；胶囊在大字播放期间还是可见的（`css/screens/game.css` 里只有联防/回合开始两个 intro 有隐藏胶囊的规则，阶段横幅没有），所以「大字 + 小胶囊」同屏，大字一没就只剩小胶囊 → 视觉跳变。
2. 那两条隐藏胶囊的规则原先写在 CSS 的 `:has()` 上，而本仓库明确禁止 `:has()`（`test/client-static.test.js:1286-1290` 的兼容守卫：Firefox ESR 115 / Safari < 15.4），因此该守卫一直是红的。

## 范围

- `public/js/ui/components.js`
  - 新增内部工具 `useBodyClass(name, active)`：挂载期间给 `<body>` 加类（`useEffect` 清理）——`:has()` 的既定替代写法（`css/components.css:1012` 的注释、`test/devices.test.js:287` 的 connection banner 同款做法）。
  - `PhaseBanner`：`mode="overlay"` 时在「停留期间」加 `is-banner-up`（退场一开始就撤掉，让胶囊先回来），退场时量取真实胶囊几何，把 `--dock-x/--dock-y/--dock-s` 写到 `.pbanner__band` 上并加 `is-docking`。
  - `UniteIntro` / `RoundStartIntro`：播放期间加同一个 `is-banner-up`（它们各自在胶囊位画自己的小条，行为与原来 `:has()` 等价）。
- `public/css/screens/game.css`：两条 `body:has(…) .gtop__meter .capsule` 合并为一条 `body.is-banner-up .gtop__meter .capsule`（注释说明来源）。
- `public/css/components.css`：新增 `.pbanner__band.is-docking`（`animation: none` + `transition: transform 220ms, opacity 200ms` + `transform: translate(var(--dock-x), var(--dock-y)) scale(var(--dock-s))`），使大字沿着量到的偏移与比例落到胶囊上并淡出。

## 保护范围

不改玩法、不改协议/服务端、不改其它弹层（`ResultDialog`、`UniteIntro` 的盘面部分）；不动顶栏几何（胶囊尺寸/位置）；不引入 `:has()` 或容器查询。

## 验收与证据

- `node --check public/js/ui/components.js` 通过。
- `node --test test/client-static.test.js`：**382/382 通过**，其中 `:has()` 兼容守卫（`:1286`）从红转绿。
- 本地探针 `.local/banner-dock/check.mjs`（在 `dev/game-mock.html?phase=PREP&render=fallback` 上挂一个 overlay 横幅；结果见下）：
  - 停留期间：`body.is-banner-up = true`、胶囊 `visibility: hidden`；
  - 退场：`is-docking = true`、量到 `--dock-x -1px / --dock-y -276px / --dock-s 0.1276`，即 `matrix(0.1276, 0, 0, 0.1276, -1, -276)` —— 横幅宽 800px、胶囊实宽 102px，比例吻合；同时 body class 撤掉、胶囊恢复 `visible`（大字落在真胶囊上）；
  - 结束：横幅移除、胶囊可见（文本 `休息一下`）、无 JS 报错。
- 截图：`.local/banner-dock/dock-110.png`、`dock-240.png`。

## 回退

`git revert` 本任务提交即可（三个文件、纯前端表现层）。线上无需重启：`public/js|css` 是 `no-cache` 静态文件。

## 检查点

### 2026-10-14 23:40 — TASK-043 — DeepSeek（阶段横幅缩回胶囊）
- Action: 加 `useBodyClass` 与横幅「缩回」交接；两条 `:has()` 换成 `body.is-banner-up`。
- Result: 静态测试 382/382；探针量到交接几何与状态符合设计。
- Verification: 见上「验收与证据」。
- Next: 维护者确认观感后上线（三个静态文件）。
- Production/GitHub: 未上线、未推送。
