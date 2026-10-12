# TASK-006 — Push TASK-003 and deploy the wheel to production

Status: `accepted` (Codex re-review passed 2026-10-12)

Lead: Codex (review pending)

Implementer: DeepSeek

Starting commit: `8e97423d`

## Goal

Put the TASK-003 circular deployment wheel in front of real players: commit and push the already-implemented change,
then deploy its three runtime files to the live `sp.bs.leio.fun` service.

## Authorization

The maintainer authorised this explicitly on 2026-10-12 (chat): "1、2授权部署". This file records that grant because
`AGENTS.md` requires push/deploy to be authorised by a task file rather than by conversation. It does not replace the
Codex review.

Scope of the grant, as confirmed before execution:

1. Deploy now, without waiting for a Codex review (the maintainer was told the task is still `review_ready`).
2. Leave `latest.json` at Windows/Android `1.2.8` (code 11): deliberately **no** client manifest change, so existing
   native 1.2.8 installs also pick up the new wheel from the server's web assets. The maintainer accepted this.

## Scope

- Commit the nine working-tree changes of TASK-003 and push the branch to `origin`.
- Back up the three target files on JING under `/opt/sp2/backups/wheel-<timestamp>/`.
- Copy exactly three files into `/opt/sp2`: `public/js/ui/facing.js`, `public/js/ui/facingWheel.js`,
  `public/css/screens/game-panels.css`.
- Verify the deployed hashes and that the live page serves the new wheel.

## Protected areas

- **Do not** touch `/opt/sp2/public/client/latest.json`, the account/record files in `/var/lib/sp2/`, the room
  directory, or the custom combat HUD.
- **Do not** restart `sp2.service`: static assets are read from disk per request, and 12 matches were live at the time
  of writing. No restart, no SIGHUP.
- **Do not** deploy anything outside the three files. No `data/`, no `server/`, no `node_modules`, no `packs/`.
- **Do not** change game rules, golden results, version numbers or the update manifest.
- **Do not** merge the branch into `master`; that is the maintainer's decision.

## Acceptance checks

- `/opt/sp2/backups/wheel-<timestamp>/` holds the three pre-change files.
- Each deployed file's SHA-256 equals the local working-tree file's SHA-256.
- The live site serves the circular wheel markup (`.fwheel__quad` arcs / `.fwheel__subring`) and no server error.
- `/healthz` still reports `0.2.4` / build `7699325bd657`, and the service is still the same running PID.

## Current checkpoint

### 2026-10-12 18:13 — executed

- Commit: `198d5542` (TASK-003 implementation, 10 files). Pushed as a **new branch** on origin:
  `integrate-upstream-0.2.3` → `https://github.com/NeoPecos/Stronghold-Protocol`. Not merged into `master`.
- Backup: `/opt/sp2/backups/wheel-20261012-181314/`, holding the three pre-change files in their original directory
  shape plus `PRE-CHANGE.sha256`. Pre-change hashes were `85583b18…`, `bff8a0f3…`, `bfc1532b…` — byte-identical to the
  local baseline `e0231293`, confirming a clean single-source deploy.
- Deployed hashes now on JING (each equals the local working-tree file):

  | File | SHA-256 |
  |---|---|
  | `public/js/ui/facing.js` | `93cca5945e1b0fad9046a3e9c6fcb44f6c0b2462c74b16ab715c6a2ac21871d2` |
  | `public/js/ui/facingWheel.js` | `0d5ebe9469f77b50ca4ade6ad986d9e632e718fb4e848a315384dd7364cf0183` |
  | `public/css/screens/game-panels.css` | `9a31bf33e5172d9e51d69faf94118740ab97320721addbb4c3247e10db4a5252` |

- Service untouched: `MainPID=189578` and `ExecMainStartTimestamp=2026-10-12 02:57:14 CST` are unchanged before and
  after, `NRestarts=0`. No restart, no SIGHUP: `/js/ui/facingWheel.js`, `/js/ui/facing.js` and
  `/css/screens/game-panels.css` are all served from disk, so players pick the change up on reload. 14 matches were
  live during the deploy.
- Served content checked: the deployed `facingWheel.js` contains `fwheel__subring` and `fwheel__knob` and **no** longer
  contains the old diamond path `M0 -100 L100 0 L0 100 L-100 0 Z`; `facing.js` contains the `Math.atan2(dy, dx)`
  sector logic. All confirmed both on `127.0.0.1:3810` and through `https://sp.bs.leio.fun`.
- Live browser end-to-end: loaded `https://sp.bs.leio.fun`, imported the **deployed** `facingWheel.js`, rendered the
  wheel and dragged: circle `r=100`, 4 sectors, sub-ring, 2 axes, 4 chevron hit circles, dead-zone `r=33.333`; the
  drag showed the knob + beam, lit one sector and committed `RIGHT`. **No console or page errors.**
