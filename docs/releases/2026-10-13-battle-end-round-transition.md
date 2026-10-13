# 2026-10-13 作战结束与下一回合过场

Release scope: TASK-031，维护者明确要求上线。静态热更，不重启 `sp2.service`，不重打包客户端，不改服务端、协议、CDN、版本号或更新清单。

Source baseline: `ec5787bb6d4328f3fa908dbade7198b62d0d80e3` plus the TASK-031 edits in the files below. Existing local work from other tasks remains separate in the worktree and is not included in this release list.

| File under `/opt/sp2/public/` | Pre-deploy SHA256 | Target SHA256 |
| --- | --- | --- |
| `css/screens/game.css` | `3b99569c393223e57762b5f744d309d2aa8098f3ad260208abb6a495095b7fb6` | `da49b186f49c50f80ab26f9bbf0e4b558906ca0fdb491fac55a0196a51d4a4fe` |
| `js/ui/components.js` | `ec44f8946ae9e9bb52e0c3f2df5ff14905d37fdc015c6d3bc10a347948a9565b` | `53aef27730a4dd52f55357fb9adc5cfdec08c8933351bc0f4e9ef5aea3f59fad` |
| `js/screens/game.js` | `2bd48613ff03c290af0e3a8eb07b3d1fb74b5398df6cceaa027c7e67a264e1ec` | `d49efbc864dbe339d30bc891560ef19bf59a04c4d2c3746f448b04423474db5c` |
| `js/ui/gameLogic/phases.js` | `8657e5d084489a2862ad6a5cb07a8f79869caaab485483b4c98d2f870c98b27b` | `26a1ea439f1ae7f37e34778432fe2261fd8d746f6ae9a6185aa05902042fee5c` |
| `i18n/en.json` | `29667d7057825f875bf7b4c800e32980416ea2b40252a1c99cd63a13295ad49d` | `8a68db03d96ee3110a905bd1cb557e5ad53ee3725916163e7420d462122b9943` |
| `i18n/ja.json` | `5ed7d9e6576d20f9f301232ad171e94a0ba16bb7c02c759a8e368ad6b185a6bb` | `9fb37ac67c147abd4dd7ad7df0d010a0f2ec9d6394657af17a4633c29d77dbc8` |
| `i18n/ko.json` | `174e2ebcd84058932ff7f1954ebe4a866ba32beacfe7e65140de3875c942e2ce` | `9da3d34f34cafbec68419f9ec615f5ab4ef4e018e5a0b24275cc8daf0f57d378` |
| `i18n/zh-TW.json` | `ebde23214b9de0852e39e318ea988031b7524112222e2dd117a37979f16396ac` | `226db792dd7364eada2bdc03e46ff8f9bec72539cc333522af2782323cdeddb2` |

The existing `public/assets/ui/roundStartDialog/*` and `hudPanel/icon_battle.png` were already present on the server and in the 1.2.9 client bundle; no asset upload or native package rebuild is needed.

Backup: `/opt/sp2/backups/battle-end-round-20261013-122950/old/` contains the eight replaced originals. Each file is installed by atomic rename after the pre-deploy hash check.

Behavior: settlement keeps the existing authoritative LP result and now uses `完美作战！` for zero loss. `ROUND_START` shows the real observed funds delta captured at combat start; if unavailable, it omits the number. The local development switcher adds a repeatable full-motion preview and is not deployed.

Verification: changed JavaScript syntax, JSON parsing and referenced asset paths passed. No gameplay tests, screenshot comparisons or CI were run per maintainer instruction. After deployment, re-read all eight hashes, `/healthz`, and `sp2.service` status/PID.

Rollback: restore the eight files from `old/` to their original paths with atomic rename; do not restart `sp2.service` solely for this static rollback.

Status: deployed 2026-10-13; repository commit/push recorded separately after the production read-back.
