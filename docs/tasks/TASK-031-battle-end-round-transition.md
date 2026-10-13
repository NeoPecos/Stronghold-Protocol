# TASK-031 — 作战结束与下一回合过场

Status: released

Lead/Implementer: Codex

Starting commit: `90adad7a915d8416cf88ba62d5a817168d88be84` (`integrate-upstream-0.2.3`), plus the already-deployed TASK-028/TASK-030 local edits.

Scope: 按维护者提供的 7.43 秒原版视频，复刻 `SETTLE` 时的黑绿“作战结束／完美作战！”面板，以及 `ROUND_START` 到 `PREP` 的黑色三栏回合／获得资金过场和顶部从联防转为休息的切换。优先用现有 `ui/roundStartDialog/*` 本地素材；不增加新素材、服务端字段或数值规则。只在本地开发预览，未经再次授权不发布。

Protected: 不改服务器、模拟、房间/账号、结算数值和音效映射，不覆盖 TASK-028/TASK-030 顶栏尺寸/颜色，不重打包客户端或触碰 CDN。

Acceptance: 第一段面板于战斗结束时滑入，正确呈现已有的无伤/扣血文案；第二段显示当前回合与已知的实际资金增量，数字从上回合切到新回合，随后顶部露出休息胶囊。未知资金增量不编造数值；同一预览入口可重复播放，系统减少动画时仅开发预览临时强制播放。维护者自行视觉验收，代理不运行游戏测试、截图比对或 CI。

Rollback: 撤销本任务在 `public/js/ui/components.js`、`public/js/screens/game.js`、`public/css/screens/game.css`、`public/dev/game-mock.js` 的新增过场代码，保留已发布 TASK-028/TASK-030 的改动。

Checkpoint: 已只读抽取原版视频关键帧：约 0.5–3.3 秒为“作战结束／完美作战！”绿框，约 4.8–7.4 秒为三栏“回合 04→05／获得 +12”，顶部于后段从联防进度切到休息胶囊。现有 `ui/roundStartDialog` 表情、背景纹理与资金图标已复用，且这些文件存在于 1.2.9 客户端资源包。已完成两段展示、战斗起始资金差额计算、结算文案、本地“播放作战结束→下一回合”入口；仅运行 JavaScript 语法、JSON 与素材路径检查，未运行游戏测试、截图比对或 CI。

Release: 维护者明确要求完成后立即上线。2026-10-13 已将八个静态文件热更新到 JING，备份 `/opt/sp2/backups/battle-end-round-20261013-122950/old/`；目标哈希回读一致，`/healthz` HTTP 200，`sp2.service` active 且 PID `1131763` 未变。未重启或中断对局；开发预览入口未上传正式服。详情见 `docs/releases/2026-10-13-battle-end-round-transition.md`。
