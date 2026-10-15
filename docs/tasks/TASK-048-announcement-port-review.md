# TASK-048 — Announcement system selective port review

Status: `review_ready` (local only; no tests or visual verification run)

Lead: Codex

Starting commit: `4c517699`; existing TASK-044 through TASK-047 and 0.2.6 work is uncommitted.

## Goal

Replace the weak browser notice and ephemeral announcement interface with the richer system in `LongQianChen/Stronghold-Protocol`.

## Source and current state

- Reviewed `LongQianChen/Stronghold-Protocol` `feat/IncreasePlayerCapacity` at `d7d541e7` and its `docs/ANNOUNCEMENTS.md`: history, Markdown/images/links, pinning, manual reopen, suppression of ordinary auto-open during a match, and explicit urgent notices.
- Current project has a browser-only fixed QQ/update notice (`public/js/ui/notice.js`, `public/index.html`) and a separate ephemeral admin broadcast (`server/announcements.js`, `server/http/routes.js`). Neither is a durable history/archive.
- `Paper-Yuan/Stronghold-Protocol` `0.2.6` at `d0d2023d` has a hard-coded title banner plus scheduled admin broadcast; it is not the richer announcement UI requested here.

## Approved scope

- Port the historical read-only announcement API, safe Markdown renderer, client history panel and publication tooling selectively; adapt to our routing/i18n and current title/lobby design.
- Replace the old hard-coded browser notice and ephemeral announcement interface; do not migrate their content or routes. Explicit urgent delivery remains a separate, deliberate action.
- Keep private Markdown/image storage outside `public`; use the existing server and CDN routing conventions. Do not merge the full capacity fork or replace room/account/combat UI.

## Protected areas

- Unrelated admin kick behavior stays; only announcement behavior is replaced.
- No deployment, server restart, client packaging, version bump, Git push or project tests without a later explicit maintainer request.

## Acceptance checks

- Browser title/lobby users can read historical announcements; pinned entry and re-open behavior are clear on desktop and mobile.
- Ordinary publication never interrupts a live/recovering match; urgent delivery is explicit.
- Content cannot execute HTML/script or read arbitrary server files.

## Current checkpoint

- Imported the fork's bounded announcement index/store, private raster-asset route, safe Markdown reader, command-line publisher, and explicit urgent-notice spool/monitor. Adapted the store name, server entry point, HTTP routes, and WebSocket message type to this fork.
- Mounted the new title/lobby entries and ordinary/urgent dialogs. Removed the hard-coded browser notice, old browser dismissal key/flow, and ephemeral `/api/admin/announcement{,/cancel}` routes; preserved authenticated `/api/admin/kick` through `RoomAdmin`.
- Added all four language packs' missing announcement strings, private-data ignore rule, publishing guide and focused source tests. Existing browser-notice tests were replaced rather than kept with invalid expectations.
- Reconciled the player-package file list and synthetic package fixture so the announcement guide and publisher are included after these new files are tracked. Corrected copied type references to the renamed local store.
- Existing QQ/update text is intentionally **not** migrated. The new archive starts empty until the maintainer publishes a Markdown notice; a release should include publication timing if a visible notice is desired immediately.
- No project tests, builds, screenshots or device verification run, as required by the repository owner. Static source compatibility was inspected only; runtime/visual acceptance remains with the maintainer.
- Next: maintainer reviews the local title/lobby announcement entry, publication/urgent behavior, and old-interface removal; request a separate release after other active work is reconciled.
- GitHub/production unchanged.

## Rollback

Before release, revert only TASK-048 implementation hunks, leaving TASK-044 through TASK-047 and the 0.2.6 work untouched. Any later release plan must back up `runtime/announcements` (or `SP_ANNOUNCEMENTS_DIR`) and document restoration of the previous static files, routes, and server process.
