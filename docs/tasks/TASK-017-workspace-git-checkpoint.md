# TASK-017 — Freeze the current workspace into reviewable Git checkpoints

Status: `planned`

Lead/reviewer: Codex

Implementer: DeepSeek

Starting commit: `a0503d46a8d54e7d435e667493539ac017e1a6e9`

Branch: `integrate-upstream-0.2.3`

Remote baseline: `origin/integrate-upstream-0.2.3` at
`7bc9a3c7f2391538fdaf6c0a3dc3f2f706c02845` (local branch is already seven commits ahead)

## Goal

Turn the current shared working tree into small, attributable local commits that Codex can review and then push to
the existing origin branch, without losing ignored art, rewriting history or mixing the future v0.2.5 integration.

## Non-negotiable safety rules

- Do not run `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`, rebase, merge, cherry-pick or stash.
- Do not create or switch branches. Work only on the existing `integrate-upstream-0.2.3` branch.
- Do not amend, squash or rewrite commits `591d3d45` or earlier.
- Do not use `git add -A` or `git add .`; stage only the explicit path lists below.
- Do not add `public/assets/`, `.local/`, credentials, packages, archives, databases or generated `data/*.json`.
- Do not push to `upstream` or `master`. Initial work ends with local commits and `review_ready`; push to `origin`
  happens only after Codex accepts the exact commits.
- Do not begin TASK-015 or merge/fetch-apply upstream v0.2.5 during this task. The tag fetch already performed is
  read-only and is not part of the checkpoint commits.

## Starting inventory

### Already committed, not yet on origin — preserve, audit, do not rewrite

- `591d3d45` — TASK-008 revised diagnosis report.
- `80430f6b` — TASK-009 wrapper reconnaissance; it also captured contemporaneous operations-log entries written by
  Codex. Record this mixed documentation provenance; do not rewrite the commit.
- `3cae20c2` — production browser gate deployment record (later renumbered TASK-020).
- `986aeaa6` — nginx media-cache header deployment record (later renumbered TASK-021).
- `4613bb31` — task-number collision correction.
- `35ecd33e` — bandwidth monitoring sample and TASK-021 follow-up.
- `a0503d46` — TASK-022 media ETag fix, implemented locally and not deployed.

These commits appeared while Codex was writing the checkpoint plan. TASK-017 treats `a0503d46` as the new immutable
starting point and audits the seven-commit chain; it must not reset to the older `591d3d45` snapshot.

### Checkpoint A — TASK-014 runtime/UI topic

Stage exactly:

```text
public/css/screens/game.css
public/js/ui/hud.js
test/ui/top-hud-art.test.js
docs/tasks/TASK-014-top-hud-official-art.md
```

Expected commit message:

```text
TASK-014: replace top HUD frame and rest capsule
```

The two supplied PNGs stay ignored and uncommitted. Verify and record their installed SHA256 values before committing:

- `public/assets/ui/hudPanel/frame_mid_normal.png` — `4FA2E8DCD1A5F3B8F8EAB748524A9FF41823EDBC4DDD11AAEB35D64E7EB05704`
- `public/assets/ui/hudPanel/bg_rest.png` — `4B0EDA5EBF8301E45C1ED9489B32EA59056817F16534E4C5689E8640449464BA`

The original ignored files are backed up under `.local/task-014-top-hud-art/original/`; do not delete or stage them.

### Checkpoint B — governance and future-task topic

After Checkpoint A succeeds, stage exactly:

```text
PROJECT-STATUS.md
docs/ops/2026-10.md
docs/tasks/README.md
docs/tasks/TASK-007-native-fullscreen-button.md
docs/tasks/TASK-008-mobile-blur-diagnosis.md
docs/PAPER-0.2.4-SELECTIVE-PORT-PLAN.md
docs/tasks/TASK-010-bounded-resource-preload.md
docs/tasks/TASK-011-live-combat-statistics.md
docs/tasks/TASK-012-quick-matchmaking.md
docs/tasks/TASK-013-teamspeak-room-voice.md
docs/tasks/TASK-015-upstream-0.2.5-integration.md
docs/tasks/TASK-016-release-0.2.5.md
docs/tasks/TASK-017-workspace-git-checkpoint.md
docs/tasks/TASK-018-version-client-wrapper.md
docs/tasks/TASK-022-media-etag-validator.md
```

