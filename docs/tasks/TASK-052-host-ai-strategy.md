# TASK-052 — Host-assigned AI opening strategies

Status: `in_progress` (local integration only)

Owner: Codex

## Goal

Before starting a co-op room, let the host assign an opening strategy to each AI seat. A four-player pool group cannot take the same strategy twice.

## Scope

- Add a per-AI-seat strategy selector in the existing room UI without removing its current buttons or host options.
- Add a host-only, pre-start room protocol and server validation; preserve choices through room state/reconnect and pass them to the match.
- Apply the assignment on that AI's strategy-draft turn, without affecting a human's choice or other groups.
- Reject a duplicate assignment within one fixed group and recheck at match start when seats changed.

## Protected areas

- Preserve current human draft, AI-last option, solo mode, and standard bot fallback when no assignment is made.
- Do not change unrelated AI combat decisions, deploy, version, production or client update channels.
- Do not run tests/builds/screenshots without maintainer authorization.

## Acceptance checks

- Host may select a valid allowed strategy for each AI seat before start; non-host and post-start edits are rejected.
- Two AI/human picks in the same four-seat group cannot duplicate a strategy, but different groups may use the same one.
- Bot takes its assigned strategy on its draft turn; a stale or newly conflicting assignment safely falls back to an available choice.

## Checkpoint

- 2026-10-15: Current room has `aiPicksLast`, but no per-AI strategy field or protocol. `MatchPhases.scheduleBandBot` always calls `botPickBand`, and `bandTaken` checks the whole match. Depends on TASK-045 fixed group membership; no implementation yet.
- 2026-10-15: Added a selector per AI on the separate room-rules page, a host-only protocol with server-side mode/group validation, room-state persistence, start snapshot and bot-turn application. Group swaps clear a conflicting later AI assignment; a human pick that takes the assigned strategy before the bot acts triggers the standard available-strategy fallback. Group-local draft checks now permit the same strategy in different groups. Local-only, no project tests/builds/match trials or production deployment; maintainer validation is still required.

## Rollback

Remove the room message/state field and selector; bots retain their existing automatic strategy behavior.
