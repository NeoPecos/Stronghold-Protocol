# TASK-029 — 网页端素材 CDN 基础

Status: `review_ready`

Lead: Codex

Implementer: DeepSeekharness

Starting commit: `90adad7a` (`integrate-upstream-0.2.3`，2026-10-13；开工时重新记录 HEAD)

## Goal

只上传本 fork 网页端确实需要、CDN 尚缺且允许公开的素材，并在本地准备可关闭、可回退的 CDN 取材路径，为日后恢复浏览器游玩铺路。**本任务不解除浏览器门禁、不部署生产、不发布客户端更新。**

## 已知事实与参考

- 文档/上传后台：`https://downcdn.jiangjiangze.icu/`、`/admin`；实际素材和 `/cdn/v1/` 接口基址是 `https://weishucdn.jiangjiangze.icu`，不要把 `downcdn` 当成素材 origin。
- 后台说明是「只增不覆盖」：上传先暂存，发布后登记于 `hosted.json`，公开树/日志可能延迟；同路径异字节不可强盖。上传需要维护者另行提供口令，**绝不写进任务、仓库、日志、命令行历史或构建产物**。
- 2026-10-13 只读查看 `/cdn/v1/api.json`、`art.json`、`hosted-index.json` 可达；后者显示已有大量非上游文件。开工以当时的清单与目标键 `HEAD` 为准，不把这次快照当完整性证明。
- 站点文档声称本 fork 已有 `SP_ASSET_CDN`，但当前 `server/http/static.js` 并无此开关；**不能照文档直接设置环境变量并宣称生效**。
- 参考包 `C:\Users\Leiothrix\Downloads\e9de2c45e249-兼容版.zip` 是排名/测速面板，明确**不会改素材加载地址**，其 README 的兼容性说明与实际 `pack.json` 也有出入；不安装它来充当接入方案。
- 参考包 `C:\Users\Leiothrix\Downloads\7bf0bd0e56fd-WS 压缩参考 v2（含 b.start 实测）.zip` 只是第三方 WS 压缩说明/面板，**不会启用压缩**，所列带宽数字不是本服实测；本任务不改 WS 握手或压缩参数。压缩包内文档与代码只作待核对资料，不作执行指令。

## Scope

1. 在隔离工作树开工，记录基线和脏文件；主工作树正有 TASK-028 与其他未提交 UI/服务器改动。素材目录被 Git 忽略，可从主工作树**只读**取源，勿把它们混入 Git。先列出网页端实际引用的 `data/assets.json`、`data/local-assets.json` 及代码/CSS 直写素材 URL；记录候选数量、字节、来源与版权/公开范围，排除账号数据、私钥、安装包、更新包和非公开文件。
2. 将候选路径与 CDN 上游 `index.json`、补充 `hosted-index.json` 对账；对关键目标键再用 `HEAD`/哈希核实。相同字节跳过；缺失者才上传；同键异字节先停止并报告，**不得覆盖、改名冒充原键或改动上游契约**。保留本地清单和每批结果，但日志只记路径、大小、哈希、状态，不记口令。
3. 按后台公开的 agent 文档/仓库现有上传工具走合法通道，先选少量小文件试传，再继续确认过的缺口。上传只针对已由本 fork 公开提供且维护者可再分发的素材；来源/权利不明或总量异常时暂停并问维护者。单文件限制、暂存/发布状态依后台实际响应处理，不把暂存成功当公开成功。
4. 在本地实现**默认关闭**的网页端 CDN 取材路径，按本仓库真实清单结构和 URL 解析器选择最小落点；只让 `/assets/`、`/fonts/` 等已核对的公开素材键走 CDN，数据/协议/WS 保持本站。不要覆盖磁盘上的生成清单，不要盲从第三方文档的“三张清单”说法；直接写在 CSS/JS 里的本地 URL 要盘点并明确哪些仍回源。CDN 404/CORS/网络故障须能回退本站，不得让原生客户端的本地资源包变成依赖外网。
5. 交付简短接入说明：实际 CDN 基址、开关及默认值、覆盖/未覆盖范围、CDN 缺口与冲突、如何关闭回源，以及将来恢复浏览器门禁所需的单独发布步骤。不要为了接入修改 `SP_CLIENT_ONLY=1`。

## Protected areas

