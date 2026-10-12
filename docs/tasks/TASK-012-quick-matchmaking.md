# TASK-012 — Instrumented quick matchmaking

Status: `planned`

Lead: Codex

Implementer: unassigned

Starting commit: assign when work begins

Depends on: TASK-005 accepted; room/account contracts stable

## Goal

Players can enter, inspect and cancel a quick-match queue that creates a normal room through the existing room
architecture; AI fill remains optional and disabled until the queue is validated.

## Scope

- Define queue identity, mode compatibility, cancellation, disconnect expiry and duplicate-session behavior.
- Create matched rooms through the current room service instead of a parallel room model.
- Add queue metrics and admin visibility without exposing account secrets.
- Put AI fill behind a server feature flag with an explicit timeout and clear player-facing state.
- Use Paper's matchmaking behavior as reference only; do not inherit hard-coded timing or server assumptions.

## Protected areas

- Existing room directory, room codes, host kick, account sessions and records remain authoritative.
- No silent AI insertion until the feature flag is enabled after review.
- No cross-server federation, hard-coded external node or room voice dependency.
- No production activation in the implementation task.

## Acceptance checks

- Queue join/cancel/reconnect/timeout/duplicate cases have deterministic server tests.
- A successful match creates a normal visible room and records the same lifecycle events as manual creation.
- Queue failure never strands an account or blocks manual room entry.
- AI fill disabled is the default and is covered by tests.
- Load tests document queue throughput and cleanup behavior.
- Targeted checks, `npm run ci` and `npm run golden` are recorded; goldens remain unchanged unless a separately
  approved gameplay change is made.

## Current checkpoint

- Planned only. Begin only after chat/announcement work is accepted and the room/account contracts are frozen.

## Review notes

- Reviewer must reject any second room store or client-authoritative queue decision.

## Rollback

Disable the matchmaking feature flag and stop accepting new queue entries; expire remaining queue state without
altering existing rooms, accounts or records.
