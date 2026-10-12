# TASK-001 — Durable multi-agent project workflow

Status: `accepted`

Owner: Codex

## Goal

Make repository state, task ownership, operation history and release truth understandable without chat history so work
can move safely between Codex and DeepSeek.

## Delivered

- Added `PROJECT-STATUS.md` as the single current-state entry point.
- Added mandatory workflow rules to `AGENTS.md` and `docs/WORKFLOW.md`.
- Added indexed task, operation-log and release-record directories.
- Recorded the verified production baseline and created the first update-preparation tasks.
- Preserved the old handoff as historical evidence instead of deleting it.

## Acceptance

- A new agent can identify production versions, the active task, protected areas and the next action from repository
  documents alone.
- Historical notes cannot silently override freshly verified production state.
- Every future feature and release has an explicit checkpoint location.

## Rollback

Revert only the documentation changes introduced by TASK-001. No runtime or production files are changed.
