# TASK-016 — Build and deploy the reviewed v0.2.5 increment

Status: `planned`

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

## Review notes

Codex separately reviews implementation acceptance, artifact integrity and production readiness. Passing TASK-015 does
not itself authorise a restart or client publication.

## Rollback

Restore the timestamped server backup and previous service environment, restore the previous client update manifest
and packages, restart, then repeat the health/account/room/record checks. Record actual paths and hashes in the release
file before deployment.
