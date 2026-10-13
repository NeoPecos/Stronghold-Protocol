# TASK-030 — 联防阶段入场动画

Status: released

Lead/Implementer: Codex

Starting commit: `90adad7a` (`integrate-upstream-0.2.3`)

Scope: 根据维护者提供的 9.64 秒原版视频，复刻进入联防时的中央黑橙横幅（两张联防表情、阶段标题、右侧双箭头）和顶部短暂橙色阶段提示。使用本地已有的 `hudPanel/trans_coop*.png` 与 `hudPanel/bg_coop.png`，复用现有 `PHASE.UNITE` 切换和 `defenceUnite` 提示音；开发预览增加重播按钮；仅限本地预览，不发布。

Protected: 不改对局协议、模拟、服务端、房间、原生客户端、其他阶段横幅或 TASK-028 已调整的顶栏尺寸/颜色；不新增游戏素材。

Acceptance: 进入联防时中间横幅从右滑入，橙色双箭头掠过后横幅渐退；顶部橙色提示先显示联防图标再显示短暂开始字样，消失后露出现有进度。重连/重新入场可重播，其他阶段沿用原横幅；不拦截点击。维护者自行视觉验收，代理不跑游戏测试或截图比对。

Rollback: 撤销本任务对 `public/js/ui/components.js`、`public/js/screens/game.js`、`public/css/screens/game.css` 的专属联防入场代码，以及 `public/dev/game-mock.js` 的重播入口；保留 TASK-028 的其他 HUD 修改。

Checkpoint: 已从原版视频抽取关键帧并确认中央/顶部时序；新增 `UniteIntro`，仅 `PHASE.UNITE` 使用，复用原有 `defenceUnite` 音效，其他阶段横幅未动。维护者反馈纯 2D 预览中看不见：入场横幅约 3 秒自动消失；开发预览 UNITE 切换器下已加“重播联防动画”，直接重挂同一个组件，不依赖 3D 渲染器，也不重置对局状态。随后维护者在 3D 预览指出中央几乎静止、顶部重叠：已将中央横幅改为明显的 800ms 右侧擦入、图标和标题分段入场、橙色扫光及双箭头移动；显示时长延至 3.4 秒。顶部联防提示播放期间隐藏原阶段胶囊，结束后恢复。开发预览重播按钮现在临时覆盖系统“减少动画”设置（结束后恢复）；正式界面仍尊重该设置。改动仅 `public/js/ui/components.js`、`public/js/screens/game.js`、`public/css/screens/game.css`、`public/dev/game-mock.js`；其中 game.css 的 TASK-028 脏改动未覆盖。未运行游戏测试、截图比对或 CI（维护者要求）；未部署、未推仓库。下一步：维护者刷新本地 `?phase=UNITE&render=engine`，点击“重播联防动画”验收动态和顶部位置。

Release: 维护者明确要求在视觉验收前先上线；2026-10-13 仅将 `public/js/ui/components.js`、`public/js/screens/game.js`、`public/css/screens/game.css`（同时含 TASK-028）静态热更新到 JING，备份 `/opt/sp2/backups/unite-hud-20261013-080054/old/`，详情见 `docs/releases/2026-10-13-unite-hud-static.md`。`public/dev/game-mock.js` 重播按钮仅本地使用，未发布。后续参考视频过场已单列为 TASK-031 并已上线。
