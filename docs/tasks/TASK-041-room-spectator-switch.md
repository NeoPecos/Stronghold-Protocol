# TASK-041 — 房间观战开关与「期望路人加入」的开局收口

Status: `review_ready`（实现与本地验证完成；**未部署**，等维护者确认）
Owner: DeepSeek（实现）／维护者（体验验收）
Starting commit: `4c517699`（本任务在此之上工作；工作树另有未提交的既有改动）
Task number: 038–040 由 Codex 在隔离工作树占用，本任务取 041。

## 需求（维护者 m05012）

> 添加一个按钮在房间里，房主可以设置是否开启观战功能。期待路人加入的标签在房间开始游戏后不再显示。

两点合成一个主题：**房间的可加入性开关收口**。默认行为必须与现状一致（观战默认开启），
只有房主显式关掉才拒绝新观众。

## 行为约定

- `room.state.allowSpectators`（默认 `true`）：房主用 `room.setSpectators {on}` 切换。
  - 关闭后**只拒绝新的观战席**：`room.spectate` 返回 `ERR.SPECTATE_OFF`；**已在场的观战者继续看**（房主仍可用 `room.removeSpectator` 手动移出）。
  - 房主专属（`ERR.NOT_HOST`）；`solo` 房间没有观战席，返回 `ERR.BAD_TARGET`。
  - 与前两个目录开关不同：**比赛进行中也可用**（比赛期间观战席本来就开放；`setInviteOnly`/`setRecruitWanted` 仍在开局后冻结）。
  - 房间目录行带 `allowSpectators`（`false` 时前端不显示「观战」按钮并给出关闭原因）。
- `recruitWanted`（期望路人加入）：比赛开始的一刻由服务端清成 `false`（目录行与房间面板同步消失）。理由：比赛进行中不能再进人，留着标签会引导玩家点进来却进不去。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `server/lobby.js` | `Room.allowSpectators`（默认 true）、`toState()` 与目录行带出该字段、`dispatcher` 新增 `room.setSpectators`、`setSpectators()`、`spectate()` 前置 `SPECTATE_OFF`、`startMatch()` 清 `recruitWanted` 并广播 |
| `shared/constants.js` | `ERR.SPECTATE_OFF` + 中文 `ERR_TEXT` |
| `shared/protocol.js` | 白名单 `room.setSpectators: { on: isBool }`（与 `setRecruitWanted` 同形） |
| `public/js/screens/room.js` | `roomAccessOptions().allowSpectators`（缺字段视为开启）、第三个开关（eye 图标「开启观战」，`onSpectators`）、`busy` 分组 `spectators` |
| `public/js/screens/lobby.js` | 目录行 `watchable` 加 `allowSpectators !== false`；`期望路人加入` 标签加 `!room.inMatch` |
| `public/i18n/{en,ja,ko,zh-TW}.json` | 新增 `开启观战`、`该房间已关闭观战`（4 包均已翻译） |
| `test/lobby.test.js` | 新用例（观战开关全流程）+ `roomAccessOptions` 默认值断言 |
| `test/lobby-list.test.js` / `test/match/lobby-integration.test.js` | 目录行新增字段、观战者载荷新增 `avatar` 的期望值同步 |
| `test/client-static.test.js` | `room.setSpectators` 协议断言；`index.html` 字体断言改为自托管（见下「顺带修好的红测」） |

## 验收与证据（本地，未部署）

- `node --test test/lobby.test.js test/lobby-list.test.js test/match/lobby-integration.test.js` → **78 / 78 通过**，其中新用例覆盖：默认开启、房主专属（`NOT_HOST`）、`solo` 拒绝（`BAD_TARGET`）、关闭后 `room.spectate` → `SPECTATE_OFF`、目录行 `allowSpectators:false`、重新开启后同一会话可入席、再次关闭时**已入席观众保留**、开局后 `recruitWanted` 变 `false`（房间态与目录行都验）、比赛进行中开关仍可用。
- `node --test test/client-static.test.js` → 381 / 382 通过（唯一失败见下）。
- `node tools/i18n.mjs check --all --strict` → 新增两条 msgid 四包齐全；zh-TW 仍有 39 条**既有**未翻译（`settings.js`/`skinPicker.js`，与本任务无关）。
- `node --check` 全部改动 JS 通过。
- 未跑：浏览器 e2e（`SP_E2E=1`）与真机；未截图（无 UI 结构改动以外的视觉变化）。

## 顺带修好的红测（非本任务引入，但阻塞本地验证）

1. `test/lobby.test.js:553/780/874`、`test/lobby-list.test.js:44`、`test/match/lobby-integration.test.js:192`：头像功能给房间载荷加了 `avatar`、本任务给目录行加了 `allowSpectators`，这些**精确载荷断言**没跟上 → 已补期望值。
2. `test/client-static.test.js:198`：TASK-036 自托管字体后，仍断言 `index.html` 含 `fonts.googleapis.com` → 改为断言 `/fonts/webfonts.css` 且**不含** `fonts.googleapis.com`。

## 已知遗留（不属本任务范围，需维护者定）

- `public/css/screens/game.css:734,814` 用了 `body:has(.unite-intro)` / `body:has(.round-intro)`，被 `test/client-static.test.js` 的兼容性守卫判为违规（Firefox ESR 115 / Safari < 15.4 不支持）。该两行来自已提交的 `0179f99a feat: publish recent game UI updates`，**与本任务无关**；修法是把 intro 挂载时给 `<body>` 加类（`body.has-intro …`）再删 `:has()`。

## 回退

- 未部署：撤销提交即可（`git revert <本任务提交>`）。
- 若已部署：`server/lobby.js` 需要 `systemctl restart sp2`；`shared/*`、`public/js/**`、`public/i18n/*.json` 为静态文件，换回旧文件即恢复（观战开关消失，房间行为回到默认开启）。

## 检查点

### 2026-10-14 23:05 — TASK-041 — DeepSeek（实现 + 本地验证）

- Action: 按 m05012 实现房主观战开关（默认开启、只拒新观众、比赛中也可用）并让「期望路人加入」在开局后从房间与目录一起消失；补协议/常量/i18n/客户端接线与用例。
- Result: 三个 lobby 测试文件 78/78 通过；client-static 381/382（唯一失败是既有的 `:has()` 违规）；i18n 新键四包齐全。
- Verification: 见上面「验收与证据」的命令与数字。
- Next: 维护者点头后部署（`install` + `systemctl restart sp2`，因为含服务端代码），再请他实测房间开关与开局标签。
- Production/GitHub: **未部署、未推送**；仅本地提交。
