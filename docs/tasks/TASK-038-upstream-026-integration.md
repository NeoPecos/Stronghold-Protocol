# TASK-038 — 合并上游 0.2.6

Status: `released`
Lead / implementer: Codex
Starting commit: `4c517699` (`integrate-upstream-0.2.3`), upstream tag `v0.2.6` = `488db49f11daf862b67ce26fa4cf89aa6cba2466`.

## Scope

Merge the upstream source release into the fork in an isolated detached worktree. Preserve fork-specific features, current production behavior, existing CDN and native-client compatibility unless the maintainer directs otherwise. Resolve overlapping code and documentation deliberately; do not substitute the upstream package for the fork.

## Protected areas

- The main checkout contains uncommitted work on UI, the notice, mobile rendering, task records and tests. Do not stash, reset, copy over, or commit it.
- Do not deploy to JING, publish to GitHub, rebuild native packages, touch client update manifests, or change production timer/config as part of the source merge.
- Preserve the fork's account, room, match, asset and UI extensions. Do not change golden results merely to clear conflicts.

## Acceptance

- The isolated merge contains upstream `v0.2.6` ancestry and no unresolved markers or unmerged paths.
- Review every overlap between the upstream release and fork customizations; note any intentionally deferred integration.
- Update current-state docs and provide the maintainer with the exact isolated worktree path and any remaining release steps.
- Per maintainer rule, do not run project tests, lint, screenshots or CI without explicit instruction.

## Rollback

Before integration into the main checkout, abort the merge or remove the isolated worktree; the main checkout and production stay unchanged. After an eventual local merge commit, revert that merge only with maintainer coordination. No production rollback is needed unless a separate deployment is requested.

## Checkpoint

2026-10-13: Fetched official `v0.2.6` and started `git merge --no-commit --no-ff` in `F:\DSH-workspace\stronghold-026-integration`. Resolved the 35 initial conflicts without changing the main checkout or golden results, then overlaid the main checkout's current UI/runtime edits in this isolated tree. The maintainer chose to preserve the fixed-path CDN/native clients and add safe browser hash caching. Hashed URLs stay on the origin; plain URLs retain the existing CDN because redirecting a hash URL to a fixed CDN key could reuse stale bytes. TASK-039 adds shared-UI pre-cache and reuses match-specific warmup. At 19:55 +08, the maintainer explicitly ordered deployment and browser opening after three minutes regardless of active matches: the frozen 52-file runtime artifact was deployed, five matches were interrupted, and production reports `0.2.6` build `a25d24fec134`. Details and rollback: `docs/releases/2026-10-13-browser-precache-026.md`. No project tests, merge commit or GitHub push; source review remains pending.
