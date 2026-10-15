# TASK-049 — 黍黍 AstrBot 公告编辑与发布插件

Status: `review_ready` (implementation only — nothing deployed, no publication)

Lead/reviewer: Codex

Implementer: DeepSeek (2026-10-15, implementation + release plan)

Starting point: game worktree `F:\DSH-workspace\stronghold-026-integration` at `4c517699` with uncommitted 0.2.6/TASK-048 work; locate the actual AstrBot plugin repository and running bot separately before implementation.

Depends on: TASK-048 announcement store, publisher and reader being reviewed and released. The replacement announcement system is local only; production still serves the old notice.

## Goal

Create a standalone AstrBot plugin so the maintainer can ask 黍黍 to draft and revise a game announcement, inspect its complete preview, then explicitly approve publication to the existing game announcement history. The bot must never infer publication approval from conversational context.

## Scope

- Discover the actual 黍黍 AstrBot instance, plugin conventions and its connectivity to the game server; record the selected repository, deployment host and transport before coding. Keep the plugin separate from game UI and game rules.
- Accept drafting/revision requests only through the maintainer-authorized channel and verified sender identity from AstrBot event metadata. Render the full title and Markdown body back to the maintainer with a draft ID; allow revision and cancellation before publication.
- Publish only after a separate, explicit maintainer confirmation tied to that draft ID and exact content revision. One confirmation publishes once; changed or expired drafts require another preview and confirmation.
- Use the existing announcement store/publishing command through a narrowly scoped server-side bridge or constrained remote command. Document the chosen transport and credential placement; keep secrets out of chat, model prompts, logs and the Git repository. Do not give the bot a general-purpose shell or public write endpoint.
- On successful publication, return the new announcement ID and a read-back link/status. Preserve the store's immutable published-item rule: correcting a published notice creates a new announcement rather than overwriting its registered Markdown.
- Explicit pinning, unpinning, deletion and in-match emergency `notify` are out of the initial release. An ordinary publish must not interrupt a live match.
- Document setup, authorized sender configuration, failure/retry behavior and operator rollback. Do not couple the plugin to the unfinished multiplayer, MOD or lobby-redesign work.

## Protected areas

- No publication from group-member text, quoted messages, model-generated tool calls or unverified sender names. The approval check must use trusted event metadata and a one-use draft revision, not a phrase found in the message body.
- Do not expose the game admin token, arbitrary filesystem access, announcement storage or general shell execution to AstrBot users or the language model.
- Do not replace the current announcement storage format, public read-only API, CDN routing, existing bot plugins or game room/match behavior.
- No production deployment, bot restart, server restart, version bump, Git push or real announcement publication without a later explicit maintainer instruction. Do not run project tests or rendering checks unless separately requested by the maintainer.

## Acceptance checks

- Maintainer can request a draft, revise it, see the complete latest version and approve that exact version; the result appears in the game's announcement history only after approval.
- Non-authorized senders, stale confirmations, duplicate confirmations and changed drafts cannot publish. A transport failure leaves a clear recoverable state and never silently publishes twice.
- Title/body limits, Markdown safety and duplicate-ID behavior match the existing announcement store. Publishing does not automatically pin or notify players in a match.
- The release plan names the plugin artifact, game-side bridge or command, required credentials, backup, read-back check and rollback independently of TASK-048.
- Maintainer owns runtime and visual acceptance; record any separately authorized checks before marking `review_ready`.

## Implementation (2026-10-15 — 实现完成，未部署、未发布任何公告)

### 传输与凭证放置

- **游戏侧**：新模块 `server/http/announcementAdmin.js` + `server/http/routes.js` 里一条路由
  `POST /api/admin/announcements/publish`，凭请求头 `X-SP-Announce-Token` 与 `SP_ANNOUNCE_TOKEN`
  （`server/index.js` 读 `opts.announceToken ?? process.env.SP_ANNOUNCE_TOKEN`）比对。变量未设置或短于 16 字符 ⇒
  路由答 404（没令牌就等于没有这个接口）。这个令牌与 `SP_ADMIN_TOKEN` **完全独立**：只能新增公告，不能踢人、
  改密码、删公告。请求体 `{title, markdown}`（可选布尔 `notify`，插件从不发送）→ 复用既有 store 写入并广播，
  返回 `{ok, id, title, kind, publishedAt, url}`（`url` 供回读链接）。旧的 `/api/admin/announcement` 404 桩保持不变，
  未配置的服务器不会多暴露任何东西。
- **机器人侧**：`integrations/astrbot_plugin_sp_announce/`（目录名 = `metadata.yaml` 的 name；沿用线上
  `astrbot_plugin_sp_records` 的 AstrBot 4.28.1 约定）：`main.py`（命令/鉴权/HTTP）、`drafts.py`（内存草稿 + 内容指纹）、
  `metadata.yaml`、`_conf_schema.json`、`README.md`。群聊 @ 判定沿用参考实现的写法
  （`isinstance(component, At)` 遍历 `event.message_obj.message`，与 `event.get_self_id()` 比对），不做文本匹配。
  部署方式：把目录拷进 leioserver 的
  `/opt/astrbot/data/plugins/`（容器内 `/AstrBot/data/plugins/`），令牌与授权名单只存在于 AstrBot 插件配置里，
  不进聊天、提示词、日志或 Git。