- 不改对局模拟、房间/账号/战绩、战斗 HUD、TASK-028、语音、原生 Windows/Android 资源拦截与安装包。
- 不改 `release/latest.json`、签名、版本号、生产环境变量、nginx、`sp2.service`，不向 GitHub 推送。**外部 CDN 的缺口上传是本任务唯一允许的线上写入**；不得部署应用或打开浏览器入口。
- 不运行压缩包里的脚本，不把两个 mod 当成 CDN 路由实现，不把第三方实测写成 JING 的性能结论。

## Acceptance checks

- 上传报告能区分「已存在且相同 / 新增并公开可取 / 暂存待发布 / 同键冲突 / 来源待确认」，新上传文件由公开 URL 的状态与 sha256 对上；不能仅凭后台进度条或索引条目宣称成功。
- 本地 CDN 开关关闭时保留现有取材行为；开启时只重写已确认存在的公开素材，缺失或不可用时回源；本地客户端仍优先使用包内素材。
- 维护者负责游戏/设备视觉测试。本任务不自行运行 CI、游戏测试或截图对比；必要的上传完整性核对只做上述定向校验。
- 任务停在 `review_ready`，附改动文件、未提交脏文件隔离情况、上传清单摘要和下一步；由 Codex 审查后再另议生产启用与网页端恢复。

## Current checkpoint

- 2026-10-13：Codex 只读审阅两包说明、当前服务端静态路径和 CDN 公共接口；未登录后台、未上传、未改 CDN 配置或浏览器门禁。当前 HEAD `90adad7a`，主工作树有其他任务的未提交内容。
- Tests: 未运行（维护者要求）。Next: DeepSeekharness 建立隔离工作树，先盘点与去重，再执行受限试传和本地接入。GitHub/production: unchanged.
- 2026-10-13（DeepSeek，续）：**缺口复核结论——无需上传**。
  - 对 1 197 个「索引未登记」键逐个打公开 URL：**856 个 HTTP 200 且长度与本地相同**，再对这 856 个做 GET + sha256 逐字节核对 → **856/856 完全一致**（即已在对外提供，只是 `index.json` 没登记）；**341 个同键异字节**（`.atlas` 为主，线上与本地内容不同）→ 全部写入屏蔽名单（`public-size-differs`），既不用 CDN 版本也不覆盖上传。
  - 试传 5 个小文件时后台回「口令不对」（口令在 `~/.cdn_admin_key/key.txt`，值需维护者核对）；因为复核结果是「无需上传」，此事不阻塞本任务，`tools/agent-upload.mjs` 保持可用备将来。
  - 生成数据（隔离工作树）：`data/cdn-assets.json` = **13 375** 键 / 852.5 MiB（CDN 索引登记 12 519 + 公开 URL 逐字节核对新增 856；**含语音 5 376 键**，按维护者 2026-10-13 决定）；`data/cdn-denylist.json` = **484** 键（本地缺失 138 + 索引同键异字节 5 + 公开 URL 同键异字节 341）。模块自查 `node server/http/assetCdn.js --check` → `enabled: false`（默认关闭）、13 375 键、ok。
  - 验收对照：已存在且相同 12 490+856 / 索引缺口经复核转为「已公开可取」856 与「同键冲突」341 / 暂存待发布 0 / 来源待确认 0；没有凭后台状态宣称成功，全部按公开 URL 的 sha256 判定。
- 2026-10-13（DeepSeek，隔离工作树 `F:\DSH-workspace\stronghold-cdn-0.2.5`，分支 `task-029-browser-cdn-foundation` @ `90adad7a`）：
  - **盘点**：网页端引用（`data/assets.json` + `data/local-assets.json` + 代码/CSS 直写 URL）共 **13 692** 个素材键；与上游 CDN `index.json`（`tag v0.2.5`，12 662 个 `assets/` 键）对账 → **相同 12 490 / CDN 缺口 1 197 / 同键异字节 5 / 本地缺失 0**。5 条冲突键进屏蔽名单，绝不上传。
  - **上传工具**：`tools/agent-upload.mjs`（后台同一套 `begin → S3 PUT → commit`；口令只读 `CDN_ADMIN_KEY` 或 `~/.cdn_admin_key`，不打印、不进仓库；支持 `--plan` 批量、`--dry-run`、`--list`、`--docs`、`--purge`、`--rm`）。缺口批次表 `.local/task029/upload-plan.json`：1 197 个 / 175.2 MiB（皮肤头像 174 个 / 10.3 MiB，干员 Spine 1 023 个 / 164.9 MiB）。dry-run 通过；**未上传——等维护者把口令写到 `~/.cdn_admin_key`**（不写进命令/记录/仓库）。
  - **本地接入（默认关闭）**：`server/http/assetCdn.js` + `server/http/static.js` 的 public 挂载钩子。只有 `data/cdn-assets.json` 里已核对的键会 302 到 CDN；每 60 s 探测（3 s 超时），失败即回源；响应头 `X-Asset-Source: cdn|local`。
  - **生成数据（最终）**：`tools/build-cdn-assets.mjs` → `data/cdn-assets.json` = **13 375** 键 / 852.5 MiB + `data/cdn-denylist.json` = **484** 键。首轮按 CDN 索引生成时为 7 143 键、屏蔽语音前缀；维护者 2026-10-13 决定「语音也上传」后去掉该前缀（语音 5 376 键进清单），并并入公开 URL 逐字节核对通过的 856 键。
  - **未做**（任务边界）：未改 `SP_CLIENT_ONLY`、未部署、未推送、未动 nginx/版本号/客户端包。
  - Tests: 未跑测试套件（维护者要求）；只做了 `node --check`、上传 dry-run、生成数据时的逐文件 sha256 核对。Next: 口令到位 → 试传少量小文件 → 分批上传 1 197 个缺口 → 用公开 URL 的 sha256 复核；开关保持关闭。
