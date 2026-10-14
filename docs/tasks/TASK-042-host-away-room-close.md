# TASK-042 — 房主长时间不在线自动关房间

Status: `review_ready`（已实现、已测试，未部署）
Lead: Codex
Implementer: DeepSeek（2026-10-14，维护者要求）
Starting commit: `ff567f72`

## 背景

维护者（2026-10-14）：**「一个房间里面房主十分钟不在线就直接关房间吧」**。

大厅目录会把房间标成「近 5 分钟操作 N 人」，但**房主不在的房间永远不会自己消失**：只有房主能 `room.start`
（`room.start` 是 host-only），所以这种房间挂在目录里既没人能开局、也没人清理。断线有既有的宽限机制
（`lobbyGraceMs` 60 s 释放座位 → 主机迁移 → 没有真人的房间释放），但「客户端一直开着、人不操作」不触发任何机制。

## 范围

- `server/lobby.js`
  - 新增可调参数 `hostAwayMs`（默认 `10 * 60_000`；`0` = 关闭该功能），同时进 `LOBBY_DEFAULTS` 的说明行。
  - 构造时按 `hostAwayMs / 10`（夹在 5–60 s）起一个 `unref()` 的 `setInterval` 调用 `sweepHostAway()`；`shutdown()` 里 `clearInterval`。
  - `sweepHostAway()`：遍历房间 → 跳过 `room.disposed` 与**正在对局**（`room.match`）的房间 → 取房主 session
    （`registry.byId(room.hostId)`；房主已换房间则跳过）→ `since = session?.lastInputAt ?? room.createdAt` →
    `now - since >= hostAwayMs` 时 `session.notice = 'host_away'` 并 `disposeRoom(room, 'host_away')`，返回关闭数量。
  - 「不在线」= 没有输入：`user.activity` 只在真实 pointer/key 输入时发送（`public/js/main.js:365`），
    `server/net.js:647-654` 用它、`ACTIVITY_TYPES` 与 `g.*` 刷新 `lastInputAt`，因此挂着不动的客户端会自然变成 away。
  - 断线不归这里管：`startGrace` 在 `lobbyGraceMs` 后释放座位（随后主机迁移或房间释放）。
- `server/http/config.js`：`hostAwayMs` 进 `LOBBY_OPTION_KEYS`，可由 `data/config.json` 的 `lobby` 段覆盖。
- `public/js/main.js`：`CLOSE_REASON` 增加 `host_away: N_('房主长时间未操作，同盟已关闭')`。
- `public/i18n/{en,ja,ko,zh-TW}.json`：四包补该 msgid（`tools/i18n.mjs seed`；ja / zh-TW 由脚本插入，工具当时跳过了这两包）。
- `test/lobby.test.js`：新增 `lobby host-away sweep` 四例。

## 保护范围

不改开局 / 准备 / 主机迁移规则；不改 AI 座位与目录排序；**不关正在进行的对局**（若维护者要连比赛一起关，去掉
`sweepHostAway` 里的 `room.match` 跳过即可）；本任务未部署（服务端代码需 `systemctl restart sp2`）。

## 验收

- `node --test test/lobby.test.js` → **75/75**（含新增 4 例：房主 away → `room.closed{host_away}` 且房间从目录消失；
  有输入的房间不动；对局中的房间不动；`hostAwayMs: 0` 关闭功能）。
- `node --test test/lobby-list.test.js test/lobby-kick.test.js` → 7/7。
- `node --check` 全部改动 JS；`node tools/i18n.mjs check en ja zh-TW --strict` 新 msgid 四包齐全
  （ja/ko/zh-TW 仍有 39 条既有缺口，en 100 %）。

## 检查点

### 2026-10-14 23:20 — TASK-042 — DeepSeek（房主 10 分钟无操作自动关房间）
- Action: 上面的实现、四包 i18n、四例测试。
- Result: 新增 4 例通过；`test/lobby.test.js` 整文件 75/75。
- Verification: 上面的命令输出。
- Next: 维护者确认后部署（需重启 sp2）；待确认「比赛进行中是否也照关」（当前不关）。
- Production/GitHub: 未部署、未推送（仅本地提交）。

## 回退

`git revert <本任务提交>`（纯代码，无数据 / 素材改动）；若已部署，回退后 `systemctl restart sp2`。
