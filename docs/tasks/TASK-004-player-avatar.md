# TASK-004 — Account-bound selectable player avatar

Status: `planned`

Owner: unassigned

## Goal

Let an authenticated account select a player avatar that consistently identifies the player without allowing another
nickname session to overwrite it.

## Scope

- Store an avatar identifier on the existing account record; do not accept arbitrary external image URLs.
- Provide a curated selectable set from already distributed operator/avatar assets with a nickname-initial fallback.
- Display it in the title/lobby identity chip, room members, in-match team list, records and future room text chat.
- Keep alliance/band icons as separate gameplay information rather than replacing the player avatar.
- Define migration/default behavior for existing accounts.

## Protected areas

- No raw image upload in the first version.
- No asset redistribution beyond the existing client/resource policy.
- Do not weaken nickname/password ownership or expose account secrets through public room state.

## Acceptance checks

- Avatar choice persists across reconnects and devices for the same account.
- Invalid or unavailable avatar identifiers fall back safely.
- Public payload exposes only the selected identifier/resolved asset, never account credentials.

## Rollback

Ignore/remove the optional avatar field and restore nickname-initial fallback; existing account records remain valid.

## Preparation checkpoint

- Paper-Yuan does not provide a selectable account-avatar system. Its `PlayerAvatar` uses the alliance/band icon when
  present, otherwise the nickname's first character; bots use a robot glyph. This is effectively the same fallback as
  the current fork.
- Treat this as a new account feature, not a Paper-Yuan port.
