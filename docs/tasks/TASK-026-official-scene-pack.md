# TASK-026 — 官方战场场景包补齐并上线

Status: `review_ready`
Lead: Codex
Implementer: DeepSeek (2026-10-13, maintainer report: 看不到 0.2.5 的新地图)
Starting commit: `e9eec41b` (`integrate-upstream-0.2.3`)

## 背景

维护者问「0.2.5的地图资源推进新客户端了吗？为什么我看没见到0.2.5的新地图」，随后指示「别找了，在上游库里
https://github.com/sganggs/Stronghold-Protocol，但是你千万别覆盖我的各种ui设计，我们这个是自己fork的仓库，你看看有哪些需要新增的素材资源，加进去」。

官方 0.2.5 的战场场景（battlefield scenes，#532）代码路径已就位（`public/js/render/board3d/load.js` 的
`loadScenePack` 与 `public/js/render/board3d/scene.js` 的 `setScenePack`：本地素材清单列出某关卡的场景包时，3D 棋盘改用该
场景，否则回落到程序化金属盘面），但场景素材本身从未落盘：`public/assets/local/scene` 不存在，
`data/local-assets.json` 与 `data/assets.json` 各 0 条 `local/scene` 引用，生产服务器同样没有。原因有两层——抽取出来的
本地素材不入库（`public/assets/` 与 `data/local-assets.json` 都被 git 忽略），而官方把已结束赛季的场景 bundle 从客户端里
清掉了，所以本机 22.58 GB 的官方客户端里 `arts/maps/.../act1autochess_*` 目录是空的。

## 本次完成

1. 用项目自带工具从官方 CDN 取回场景源：`tools/local-extract/fetch_scenes.py`（版本 `26-04-13-12-31-42_e9b560`，
   Android 源）→ 33 个 bundle / 28.3 MiB 落到 `.cache/official-scenes/<version>/`。
2. 组装依赖根并导出场景：`.cache/ab-root/` 用 junction 指向
   `D:\Arknights\Arknights_Data\StreamingAssets\AB\Windows` 的 `arts`、`shaders`，并把
   `D:\Arknights\Arknights_Data\Resources\unity default resources` 放进依赖根；执行
   `python tools/local-extract/extract.py --only scene --game .cache\ab-root --scenes .cache\official-scenes\26-04-13-12-31-42_e9b560`
   → 92 个文件 / 61.44 MiB。
3. `data/local-assets.json` 由 1 475 条升到 1 532 条（新增 57 条 `local/scene` 引用：11 个关卡场景 + `scene/tex`）。
4. 生产上线（纯新增）：`/opt/sp2/public/assets/local/scene/**`（92 文件 / 62M）与
   `/opt/sp2/data/local-assets.json`；旧清单备份 `/root/sp2-backups/local-assets-20261013-040810.json`。

## 证据

- 每关布局为 `scene.json` + `scene.bin` + `lm*.png/webp`：`act1autochess_m01` 6 文件 3 714 958 B、`m02` 6/3 450 144、
  `m03` 4/3 451 948、`m04` 4/3 423 508、`m05` 4/3 722 441、`m06` 4/3 284 260、`m07` 4/3 084 585、
  `act2autochess_m01` 6/8 857 133、`m02` 12/6 197 980、`m03` 6/5 043 931、`m04` 6/4 137 354、`tex` 30/16 055 042；
  合计 92 文件（35 png + 35 webp + 11 bin + 11 json）61.44 MiB。
- 本机 `data/local-assets.json` sha256 `82c322ca35544b9f0ea954731b1fd0b6adfd3b3f0e64dcd8eee5fa72c6194d72`（156 906 B，
  1 532 条 / 57 条场景引用），与线上 `https://sp.bs.leio.fun/data/local-assets.json` 逐字节一致。
- 线上抽查 `https://sp.bs.leio.fun/assets/local/scene/act1autochess_m01/lm0.png`：936 393 B，sha256 与本机一致。
- 未覆盖任何既有素材：近两小时内 `public/assets` 下变更文件 92 个，全部位于新增的 `local/scene/`；`public/` 下其余近期改动
  只有此前已提交的 `index.html` 与两个 CSS。
- `node tools/fetch-assets.mjs --add-only` 复核：计划需要 9 589 文件 + 711 Spine 模型，本机已有 10 956 文件、缺失 0，
  本次没有也不需要新增其它素材；该命令因会丢掉 17 117 条现有条目而拒绝改写 `data/assets.json`（保护性，未覆盖）。

## 已知边界

- 原生客户端（Windows/Android `1.2.9`）仍看不到场景：场景包只在本机与服务器上，客户端离线优先读自己的 `bundle/`。
  要进客户端必须重建 bundle 并出包或走增量补丁（场景 61.44 MiB，在单包 100 MB 上限内），是否随包由维护者决定。