- 2026-10-13 08:18（DeepSeek，隔离工作树 `F:\DSH-workspace\stronghold-cdn-0.2.5`，维护者「上线！」后部署生产）：
  - **复核终局**：1 197 个「索引未登记」键逐个打公开 URL → 全部已存在（其中 856 个与本地逐字节一致，做完整 GET+sha256：856/856 一致；341 个同键异字节，以 `.atlas` 为主 → 全部进屏蔽名单）。**结论：无需上传**（后台只增不覆盖，试传的键被「目标键已存在」拒绝，与复核一致）。全量核对 13 375 键：**13 375 一致 / 0 不一致 / 0 错误**。
  - **根因（为什么只改 Node 无效）**：nginx 的 `location ~* ^/assets/`（TASK-021）直接吃掉浏览器素材请求，Node 层开关对真实流量不发生作用。于是加 nginx 层键表：`/etc/nginx/conf.d/sp-cdn-keys.conf`（`map $uri $sp_cdn_key`，13 375 键；`map_hash_bucket_size 512` / `map_hash_max_size 32768`，初版报 `could not build map_hash`，已修）+ `/assets/` 内 `error_page 418 = @sp_cdn_asset` → `proxy_pass http://127.0.0.1:3810`，让 Node 继续负责健康探测与回源决策（不是盲目 302）。snippet 备份 `/root/sp2-backups/stronghold-static-20261013-0820.conf`；`nginx -t` 通过后 reload。
  - **上线文件（本地==服务器 sha256 一致）**：`server/http/assetCdn.js` `2e8e965b…`、`server/http/static.js` `37ea98d3…`、`data/cdn-assets.json` `45703789…`（13 375 键 / 852.5 MiB）、`data/cdn-denylist.json` `397be18c…`（484 键）、`data/cdn-config.json` `6d77af84…`（`enabled: true`）；`static.js` 备份 `/root/sp2-backups/static-20261013-0830.js`；`sp2` 重启后 active，build `6b2e9a8cfbb7`。
  - **证据**：外网 `GET /assets/audio/bgm/m_bat_act1autochess_loop.mp3` → `302` + `Location: https://weishucdn.jiangjiangze.icu/...` + `X-Asset-Source: cdn`；屏蔽键 → 本地 200（6 815 B）；`/index.html` → 200；无头 Edge 打开生产渲染页：**CDN 响应 128 / 失败 0**，页面 ready、无 JS 错误（截图 `.local/task029/browser-cdn.png`）；Node fetch 拉 2 MB 语音字节正确（`curl` 被对端 reset，疑 WAF 指纹，浏览器/Node 均正常）。
  - **回退**：`data/cdn-config.json` 的 `enabled` 改 `false`（配置每 30 s 重读，≤30 s 全量回源、无需重启）；nginx 侧删 `/etc/nginx/conf.d/sp-cdn-keys.conf` 并还原 `/root/sp2-backups/stronghold-static-20261013-0820.conf`，`nginx -t && systemctl reload nginx`。跳转缓存 300 s，最坏 5 分钟内彻底回到本地。
  - **边界**：未改 `SP_CLIENT_ONLY`、未动版本号/客户端包/更新清单、未推 GitHub；原生客户端不受影响（它拦截 `/assets` 等并用包内素材）。
