# TASK-046 — Host spectator switch and recruitment label

Status: `review_ready` (local only; visual/gameplay acceptance pending)

Owner: Codex

Starting commit: `4c517699` in `F:\DSH-workspace\stronghold-026-integration`; existing 0.2.6, TASK-044 and TASK-045 work is already dirty and must remain intact.

## Goal

Let the co-op host turn new spectating on or off from the room page. Stop showing the “期望路人加入” directory label once the match has started.

## Scope

- Add a third switch in existing room settings; preserve existing room actions and styling.
- Send the room spectator setting in room state/list; enforce it at the server spectate entry point, including code-based entry.
- Hide recruitment state in running-match directory rows without clearing the saved room preference.
- Translate new text and document protocol behavior.

## Protected areas

- Do not replace room/lobby UI, spectator seat count, capacity work, avatars, game flow or CDN behavior.
- No deploy, restart, version bump, Git push, build or tests without a later explicit maintainer request.

## Acceptance checks

- Co-op host can toggle; guests see the state but cannot change it; solo rooms have no switch.
- Closed room rejects new spectators by list or code while current spectators/reconnects remain; reopening restores admission.
- Running rooms never show the recruitment label; after a match, the saved recruitment choice can show again.
- Maintainer owns runtime and visual verification unless separately authorizing agent checks.

## Checkpoint

- Added `allowSpectators` default-on room setting, protocol command, host-only handler, server admission guard, directory visibility, room switch and translated error/label.
- Kept old spectators when the switch closes; a viewer already in the room remains idempotently admitted.
- No tests, builds or visual verification run by the agent per repository owner instructions.
- Next: maintainer checks local UI and behavior, then requests any changes or separate release.
- GitHub/production: unchanged.

## Rollback

Revert only TASK-046 changes in the listed room, lobby, protocol, translation and documentation files; preserve all other dirty work. No server rollback until an explicitly approved release.