- Manifest untouched as authorised: `/opt/sp2/public/client/latest.json` sha256
  `efe977150b5487a48f886ba477bd22017555e8e50351cf4ac6655e71048bdf66`, `versionCode` still 11. No client was built or
  published.
- Next action: Codex review of TASK-003 (and of this deploy record). No further production action is pending.
- GitHub/production state: branch pushed; three files live on `sp.bs.leio.fun`; `latest.json`, accounts, records and
  the service process untouched.

### 2026-10-12 18:24 — review fix (documentation only)

- Trigger: Codex review found the rollback command wrong — it named bare source filenames in the backup root while the
  backup stores the files under `public/...`.
- Applied: rollback rewritten with the full relative paths (see the Rollback section). Verified on JING that the
  `public/...` paths exist in the backup and the bare names do not, so the old command would have failed.
- Scope respected: **no runtime file changed, nothing redeployed, no service restart, `latest.json` untouched, no merge
  to `master`.** The live files still hash `93cca594…` / `0d5ebe94…` / `9a31bf33…`, and `sp2.service` still shows
  `MainPID=189578`, `NRestarts=0`, started `2026-10-12 02:57:14 CST`.
- Docs check: `node --test test/docs-consistency.test.js test/docs-paths.test.js` 31/31 pass.
- Commit: the fix and this review note are the single commit whose message begins `TASK-006: 按 Codex 审核修正回滚命令
  路径（仅文档）`, directly on top of `1de69217` on `integrate-upstream-0.2.3`; pushed to
  `origin/integrate-upstream-0.2.3` and recorded in `docs/ops/2026-10.md`. Resolve it with
  `git log -1 --format=%H --grep='按 Codex 审核修正回滚命令路径'`. (A commit cannot carry its own hash: writing one in
  and amending changes the hash again, so the durable identifiers are the message and its parent.)
- Next action: Codex re-review of the corrected rollback documentation.

## Rollback

The backup holds the three files **under their original directory structure**, so restore from the backup root with
the full relative paths:

```bash
systemctl status sp2.service            # confirm it is still the same PID (no restart was performed)
cd /opt/sp2/backups/wheel-20261012-181314/
cp -a public/js/ui/facing.js /opt/sp2/public/js/ui/facing.js
cp -a public/js/ui/facingWheel.js /opt/sp2/public/js/ui/facingWheel.js
cp -a public/css/screens/game-panels.css /opt/sp2/public/css/screens/game-panels.css
```

Then verify each restored file against the hashes recorded in this file. No server restart and no data migration are
involved, so rollback is a plain file restore. Players pick the restored build up on their next page load.

> Correction (2026-10-12, Codex review): this section previously wrote `cp -a facing.js /opt/sp2/public/...` from the
> backup root. The backup keeps the `public/...` directory shape, so those bare source filenames do **not** exist and
> the command would have failed. Verified on JING: `public/js/ui/facing.js`, `public/js/ui/facingWheel.js` and
> `public/css/screens/game-panels.css` are present under the backup root; `facing.js`, `facingWheel.js` and
> `game-panels.css` are absent there. Only this documentation was changed — no runtime file, no redeploy, no restart.

## Review notes

### 2026-10-12 18:24 — Codex review (relayed by the maintainer)

- **TASK-003: passed.** Codex reported no runtime-code problems.
- Confirmed unmodified: `server/`, the placement protocol, the simulation logic, the custom combat HUD, room voice and
  the native Android runtime.
- Confirmed preserved (fork-only controls): the chevron tap, the `r=22` hit circle, the audio blip, keyboard operation,
  `boardDir` mirroring and the range preview.
- `assets-env-proxy`: Codex reports the test file matches the baseline and that base and implementation branch both
  pass, so the historical failure is not from this task. Note for the record: the implementer saw that test fail
  **identically on the stashed clean baseline** in this session (Node v24.16.0). Both observations agree on the
  conclusion that matters — pre-existing and unrelated to this change; they differ only on whether it passes on the
  baseline, and the cause sits in the runtime's `nodeHonoursEnvProxy` branch rather than in any file here. Nothing in
  TASK-003 or TASK-006 touches that test or the asset proxy code.
- **TASK-006: one correction required, applied** — the rollback section used bare source filenames from the backup
  root; the backup keeps the `public/...` structure, so those paths did not exist. Corrected to the full relative paths
  and annotated with the reason. **Documentation only**: no runtime file changed, nothing redeployed, no restart.
- Status: awaiting Codex re-review of this documentation fix. Not merged to `master`.
- Earlier note kept: TASK-003 was deployed **before** review, at the maintainer's explicit direction.

### 2026-10-12 18:37 — re-review passed

- Codex re-review passed. TASK-006 is `accepted` and TASK-003 with it; production stays as deployed.
- Nothing further was changed on the server for this: the live files still hash `93cca594…` / `0d5ebe94…` /
  `9a31bf33…`, and `sp2.service` still runs the same process that was never restarted.
