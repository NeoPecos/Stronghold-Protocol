# TASK-004 — Account-bound selectable player avatar

Status: `review_ready` (implemented and deployed at the maintainer's direction on 2026-10-13; Codex review pending)

Owner: DeepSeek (implementation + deploy); reviewer Codex

## Goal

Let an authenticated account select a player avatar that consistently identifies the player without allowing another
nickname session to overwrite it.

## Scope

- Store an avatar identifier on the existing account record; do not accept arbitrary external image URLs.
- Provide a curated selectable set from already distributed operator/avatar assets with a nickname-initial fallback.
- Display it in the title/lobby identity chip, room members, in-match team list, records and future room text chat.
- Keep alliance/band icons as separate gameplay information rather than replacing the player avatar.
- Define migration/default behavior for existing accounts.

## Protected areas

- No raw image upload in the first version.
- No asset redistribution beyond the existing client/resource policy.
- Do not weaken nickname/password ownership or expose account secrets through public room state.

## Acceptance checks

- Avatar choice persists across reconnects and devices for the same account.
- Invalid or unavailable avatar identifiers fall back safely.
- Public payload exposes only the selected identifier/resolved asset, never account credentials.

## Rollback

Ignore/remove the optional avatar field and restore nickname-initial fallback; existing account records remain valid.

## Preparation checkpoint

- Paper-Yuan does not provide a selectable account-avatar system. Its `PlayerAvatar` uses the alliance/band icon when
  present, otherwise the nickname's first character; bots use a robot glyph. This is effectively the same fallback as
  the current fork.
- Treat this as a new account feature, not a Paper-Yuan port.

## Checkpoints

### 2026-10-13 — DeepSeek（账号头像实现并上线 + 干员名补齐）

- **实现（17 个文件）**：新增 `public/js/ui/avatar.js`（`avatarStore`、`setAvatar`、`avatarUrl`、`myAvatarUrl`、`avatarChoices`、`installAvatarSync`：400 ms 防抖、RATE/TIMEOUT/OFFLINE 重试 1500 ms、welcome 后重推）与 `public/js/ui/avatarPicker.js`（`AvatarHost` + `AvatarPicker`：搜索框、「不使用头像」、210 格网格）；`shared/protocol.js` 新增 `AVATAR_LIMITS`/`isAvatarId` 与 C2S `account.avatar`；`server/accounts.js` 的 `PROFILE_KEYS` 增 `avatar`；`server/net.js` 增 `PROFILE_FIELDS['account.avatar']` 与 Session `avatar`；`server/lobby.js` 增路由与 `avatar()` 校验（未知 id 拒绝、`''` 表示清除），房间/观战/开局座位载荷带 `avatar`；`server/match/PlayerState.js`、`server/match/match/views.js` 透传；`public/js/main.js` 接入 `AvatarHost` + `installAvatarSync`，且在 welcome 时只在本地为空才采用账号值；`public/js/screens/lobby.js` 的 me-chip 头像改为按钮打开面板；`public/js/screens/room.js`、`public/js/ui/gameComponents.js` 渲染 `player.avatar`（回退顺序：头像 → 联盟图标 → 昵称首字）；`public/css/components.css` 增面板样式（字号一律 `calc(x * var(--t))`）；四套 i18n 各 +5 键（en 1300 / ja 1258 / ko 1257 / zh-TW 1259）。
- **上线（维护者「上线」）**：17 个文件装入 `/opt/sp2`，备份 `/root/sp2-backups/avatar-20261013-072958/`，重启后 active（build `dfb683bf296b`）；外网复核 `avatar.js` 200 / 5 644 B、`avatarPicker.js` 200 / 2 820 B、`components.css` 含头像面板样式、`en.json` 含 "Choose avatar"。
- **名字补齐（维护者「补上」）**：`data/chess.json` 只覆盖 210 个头像中的 85 个，其余会显示成 `char_xxx`。取官方 `character_table.json`（zh_CN，经 gh-proxy 镜像下载 15 069 101 B）生成 `public/js/ui/avatarNames.js`（125 条官方中文名；文件头写明来源与再生成命令），`avatar.js` 用它兜底 → **210/210 都有名字**。上线后外网复核 `/js/ui/avatarNames.js` 200 / 5 790 B（含「凯尔希」）、`/js/ui/avatar.js` 200 / 7 584 B（含 `AVATAR_NAMES`）。
- **边界与回退**：只动网页端 JS/CSS 与账号档案字段；未改版本号、客户端安装包、更新清单，未启用浏览器门禁。回退：清空账号里的 `avatar`（或不选头像）即回到「联盟图标 → 昵称首字」，账号记录仍然有效。
- **未做**：战绩界面的头像（records 屏）未接线，留待后续。
