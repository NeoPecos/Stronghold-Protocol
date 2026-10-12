# TASK-006 — Push TASK-003 and deploy the wheel to production

Status: `in_progress`

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

- Completed: TASK-003 implementation (see that file); both authorisation points recorded above.
- Changed files and provenance: the three wheel files come from this fork's own checkout at baseline `e0231293`, whose
  pre-change hashes were proven **byte-identical** to `/opt/sp2` before deploying. No other agent's work, no upstream
  or Paper-Yuan tree, and no production hotfix is mixed in.
- Tests run: see TASK-003's checkpoint (golden 287/287; targeted units 148; E2E 30; eslint 0 errors; the single
  `assets-env-proxy` failure is pre-existing and reproduced on the clean baseline).
- Exact next action: execute the deployment steps in order, then append the result to `docs/ops/2026-10.md`.
- GitHub/production state: recorded after execution below.

## Rollback

```bash
systemctl status sp2.service            # confirm it is still the same PID (no restart was performed)
cd /opt/sp2/backups/wheel-<timestamp>/
cp -a facing.js        /opt/sp2/public/js/ui/facing.js
cp -a facingWheel.js   /opt/sp2/public/js/ui/facingWheel.js
cp -a game-panels.css  /opt/sp2/public/css/screens/game-panels.css
```

Then verify each restored file against the hashes recorded in this file. No server restart and no data migration are
involved, so rollback is a plain file restore. Players pick the restored build up on their next page load.

## Review notes

(Codex: TASK-003 was deployed **before** review, at the maintainer's explicit direction. Review accordingly.)