Expected commit message:

```text
docs: checkpoint roadmap for v0.2.5 integration
```

Review every new task document before staging. If its content does not match `PROJECT-STATUS.md`, stop and report the
conflict rather than editing implementation files opportunistically.

`docs/analysis/native-client-wrapper-reconnaissance.md` appeared while this plan was being written and is referenced
by TASK-009 plus the operations log. It is already preserved in commit `80430f6b`; verify that it changed no file under
`F:\DSH-workspace\stronghold-app`, but do not stage it again or begin TASK-009 implementation.

## Required procedure

1. Re-run the starting inventory and confirm HEAD, branch, origin hash and dirty paths match this task.
2. Run Checkpoint A's tests before staging. Inspect `git diff --` for its four paths, then stage only those paths.
3. Inspect both `git diff --cached --stat` and the complete cached diff. Commit only if no unrelated hunk is present.
4. Confirm the remaining dirty tree contains only Checkpoint B paths.
5. Run documentation checks, inspect the complete Checkpoint B diff, stage only its explicit paths and commit.
6. Prove the final tracked tree is clean, ignored assets still exist with the recorded hashes, and the branch is nine
   commits ahead of origin: the seven preserved commits plus Checkpoints A and B.
7. Record both new commit hashes and all verification output in this task and `docs/ops/2026-10.md`. Because that
   record changes tracked files after Checkpoint B, make one final documentation-only checkpoint **only if needed**;
   if made, explain why the ahead count is ten instead of nine.
8. Mark TASK-017 `review_ready` and stop. Do not push.

## Acceptance checks

- `node --test test/ui/top-hud-art.test.js test/ui/gameLogic.test.js test/ui/playtest6-bosshud.test.js` passes.
- `node --test test/package.test.js test/docs-consistency.test.js test/docs-paths.test.js` passes.
- `npx eslint public/js/ui/hud.js test/ui/top-hud-art.test.js` has no new error; pre-existing warnings are named.
- `git diff --check` passes before each commit.
- The final `git status --short` is empty for tracked/untracked deliverables; ignored local assets remain present.
- `git log --oneline origin/integrate-upstream-0.2.3..HEAD` shows only the expected checkpoint chain.
- No commit contains `public/assets/`, `.local/`, archives, packages, databases, secrets or upstream v0.2.5 code.

## Protected areas

- No runtime edits beyond the already-reviewed TASK-014 four-path set.
- No server, simulation, protocol, package, release-manifest, account, room, record, client-wrapper or production edit.
- No build, deployment, service restart, update publication, tag creation or GitHub release.

## Current checkpoint

- Codex created this execution plan after inventorying the shared worktree on 2026-10-12. Concurrent DeepSeek work
  advanced HEAD from `591d3d45` to `a0503d46`; the plan was rebased conceptually (without rewriting Git history) onto
  that seven-commit local chain. The TASK-009 reconnaissance is now already committed, not part of Checkpoint B.
- Exact next action: DeepSeek verifies the starting inventory and performs Checkpoint A only.

## Review notes

Codex reviews commit boundaries, complete diffs, ignored-art hashes and the ahead-of-origin chain. After acceptance,
Codex may authorise pushing the existing branch to `origin`; only then can TASK-015 receive the final baseline hash.

## Rollback

Before push, rollback must be commit-specific and must preserve unrelated work. Do not use destructive tree-wide
commands. If a checkpoint is rejected, Codex will specify whether to add a correcting commit or revert that exact
commit. After push, use a normal revert commit; never rewrite the shared branch.
