# TASK-059 — Consolidate and push unreleased source

Status: `in_progress`

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

- The 0.2.6 merge was still in progress (`MERGE_HEAD` pointed at upstream `v0.2.6`). Its resolved index was committed as `7d531227`; the previously unstaged task work was left untouched.
- The four local commits add the spectator switch, a ten-minute host-away room close, an experimental phase-banner dock and its revert. Their spectator/host-away behavior is already present in the current dirty tree; merging the branch must not undo the present UI.
- No project tests or build were run. Next: record and commit the remaining dirty source, merge the local branch with conflict review, then push only the Git branch and update this checkpoint.

## Rollback

Before push, keep the existing checkout history and resolve conflicts without resetting work. After push, revert or amend only with the maintainer's direction; production is unchanged.
