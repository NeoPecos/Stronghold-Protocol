# Agent Workflow

This workflow is mandatory for Codex, DeepSeek and any other coding agent. The goal is that work survives model quota,
context loss and agent changes without relying on chat history.

## Roles

- **Lead/reviewer (normally Codex):** defines scope, architecture, protected areas, acceptance checks and release plan;
  reviews implementation and decides whether it is safe to integrate.
- **Implementer (Codex or DeepSeek):** changes only the active task's scope, runs its checks and records a checkpoint.
- **Release operator:** works from an approved release file, verifies artifacts and backups, deploys, validates and can
  roll back. Implementation completion alone is not deployment approval.

One agent may hold multiple roles, but the checkpoints remain separate.

## Required files

1. `PROJECT-STATUS.md`: current production/repository truth and active task; keep it short.
2. `docs/tasks/TASK-*.md`: one independently reviewable change with scope, protected areas and acceptance checks.
3. `docs/ops/YYYY-MM.md`: append-only factual operation log; never store credentials or private keys.
4. `docs/releases/<version>.md`: exact release contents, frozen commit, artifacts, hashes, validation and rollback.

## Task lifecycle

1. Lead creates the task and marks it `planned`.
2. Implementer records its starting commit and dirty-tree assumptions, then marks it `in_progress`.
3. At every meaningful checkpoint, update completed work, files changed, tests, failures and the exact next action.
4. Implementer marks `review_ready` only after the listed checks pass or failures are explicitly documented.
5. Reviewer compares the diff with the task, rejects scope creep and records `accepted` or returns it to
   `in_progress` with concrete fixes.
6. Release work references accepted task IDs; released tasks record the deployed build and rollback point.

Allowed statuses: `planned`, `in_progress`, `blocked`, `review_ready`, `accepted`, `released`, `cancelled`.

## Checkpoint rule

Checkpoint before a likely quota/context boundary and no later than roughly 60% of a large task. Do not leave a large
anonymous dirty tree. A useful checkpoint states:

- current commit/worktree;
- completed behavior;
- exact remaining behavior;
- changed files and their provenance;
- tests run and exact failures;
- next safe command or edit;
- whether anything reached GitHub or production.

## Change and review boundaries

- One task must remain independently testable and revertible.
- Imported fork code is ported selectively; never merge a large foreign tree to obtain one feature.
- Generated data, game assets, client shells and server deployment are separate review areas.
- Keep custom room/account/record/HUD behavior protected unless a task explicitly changes it.
- No agent may silently update golden files, release manifests or signed metadata to make checks green.
- Do not claim a feature is online based on local source, a build directory or an old operation note.

## Operation log format

Use one short entry per meaningful action:

```text
### YYYY-MM-DD HH:mm — TASK-XXX — actor
- Action: what changed or was inspected.
- Result: factual outcome.
- Verification: tests, commit, server response or artifact hash.
- Next: exact next action or `none`.
- Production/GitHub: unchanged, or the precise update.
```

## Periodic compaction

- After each release, refresh `PROJECT-STATUS.md` and close/relabel included tasks.
- At month end, keep the monthly log immutable and start a new file.
- When a handoff grows beyond practical reading size, move it under `docs/ops/archive/` and leave a short index entry.
- Compaction summarizes; it never deletes evidence needed for rollback or incident review.
