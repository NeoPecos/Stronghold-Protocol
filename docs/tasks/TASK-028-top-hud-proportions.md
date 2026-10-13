# TASK-028 — 顶栏边框与比例调整

Status: released

Scope: 两侧查看按钮各自显示完整四角框；按维护者提供的原版截图调整中框、休息胶囊、回合数与生命图标比例。

Protected: 不改战斗规则、房间、服务端、其他 HUD 区域或素材文件；不发布客户端包、不部署线上。

Acceptance: 两个查看按钮各有左右两组四角线；中间黑框更厚、休息胶囊更醒目，回合数字和生命图标不再挤占框内。由维护者自行视觉验收，不由代理运行截图或测试。

Rollback: 撤销 `public/js/ui/hud.js` 的两个按钮容器及 `public/css/screens/game.css` 对应的顶栏尺寸与边框改动。

Checkpoint: 已将 `.brackets` 从整条 `.gtop__center` 移到左右两个查看按钮容器；中框保持素材原始宽高比并放大，休息胶囊放大，回合数字和生命图标缩小。根据维护者后续反馈，中框再加宽到普通 7.6rem／首领 9.6rem，改为左右等宽三栏，让回合与生命值分别居中且与休息胶囊等距，并增加两端内缩以避开框线；“回合”文字放大到 .2rem；休息胶囊通过局部滤镜由偏蓝青转为与生命值一致的柔和薄荷绿，未改素材。维护者后续截图指出联防胶囊上沿与外框未贴合，已将 `.capsule--unite` 高度对齐中框的 .58rem；TASK-030 入场顶部提示同步定位到中框上沿。仅改 `public/js/ui/hud.js` 与 `public/css/screens/game.css` 的 TASK-028 部分，未改客户端包。按维护者要求未运行游戏测试或渲染截图；维护者现授权静态上线，待发布记录补全。

Release: 维护者明确要求在视觉验收前先上线；2026-10-13 仅将 `public/js/ui/hud.js` 与 `public/css/screens/game.css`（同时含 TASK-030）静态热更新到 JING，备份 `/opt/sp2/backups/unite-hud-20261013-080054/old/`，详情见 `docs/releases/2026-10-13-unite-hud-static.md`。服务未重启，维护者仍可反馈视觉微调。
