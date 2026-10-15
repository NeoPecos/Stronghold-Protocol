# TASK-051 — Complete account-avatar catalog

Status: `planned`

Owner: unassigned

## Goal

Make searchable account avatars cover the requested operators, Elite 2 portraits and official skins, including Amiya and Goldenglow skins, without adding broken choices.

## Scope

- Extend the asset planner/fetcher from its current autochess-only operator/skin subset using authoritative character and skin tables.
- Add avatar-only entries where an operator is not playable in this mode; do not download unneeded battle Spine, voice or skills for those entries.
- Regenerate the ignored asset manifest and deploy the actual images/CDN keys as a separate asset publication step.
- Reconcile official Chinese names and skin names used by search, and ensure account avatar IDs resolve identically across clients.

## Protected areas

- Do not hand-edit generated `data/assets.json`, invent URLs, or claim that a skin is available before the image exists.
- Do not change operator gameplay rosters, client update manifests, versions or production without separate approval.
- Do not run tests/builds/screenshots without maintainer authorization.

## Acceptance checks

- Searching 阿米娅 yields existing base/E2/skin avatar files; searching 澄闪 yields all sourced installed skins.
- Every result's URL resolves to an installed image and remains visible for other players after account sync.
- Search remains empty before typing and shows thumbnails only after typing.

## Checkpoint

- 2026-10-15 local/live investigation: `data/assets.json` has no `char_002_amiya` and no `skins` on `char_377_gdglow`; their source images are also absent from the local installed asset tree. The picker already enumerates everything in the manifest, so changing only its filter cannot fix the missing avatars.
- No implementation, asset download, tests, deployment or Git push yet.

## Rollback

Restore the previous asset manifest/CDN key set and avatar planner changes; account avatar IDs that no longer resolve fall back to the existing neutral icon.