- 仍有 42 条清单条目没有盘上文件（多为 `token:*: missing skel`，需要从本机官方客户端补抽 Spine）与 4 个上游源缺失的
  图标/头像（`enemies.enemy_5601_entlec.icon` 等，客户端回落到字形）。它们不影响地图显示。

## 回滚

- 服务器：`rm -rf /opt/sp2/public/assets/local/scene`，再用
  `cp -p /root/sp2-backups/local-assets-20261013-040810.json /opt/sp2/data/local-assets.json` 恢复清单。均为静态文件，
  无需重启。
- 仓库：revert 本任务的 docs 提交即可；本机 `public/assets/local/scene/**` 与清单新增条目可删除后重抽。

## 检查点

### 2026-10-13 04:08 — TASK-026 — DeepSeek（0.2.5 官方战场场景补齐并上线）
- Action: 定位「看不到新地图」的原因（场景素材从未落盘 + 客户端里赛季 bundle 已被清）；用官方 CDN 取回 33 个 bundle，
  以本机官方客户端作依赖根导出 11 个关卡场景；写入 57 条 `local/scene` 清单引用；把 92 个文件与清单增量上线到生产。
- Result: 92 文件 / 61.44 MiB 落盘并上线，清单 1 532 条（线上逐字节一致），抽查文件哈希一致；既有素材零改动。
- Verification: 上述证据清单；`systemctl is-active sp2` = active；服务端与线上 sha256 复核一致。
- Next: 维护者刷新浏览器客户端查看新地图；若要让原生客户端离线显示，需要把场景包打进下一版包或增量补丁
  （TASK-025 的更新链路已就绪）。
- Production/GitHub: 场景素材与清单已上线生产（静态文件、无重启、有备份）；客户端包、服务端代码、`data/assets.json`、
  nginx 未改；GitHub 未发布。

### 2026-10-13 04:25 — TASK-026 — DeepSeek（QQ 群独立场景补丁：不走服务器更新器）

- Action: 按维护者要求（「能不能发个补丁，就是不走服务器的更新器，单独做个更新补丁，我放QQ群里，60m还是太大了」）
  制作独立补丁：只取清单真正引用的 57 个文件（11 个 `scene.bin` 27.53 MiB + 35 个 `lm*.webp` 7.38 MiB + 11 个
  `scene.json` 0.14 MiB = 35.06 MiB）；同目录那 35 个 `lm*.png` 没有任何代码路径引用（加载器按清单条目解析 URL），
  不进补丁。补丁内容 = 这 57 个文件 + 重新武装的 `bundle/index.json`（`03617f59…` → `594c45dc…`，13 699 条，
  两个来源各 13 699 条内容证明），并自带安装器（不依赖服务器更新器，`windows/update-windows.ps1` 的校验语义被
  复刻进 `apply-scenes-patch.ps1`）。
- Result: `dist/scene-patch/Stronghold-scenes-1.2.9.zip` 17 497 681 B（**16.69 MiB**，原包 61.44 MiB），
  sha256 `cb1416451dda7576e078d896cb8c8c3b9f3af600fd77c0499e171bb45369110e`；压缩包 62 个文件：
  `manifest.json`（58 条：`bundle/index.json` 带 `oldSha256`，57 个场景文件只带 `newSha256`）、`bundle/index.json`、
  `bundle/payload/assets/local/scene/**`、`apply-scenes-patch.ps1`、`apply-scenes-patch.cmd`、`README.txt`。
  生成脚本与安装器源文件在本机 `.local/task026/`（`make-scene-patch.mjs` 组装 stage 并打包，`patch/` 是安装器与说明的
  源文件），`.local/` 不入库。
- Verification（全部在 7z 解出的真实 1.2.9 安装树上实测，安装包索引确为 `03617f59…`）：① 打补丁 exit 0，
  `校验通过：新增 57 个文件，替换 1 个文件`，之后索引 `594c45dc…`（13 699 条、57 条场景在两个来源都有内容证明）、
  场景文件 57 个 / 36 763 429 B；② 重复运行 exit 0 并提示「已经安装过了」（幂等）；③ 对 1.2.8 安装树 exit 1，
  `当前版本与补丁不匹配：bundle/index.json`（拒绝且不改文件）；④ 客户端进程在运行时安装器拒绝执行（本机实测命中：
  维护者客户端正在运行）。服务器侧不需要任何改动。
- Next: 维护者把压缩包发到 QQ 群；群成员解压后双击 `apply-scenes-patch.cmd`（先确认客户端是 1.2.9 且已退出客户端）。
  Android 不能用散文件补丁（素材在 APK 内），需要应用内更新或新版 APK。
- Production/GitHub: 未上传服务器（该包走 QQ 群分发；nginx `/client/` 只放行 `latest.json`/`latest.sig`/`*.patch.gz`/
  `windows-*.zip`）；`dist/` 与补丁本体不入库；GitHub 未发布。
