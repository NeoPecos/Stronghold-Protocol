# TASK-044 — Four spectator seats and searchable avatar variants

Status: `review_ready` (maintainer visual/gameplay acceptance pending)

Owner: Codex

Starting commit: `4c517699` in `F:\DSH-workspace\stronghold-026-integration` (detached HEAD; existing staged and unstaged work is out of scope)

## Goal

Allow four spectators per co-op room and let an account choose an operator's base, Elite 2, or installed skin avatar through search rather than an initial browsable catalogue.

## Scope

- Raise the shared spectator cap from two to four without changing player seats or spectator permissions.
- Extend account-avatar identifiers and resolution using the existing `data/assets.json` avatar URLs; keep old base-avatar IDs valid.
- Search operator and skin names in the avatar picker; do not show the full catalogue before a query.
- Update current user-facing docs and the existing spectator-cap assertion.

## Protected areas

- No game-rule, match, CDN, native-bundle, or account-credential changes.
- Do not hand-edit generated asset data or add game art to Git.
- Do not deploy, publish, bump versions, or touch unrelated dirty work.

## Acceptance checks

- Four spectators can join; a fifth receives `ROOM_FULL`; the lobby displays the shared cap.
- Existing base-avatar choices remain valid across account sync; E2 and skin choices resolve to their actual asset URLs and reject unknown IDs.
- The picker initially shows no avatar catalogue and filters by entered operator/skin text.
- Maintainer performs gameplay and visual checks; no agent-run test or rendering without explicit request.

## Current checkpoint

- Shared spectator admission and room display now use a cap of 4. The existing lobby cap scenario was updated for four admitted spectators and a rejected fifth.
- Added a shared avatar URL resolver for base, E2 and skin IDs; client picker, room and match player portraits, and server semantic validation use the same resolver. Existing base IDs remain valid.
- The picker has no initial catalogue, searches operator/skin names, and shows only matching variants. Asset inventory: 210 base, 194 E2, 174 installed skin avatars; no new art was added.
- Changed: `shared/{constants,protocol,playerAvatar}.js`, `server/lobby.js`, `public/js/ui/{avatar,avatarPicker,gameComponents}.js`, `public/css/components.css`, four i18n packs, `test/lobby.test.js`, current docs and this task file. The avatar picker also had its existing i18n import path corrected.
- Tests/builds/screenshots run: none (maintainer instruction). Production/GitHub: unchanged; existing dirty work was not staged, committed or released.
- Next: maintainer checks a four-spectator room and the avatar picker on browser/native devices, then decides on a separately approved release. Existing native packages cannot display new variant IDs until their web code is updated.

## Rollback

Restore `MAX_SPECTATORS = 2` and previous account-avatar resolver/picker files. Already saved base-avatar IDs remain valid; unknown new variant IDs safely fall back until changed by the account owner.
