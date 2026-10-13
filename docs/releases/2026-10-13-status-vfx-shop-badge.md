# 2026-10-13 status VFX and funds badge static hotfix

Release scope: TASK-027. No server restart, native package rebuild, version bump, internal updater change, or GitHub push. The Windows and Android wrappers request CSS and JS from the server; their local bundles cover only assets/fonts/vendor.

Production target: `/opt/sp2/public/` on JING (`sp2.service`). The deployed files and SHA256 values are:

| File | SHA256 |
| --- | --- |
| `css/screens/game-shop.css` | `adf4e45da899b753233f8212a93f4234df973de24a45d85fec01e6ff0fdf2931` |
| `js/render/app.js` | `8cea996f151e92565fc0a0343b218fded299c4b17c701db2eb2c8ae91126b21c` |
| `js/render/units.js` | `97d6cec86ee6dc288816caa37f70c697fcb82388b909dd0272d0396b9fcc62e7` |
| `js/render/statusAura.js` | `7b621ff41ffe1084125997af893ccc8687f247f4ee219616ecadfb29365f42f1` |

Source baseline: `90adad7a915d8416cf88ba62d5a817168d88be84` on `integrate-upstream-0.2.3`, plus only the listed local edits. Production `units.js` already contained an equipment-slot hotfix absent from that commit; its diff against the deployed file was confined to the new status effect. Other local renderer, dev-preview, and lighting changes were excluded.

Backup: `/opt/sp2/backups/status-vfx-shopbadge-20261013-90adad7a/old/` contains the three replaced files; `statusAura.js` did not exist before this release. The same backup directory contains staged files and `stage/deploy.sh`.

Deployment: staged file and production baseline SHA256 checks passed, then all four files were installed with atomic per-file renames. Read-back SHA256 values matched the table. `sp2.service` remained active with unchanged PID `935232`; no process or match was interrupted. No gameplay/UI tests were run by the agent, per maintainer instruction. `/healthz.build` remains the process-start tag until a later normal restart, so already-open clients need a manual refresh to load the new modules.

Rollback: restore `old/css/screens/game-shop.css`, `old/js/render/app.js`, and `old/js/render/units.js` to their matching locations under `/opt/sp2/public/`, then remove `/opt/sp2/public/js/render/statusAura.js`. Do not restart `sp2` solely for this rollback while a match is active. The maintainer should visually accept the result after refreshing a client.