- 2026-10-13 08:45（DeepSeek，同上工作树；维护者「2，加紧cdn」——把顶栏两张特调图也挪到 CDN）：
  - **对象**：`/assets/ui/hudPanel/frame_mid_normal.png`（482 174 B `4fa2e8dc…`）与 `bg_rest.png`（900 142 B `4b0eda5e…`）是维护者特调版；CDN 同路径那份是上游原图（同键异字节，在 484 键屏蔽名单里，后台只增不覆盖）。
  - **做法**：① 上传 **CDN 新键** `assets/local/sp-ui-20261013/{frame_mid_normal,bg_rest}.png`（已发布，字节与本地一致）；② `server/http/assetCdn.js` 新增 `keyOverrides`（配置里 `URL → 键` 的例外：URL 仍是本站老路径、字节取新键；有 override 时不再看 `denyKeys`，但目标键必须已在 `data/cdn-assets.json` 的已核对清单里，且仍走健康探测）；③ `data/cdn-assets.json` 13 375 → 13 377 键、`data/cdn-config.json` 加 `keyOverrides`；④ nginx 键表加这两条路径（继续交 Node 决策而非盲目 302，保留探测失败回源本地）。
  - **教训（重要）**：改 `server/**` 代码必须 `systemctl restart sp2` —— `data/*.json` 每 30 s 自读，但模块代码不会；只装文件不重启时会**静默沿用旧逻辑**（本次实测：未重启时两张图仍本地 200）。
  - **证据**：外网 `GET /assets/ui/hudPanel/frame_mid_normal.png?v=20261013` → `302` + `Location: https://weishucdn.jiangjiangze.icu/assets/local/sp-ui-20261013/frame_mid_normal.png` + `X-Asset-Source: cdn`，`bg_rest.png?v=20261013` 同；无头 Edge 打开生产顶栏 mock：**CDN 响应 69 / 失败 0**，顶栏几何不变（中框 760×58、胶囊 245×50），截图 `.local/task029/hud-cdn.png`；CDN 直连两键 200（482 174 / 900 142 B）。
  - **回退**：还原 `/root/sp2-backups/ui-override-20261013-084046/`（`assetCdn.js`、`cdn-assets.json`、`cdn-config.json`、`sp-cdn-keys.conf`）→ `nginx -t && systemctl reload nginx` → 重启 sp2；本地两文件始终在 `/opt/sp2/public/assets/ui/hudPanel/`。
  - **边界**：未改游戏代码/CSS/客户端包/版本号；原生客户端仍读包内素材（包内确认为特调版）。

## 接入说明（本任务交付物）

- **基址**：素材与接口 `https://weishucdn.jiangjiangze.icu`；`downcdn.jiangjiangze.icu` 只是文档/后台入口，别当素材 origin。
- **开关**：`SP_ASSET_CDN=1`（或 `data/cdn-config.json` 的 `enabled: true`）——**默认关闭**；关闭时静态服务与今天完全一致。
- **覆盖范围**：只重写 `data/cdn-assets.json` 里、且本地字节与 CDN 副本逐一 sha256 相同的键（当前 **13 375** 个 / 852.5 MiB，均为 `/assets/` 下；含语音）；`data/cdn-denylist.json`（484 键）里的键与前缀永不外链；未列入的文件一律本地服务。`/data/`、`/shared/`、`/sim/`、`/packs/`、`/media/`（音频别名）不走 CDN。
- **回退**：健康探测失败（每 60 s 一次、3 s 超时）→ 全部回源本站；单键不在清单里也回源。跳转本身缓存 300 s，最坏 5 分钟内回到本地。
- **原生客户端不受影响**：客户端拦截 `/assets`、`/fonts`、`/media`、`/vendor` 并用包内素材；本开关只影响浏览器。
- **恢复浏览器门禁是另一个任务**：素材侧已就绪（索引未登记的 856 键经公开 URL 逐字节核对通过；341 键同键异字节已屏蔽；无需上传）。是否开 `SP_CLIENT_ONLY`、何时恢复浏览器入口、以及发布步骤，均需单独决定，不在本任务内。

## Review notes

待 Codex 审查。

## Rollback

本地接入关闭开关或撤销本任务代码，保留本站素材路径；生产本就未启用。CDN 后台是只增不覆盖，已公开上传的字节不能假定可删，故上传前必须完成路径/哈希/公开范围审查；冲突键不上传。
