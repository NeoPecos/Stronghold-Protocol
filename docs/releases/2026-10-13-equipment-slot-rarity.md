# 2026-10-13 装备槽普通/金色状态静态热修

Status: `ready`

Release scope: TASK-032. 修正干员头顶装备槽读取装备 `isGolden` 的显示逻辑；普通装备显示白色，金色装备显示金色，空装备不显示槽位。未安装 `ui-hub-package-20261013.zip`。

Source commit: `a7b6df3b` (`integrate-upstream-0.2.3`).

Protected: 服务端、战斗模拟、账号/房间、原生客户端、CDN、版本号、客户端更新清单和签名文件均不变。只替换两个浏览器静态 JS 文件，不重启 `sp2.service`。

## Files

| File under `/opt/sp2/public/` | Pre-deploy SHA256 | Target SHA256 |
| --- | --- | --- |
| `js/render/app.js` | `8cea996f151e92565fc0a0343b218fded299c4b17c701db2eb2c8ae91126b21c` | `38db397d6417eb7c9ff3f12a5b09283b5d514aa5ae7503d209aea48a9ed8ab53` |
| `js/render/units.js` | `97d6cec86ee6dc288816caa37f70c697fcb82388b909dd0272d0396b9fcc62e7` | `5ae3486fa326758a86a94aa05fb4558792f416be311433e832eac21adbedf80e` |

## Deployment

- Backup root: `/opt/sp2/backups/equipment-slot-rarity-a7b6df3b/old/`.
- Stage both files under `/opt/sp2/backups/equipment-slot-rarity-a7b6df3b/stage/`.
- Verify staged hashes and current production hashes before each atomic rename.
- Do not restart `sp2.service`; existing clients need a page refresh to load the new modules.

## Verification

- Pre-deploy `/healthz` and service state must be readable; active matches are allowed because no process restart occurs.
- Post-deploy read back both SHA256 values, `/healthz`, and service PID.
- No gameplay tests, screenshot comparisons or CI are run by the agent; visual acceptance belongs to the maintainer.

## Rollback

Restore `old/js/render/app.js` and `old/js/render/units.js` atomically to their original paths. Do not restart `sp2.service` solely for this static rollback.
