# TASK-012 — Instrumented quick matchmaking

Status: `review_ready`

Lead: Codex

Implementer: Codex

Starting commit: `64578102`, on top of the in-progress selective v0.2.5 worktree

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

- 2026-10-13: implemented the quick-match behavior against this fork's existing lobby. Queue by difficulty, prefer public recruiting rooms, otherwise create a normal four-human room. The host starts through the existing ready/start controls.
- Explicit cancellation, disconnect/manual-room-action cleanup, ten-minute expiry, bounded queue, rate limiting and change-only status broadcasts are implemented. No automatic AI fill.
- Membership/recruitment/privacy/grouping/expiry checks pass in `test/paper-integration.test.js`; live multiplayer interaction remains for the maintainer.
- 2026-10-13 (post-deployment CI repair): the quick-match panel's stylesheet had two gate failures from this batch — `.quick-match p` sized text with a plain `rem` (outside the `--t` text-scale system) and `public/index.html` loaded `/css/room-chat.css` after the must-be-last `/css/devices.css`. Fixed in `07c3fce5` and `399c5bbf`; `npm run ci` is green and both files are live on the server (details in `docs/ops/2026-10.md`, entry 02:25).


## Review notes

- Reviewer must reject any second room store or client-authoritative queue decision.

## Rollback

Disable the matchmaking feature flag and stop accepting new queue entries; expire remaining queue state without
altering existing rooms, accounts or records.
