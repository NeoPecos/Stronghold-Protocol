# 2026-10-13 联防入场与顶栏静态热修

Release scope: TASK-028 and TASK-030, as directly authorized by the maintainer before visual acceptance. No server restart, native package rebuild, version bump, updater manifest change or GitHub push. Client wrappers fetch CSS/JS from the server; their existing local asset bundles already contain `bg_coop.png`, `trans_coop1.png` and `trans_coop3.png` with the same SHA256 as production.

Source baseline: `90adad7a915d8416cf88ba62d5a817168d88be84` plus only the TASK-028/TASK-030 edits in these files. Production pre-deploy SHA256 equals the baseline SHA256 for all four.

| File under `/opt/sp2/public/` | Pre-deploy SHA256 | Target SHA256 |
| --- | --- | --- |
| `css/screens/game.css` | `1c6b0567f7e69e5c1c13392221ddc64e5e2317a10ad7bdff03678dd8b724f01c` | `3b99569c393223e57762b5f744d309d2aa8098f3ad260208abb6a495095b7fb6` |
| `js/ui/components.js` | `7ad1ac39cfb8d64c0485a412440dff0b1e6ff1f9c8e3f5f6a37ce111e341f6b5` | `ec44f8946ae9e9bb52e0c3f2df5ff14905d37fdc015c6d3bc10a347948a9565b` |
| `js/screens/game.js` | `86136dee56a1d6924a0d1c23b74bae1366162c65b76f058cb8d74c477e43b910` | `2bd48613ff03c290af0e3a8eb07b3d1fb74b5398df6cceaa027c7e67a264e1ec` |
| `js/ui/hud.js` | `33a6b1a5ba5414309aa818b473c3621451669a3cc45a4a606b823058b7b73dc4` | `2d6871a5926ef2e33b6e25c0adbce2782f1b0c8aa51830f4aef9e40fcff5c5e3` |

Deploy: back up the four originals under `/opt/sp2/backups/unite-hud-20261013-080054/old/`; stage the four target files under the same backup directory, check staged hashes and pre-deploy hashes, then replace each file by atomic rename. Do not restart `sp2.service` or interrupt matches.

Rollback: atomically restore the four files from `old/` after verifying the backup hashes. No service restart required. Existing clients may need to reload the page to fetch changed CSS/JS; full native installers and their local asset bundles are unchanged.

Verification: deployment hashes and service availability only. Per maintainer instruction, do not run gameplay tests, screenshot comparisons or CI; visual acceptance belongs to the maintainer.

Status: deployed on 2026-10-13. The four production files were replaced by per-file atomic rename after the original and staged hashes matched the table. A post-deploy read-back confirmed all four target SHA256 values, `/healthz` returned HTTP 200, and `sp2.service` remained active with the same PID `1093295`. No process or active match was restarted. Maintainer visual acceptance is pending; the next reference-video animation is not part of this release.
