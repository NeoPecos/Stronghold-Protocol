# TASK-059 — Consolidate and push unreleased source

Status: `review_ready` (source Git checkpoint only; gameplay tasks remain pending validation)

Owner: Codex

Starting point: detached `4c517699`, an unfinished upstream v0.2.6 merge, substantial staged and unstaged work through TASK-058, and four additional local commits on `integrate-upstream-0.2.3` in another checkout. Remote target: `origin/integrate-upstream-0.2.3`.

## Goal

Preserve and reconcile all existing source work and the four local commits, then push the resulting source history to the requested remote branch. This is a Git checkpoint, not a game release.

## Scope

- Finish the already-resolved upstream 0.2.6 merge without discarding later work.
- Commit the remaining local source and task records as an explicitly unvalidated checkpoint.
- Include the other checkout's four commits by ancestry, retaining the current UI and reconciling overlapping features rather than overwriting files.
- Record the final commit and remote state in the current-status and operation log.

## Protected areas

- Do not deploy, restart a service, publish client packages or update version manifests.
- Do not run project tests, builds, screenshots or evidence-style checks without a separate maintainer request.
- Do not reset, clean or overwrite either checkout; preserve the current UI and production hotfixes.

## Acceptance

- The requested remote branch contains the 0.2.6 merge, all current source edits and all four additional local commits in its ancestry.
- The source documents explicitly say TASK-045/052/054/057/058 multiplayer and boss work remains unvalidated and not deployed by this Git operation.
- The working tree is clean after the source checkpoint; remote and local tip match.

## Checkpoint

- The unfinished upstream 0.2.6 merge became `7d531227`; the remaining local TASK-039–058 source and documentation became the explicit pending-validation checkpoint `59d56666`.
- The four other-checkout commits add the spectator switch, ten-minute host-away close, experimental phase-banner dock and its revert. The current source already contains the first two behaviors with newer names and UI. A normal merge conflicted on those differing APIs and UI; merge `cb18947a` includes all four commits by ancestry while deliberately retaining the current source snapshot. The older branch variants, docs and tests were not copied over the newer implementation.
- `git push origin HEAD:refs/heads/integrate-upstream-0.2.3` succeeded to `cb18947a`. The other checkout still has uncommitted edits and its local branch remains at `ef35dfe9`; it was not touched.
- No project tests, build, screenshot or gameplay verification were run. No deployment, service restart, package update or version bump occurred. TASK-045/052/054/057/058 remain pending maintainer validation before release.

## Rollback

Before push, keep the existing checkout history and resolve conflicts without resetting work. After push, revert or amend only with the maintainer's direction; production is unchanged.
