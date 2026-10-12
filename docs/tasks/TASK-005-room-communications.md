# TASK-005 — Room text chat and announcement/admin tools

Status: `planned`

Owner: unassigned

## Goal

Selectively port useful Paper-Yuan room communication and operator tools while preserving this fork's room/account
architecture.

## Scope

- Room text chat with bounded history, length limits, rate limits and account identity.
- Optional in-room floating message presentation that can be disabled locally.
- Scheduled announcements and authenticated administrator broadcast/player-management endpoints.
- Audit every privileged operation.

## Explicit exclusions

- Room voice, WebRTC signaling and microphone permissions.
- Wholesale Paper-Yuan merge.
- CDN activation, native Android Node runtime and disabled/stubbed server picker.

## Protected areas

- Existing room directory, host kick behavior, accounts/passwords and match records.
- No unauthenticated admin endpoint and no admin secret in browser-delivered source.

## Acceptance checks

- Chat is room-scoped, bounded and unavailable after leaving the room.
- Abuse controls and payload validation are covered by server tests.
- Admin operations require explicit authentication and produce an audit record.
- Feature can be disabled without breaking room play.

## Rollback

Disable the feature flag and remove chat/announcement handlers; room and account storage remain compatible.
