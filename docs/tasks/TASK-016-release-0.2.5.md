# TASK-016 — Build and deploy the reviewed v0.2.5 increment

Status: `in_progress` (server half deployed 2026-10-13 by direct maintainer order; client packages, update manifest and
Codex review still open)

Lead/reviewer: Codex

Implementer/release operator: DeepSeek after Codex approval

Starting commit: `TBD — the accepted TASK-015 release commit`

## Goal

Publish one real, verifiable incremental update containing the accepted v0.2.5 integration and TASK-014 top-HUD art,
then deploy the matching server build with backups and rollback evidence.

## Prerequisites

- TASK-014 and TASK-015 are `accepted`; no `review_ready`, dirty or unreviewed implementation enters the release.
- Re-read production truth immediately before packaging: server version/build, Windows/Android client manifests,
  deployed hotfix hashes, environment flags and active-match policy.
- Choose and record the client release number before building. Do not reuse a version number for different bytes and
  do not publish another empty increment.

## Scope

- Freeze the exact release commit and generate a release manifest listing every server/client file and SHA256.
- Build the full reference package plus a genuine incremental package from the currently deployed client baseline.
- The increment must include the changed TASK-014 assets at the existing manifest paths:
  `public/assets/ui/hudPanel/frame_mid_normal.png` (`4FA2E8DC…5704`) and
  `public/assets/ui/hudPanel/bg_rest.png` (`4B0EDA5E…64BA`).
- If official-scene support is accepted, keep scene art optional/local and document the full-package size impact;
  never pretend the incremental package contains scene bundles it does not carry.
- Build and sign Windows and Android clients from the same frozen source and record their actual embedded version,
  asset source and update endpoint.
- Back up production source/config/data/databases/assets/service definitions before server replacement.
- Deploy only the accepted files, preserve production-only configuration and database contents, then validate health,
  rooms, accounts, records/cards, match creation, spectator flow and client update delivery.

## Protected areas

- No deployment from the current dirty checkout, no old archive, no hand-built zip and no package whose manifest does
  not match its bytes.
- No production database replacement, account reset, nickname reassignment or record migration without a separate
  reviewed migration and backup.
- No accidental re-enabling/disabling of the browser gate, CDN or room voice.
- Do not interrupt active matches unless the maintainer explicitly overrides the release policy at deployment time.
- Do not upload official extracted art to Git.

## Acceptance checks

- Full and incremental packages install into clean directories and start successfully.
- A real deployed-baseline → new-version update test proves both clients receive changed code and TASK-014 art.
- Package contents, update manifest, signatures and published download hashes agree byte-for-byte.
- Server dry run and database compatibility checks pass before restart.
- Post-deploy: `/healthz`, public domain, room create/join/watch, account login, duplicate-name rejection, records/cards,
  one short match, Windows update and Android update all pass.
- Backup path, service rollback command, previous client manifest and rollback validation are recorded before rollout.
- On any failed gate, restore the backup and previous update manifest, then report the exact failure.

## Current checkpoint

- Release task created only; no artifact, version, hash or deployment is approved yet.
- Current production truth in `PROJECT-STATUS.md` says server `0.2.4` and both clients `1.2.8`, but TASK-016 must
  re-read those values from production rather than trust this planning snapshot.
- Exact next action after TASK-015 acceptance: create/update the durable release file under `docs/releases/`, freeze
  hashes, then perform clean full/incremental build validation before requesting deployment approval.

### 2026-10-13 01:52 — TASK-016 — DeepSeek (server-only 0.2.5 deployment, direct maintainer order)

- The maintainer ordered the pushed integration (`9497533d`, origin `17e1f92a`) live immediately, waiving this task's own
  prerequisites (TASK-014/TASK-015 Codex acceptance, release-manifest file, client packages).
- Deployed the **server half only**: 174 paths (125 replaced + 48 added) copied over `/opt/sp2` from the local checkout
  after a hash comparison against production (`data/config.json` byte-identical and left alone; `test/`, `docs/`,
  `public/assets/`, `data/local-assets.json` untouched). `package.json` differs only in the version string, so
  `npm install` was unnecessary.
- Backup before extraction: `/root/sp2-backups/sp2-pre-025-20261013-015200.tgz` (1 211 576 496 B). Evidence directory:
  `/root/sp2-backups/deploy-025-20261013-015200/` (`deploy-paths.txt`, `pre-deploy-sha.txt`, `replaced-files.txt`,
  `added-files.txt`, `notes.txt`).
- Verified: 117 changed JS files pass `node --check`; `sp2.service` active; `/healthz` on 127.0.0.1:3810 and
  `https://sp.bs.leio.fun/healthz` both `{"app":"0.2.5","build":"c13af814d77f"}`; native UA (`SPClient/Windows`,
  `SPClient/Android`) receives the game page (200, 9 598 B, references `room-chat.css`) while browsers still receive the
  bandwidth notice; the six new static files return 200; journal has no error/exception.
- Not done here (still TASK-016 work): Windows/Android `1.2.9` packages, the update manifest, TASK-014 art in a package,
  the durable release file, and clean full/incremental build validation.
- Rollback: `systemctl stop sp2` → `tar xzf /root/sp2-backups/sp2-pre-025-20261013-015200.tgz -C /opt/sp2` → delete the
  paths in `added-files.txt` → `systemctl start sp2`.
- Known CI failures on the deployed revision `9497533d` (pre-existing, not introduced by the deployment):
  `test/version.test.js` expects the newest `CHANGELOG.md` entry to be `0.2.5` (it is `0.2.4`) and a style assertion
  rejects `public/css/room-chat.css: .quick-match p { font-size:.11rem }`.

## Review notes

Codex separately reviews implementation acceptance, artifact integrity and production readiness. Passing TASK-015 does
not itself authorise a restart or client publication.

## Rollback

Restore the timestamped server backup and previous service environment, restore the previous client update manifest
and packages, restart, then repeat the health/account/room/record checks. Record actual paths and hashes in the release
file before deployment.