### 批准流程（验收项关心的部分）

- `公告草稿 <标题>` → 6 位草稿 ID；`公告正文 <ID> <正文>` 填/覆盖 Markdown；`公告预览 <ID>` 回显**完整**标题 + 正文
  （按 1200 字分片，不截断）+ 内容指纹 + 下一条命令；`公告发布 <ID>` 仅当「当前指纹 == 上次预览记录的指纹」才发。
  预览后改动即失效，必须重新预览；发布成功即消费该草稿（再发一次报「找不到草稿」）。草稿 30 分钟过期（可配），
  只存在机器人内存，重启不会复活任何旧批准。
- 鉴权只用 AstrBot 的可信事件元数据：发送者必须在 `allowed_senders`（留空 = 谁都不能用，而不是所有人可用）；
  群聊还要 `allow_group` + 群白名单 + @机器人。**消息正文里的任何措辞都不能构成批准**。
- 失败可恢复且绝不重复发布：HTTP/超时 → 「公告**没有**发布」；服务器拒绝则回显状态与原因；插件不自动重试发布。

### 本次已做的验证（按保护范围：未跑项目测试、未做渲染检查）

- 三个改动过的服务端文件 `node --check` 通过。
- `python -m py_compile main.py drafts.py` 通过；`_conf_schema.json` 可解析；`metadata.yaml` 的 name 与目录名一致。
- 草稿流程自测（临时 `python -c`，只针对 `drafts.py`）：未预览拒绝发布、预览后改动拒绝发布、已发布草稿拒绝二次发布、
  发布后待办列表清空。
- **未做**（按要求）：项目测试套件、浏览器/渲染检查、任何针对生产环境的发布。

### 发布方案（独立于 TASK-048）

- 产物 A（游戏服）：`server/http/announcementAdmin.js`、`server/http/routes.js`、`server/index.js`；
  需要 `systemctl restart sp2` **且**新增 drop-in `SP_ANNOUNCE_TOKEN=<≥16 位随机串>`；替换前备份这三个文件；
  回退 = 还原三个文件（仅移除该环境变量也会让路由变回 404，等于关掉桥接）。
- 产物 B（机器人）：`integrations/astrbot_plugin_sp_announce/` → `/opt/astrbot/data/plugins/`；AstrBot 配置
  （`allowed_senders`、`announce_token`，可选群设置）；重载插件（`docker restart astrbot`）；回退 = 删除插件目录
  （已发布公告保留，游戏侧无变化）。
- 回读检查：发布后 `GET /api/announcements/<id>`；插件回报公告 ID 与 `/news/<id>` 链接。
- 不包含（按范围）：置顶/取消置顶、删除、比赛中 `notify`、任何由模型自行发起的发布。

## Current checkpoint

- 2026-10-15: owner chose a two-step flow: 黍黍 drafts/edits, maintainer reviews the preview, then approves publication. Owner explicitly requires an AstrBot plugin.
- The TASK-048 local announcement system already has a private Markdown store and terminal publishing command; it is not yet deployed. No bot connector, credential or production file has been changed for this task.
- Tests/builds run: none. GitHub/production: unchanged.
- Next: identify the real AstrBot plugin repository and trusted sender/channel metadata, then present a narrow transport design before implementation. Do not start publication integration against the old production notice.
- **2026-10-15（实现批）**：机器人宿主与约定已确认 —— leioserver `192.168.0.106` 上的 `astrbot` 容器
  （`astrbot:leio-runtime-4.28.1-quotepurpose-20260928`，宿主插件目录 `/opt/astrbot/data/plugins/`，容器内
  `/AstrBot/data/plugins/`，参考实现 `astrbot_plugin_sp_records`）；可信发送者用 AstrBot 的 `admins_id`/插件
  `allowed_senders`。窄传输 = 单条令牌鉴权的公告发布路由（见上「发布方案」），不引入 shell 或公共写接口。
  实现文件与验证见上；项目测试与渲染检查按要求未跑。GitHub/生产：未动。
- **提交状态（重要）**：本任务的实现**留在工作树、尚未提交**。原因是 `server/http/routes.js` 与 `server/index.js`
  里已有 TASK-048/0.2.6 的**暂存改动**（index 与 HEAD 有 50/42 行差异），`git add` 这两个文件会把别人的在途工作一起提进本次提交；
  按仓库「不混来源」的规矩，等发布批次冻结、由维护者给出 Git 基线后再统一提交（新文件 `server/http/announcementAdmin.js`、
  `integrations/astrbot_plugin_sp_announce/`、本任务文档也一样留待那次提交）。
- Next（实现批之后）：维护者运行期验收（私聊「公告草稿 → 公告正文 → 公告预览 → 公告发布」走通一条），
  这需要先随发布批次落地产物 A + `SP_ANNOUNCE_TOKEN` 与产物 B + 插件配置；验收通过后再标 `accepted`。

## Review notes

Record the chosen bot host, trust boundary, approval flow and the first successful maintainer-observed draft-to-publication path here. Any future pin/delete/urgent capabilities require a separately approved scope.

## Rollback

Disable/uninstall only this AstrBot plugin and revoke its scoped game-side credential or remote-command permission. Keep published announcements and the game's read-only history intact; remove an erroneous announcement only through the existing maintainer publication tool after a separate decision.
