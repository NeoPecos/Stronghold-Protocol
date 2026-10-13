# TASK-036 — 网页字体自托管（Noto Sans SC 子集）

Status: `review_ready`
Lead: Codex
Implementer: DeepSeek (2026-10-13；维护者「做吧」批准)
Starting commit: `2785e273`（`integrate-upstream-0.2.3`；下面的对照数字都是实测基线）

## 背景

玩家端首屏最大的一笔下载不是游戏本体，而是 **Google Fonts**：实测首次打开有 7 个请求、**24.3 MiB**
（Noto Sans SC 单个文件 6.4 MB），且依赖外网 —— LAN/离线/被墙场景下字体根本加载不出来。
本轮把这些字体换成**自托管子集**，只保留界面真正会显示的字符。

## 做法

- 新增 `tools/build-webfonts.py`：扫描 `public/index.html` + `public/i18n/*.json` + `data/*.json` + `public/js/**`
  （界面可能显示的全部文字，本次 **4 573** 个不同字符），用 fontTools 对源字体做子集，产出
  `public/fonts/*.woff2` 与 `public/fonts/webfonts.css`（后者由工具生成，勿手改；用法见文件头，`--fetch` 会下载源字体）。
- 源字体：notofonts/noto-cjk 的 `NotoSansSC-VF.otf`（可变，wght 100-900，31 036 字形）+ google/fonts 的
  `Oxanium[wght].ttf`、`Rajdhani-{Medium,SemiBold,Bold}.ttf`。本机直连 `raw.githubusercontent.com` 会被重置，
  工具内置 gh-proxy 镜像回退；源字体缓存在 `.cache/fonts/`（已被忽略）。
- `public/index.html`：删掉 `fonts.googleapis.com` 的 preconnect + 样式表引用，改为本地 `/fonts/webfonts.css`
  （`/fonts/` 与 `/assets/` 一样是生成物，`.gitignore:11` 忽略，由工具重新生成）。
- 字体栈不变（`public/css/theme.css:82-86`）：`Noto Sans SC` / `Oxanium` / `Rajdhani` 仍是原优先级，
  系统回退（PingFang / 雅黑 / Source Han …）保留；**谚文不在 Noto Sans SC 覆盖范围，与改动前一致走系统字体回退**。

## 产物与体积

| 文件 | 体积 | 说明 |
|---|---|---|
| `notosanssc-var.woff2` | 1 025 708 B | 3 652 字形，`font-weight: 100 900`（400/500/700/900 一个文件全包） |
| `oxanium-var.woff2` | 10 704 B | 数字/拉丁，wght 100-900 |
| `rajdhani-500 / 600 / 700.woff2` | 11 108 / 11 568 / 11 568 B | 数字 |
| **合计** | **1 045.6 KiB** | 对比改动前的 24.3 MiB（约 23×） |

## 验收与证据

- **本地**全新会话（`node .local/task029/measure-shell.mjs http://127.0.0.1:3000/`）：
  `googleFontsRequests: 0`；只拉本地字体 4 个文件（notosanssc 1 025 708 + rajdhani-700 11 568 + 既有 bender/novecento）；
  截图 `.local/fonts/local-shot.png`：中文（含 900 字重标题）/数字/拉丁渲染正常。
- **生产**（2026-10-13 14:25 上线后同一脚本）：`googleFontsRequests: 0`，「其它来源」从 7 个 / 24.3 MiB 降到 1 个 / 0 MiB；
  本站冷启动 own:shell 1.23 + css 0.39 + js 1.53 + data 0.32 ≈ **3.5 MiB**（改动前 = 本站 2.48 MiB + Google 24.3 MiB ≈ 26.8 MiB，
  玩家侧下载约降 **7.7×**）。生产截图 `.local/fonts/prod-shot.png`，与本地渲染逐字节一致（sha256 `f570a8d2…`）。
- 服务器文件哈希与本机一致：`notosanssc-var.woff2 0e2d01ca…`、`webfonts.css 87377c50…`、`index.html 9188a81f…`；
  `grep -c fonts.googleapis /opt/sp2/public/index.html` = 0；`systemctl is-active sp2` = active（纯静态文件，未重启）。
- 覆盖率（`.local/fonts/coverage.mjs`）：请求的 4 573 字符里，除 904 个谚文只剩 17 个字体本身没有的符号/字母
  （`ł š ύ ⁸ ⌈ ⌉ ⌊ ⌋ ⌛ ▸ ⚔ ⚙ ⛶ ✕ 👁 📖 🔍`）——改动前同样由系统字体回退渲染（同源字体不含），无新增缺口。

## 保护范围

未改游戏逻辑、服务端代码、素材包、客户端包、版本号、更新清单或 nginx 配置；
只改 `public/index.html` 的字体引用，并新增生成物（`public/fonts/*.woff2`、`public/fonts/webfonts.css`）与工具 `tools/build-webfonts.py`。

## 回退

- 服务器：`cp -p /root/sp2-backups/fonts-<ts>/index.html /opt/sp2/public/index.html`（恢复 Google Fonts 引用），
  再删掉新增的 5 个 woff2 + `webfonts.css`（静态文件，无需重启）。
- 仓库：`git revert <本任务提交>`。

## 已知小尾巴

- `/fonts/*.woff2` 目前由 Node 以 `Content-Type: application/octet-stream` 返回（浏览器实测正常加载，
  `Cache-Control: public, max-age=86400`）。若要规范响应头，在 `server/http/static.js` 的 MIME 表加
  `woff2 → font/woff2`；这是 `server/**` 改动，需要 `systemctl restart sp2`，故本轮未做。
- `public/dev/uikit.html`（开发用样式页）仍引用 Google Fonts，未动。

## 检查点

### 2026-10-13 14:25 — TASK-036 — DeepSeek（网页字体自托管）
- Action: 新增 `tools/build-webfonts.py`；生成 5 个子集字体 + `webfonts.css`；`index.html` 改指本地字体；上线并复核。
- Result: 玩家端字体下载 24.3 MiB → 1.0 MiB（本站冷启动多约 1 MB，1 天缓存），零外网依赖。
- Verification: 上面「验收与证据」全部通过；`node --test test/client-static.test.js` 中与 `index.html` 引用相关的断言通过
  （该套件另有一处 `:has(` 断言失败，来自 `public/css/screens/game.css:734`、`public/css/components.css:1004` 的现有内容，
  与本任务只改字体引用的改动无关）。
- Next: 维护者复核；`Content-Type` 规范若要做，随下次 `server/**` 重启一起。
- Production/GitHub: 已上线 `sp.bs.leio.fun`（纯静态文件，未重启服务）；未推送 GitHub。
