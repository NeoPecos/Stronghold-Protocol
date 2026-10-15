# TASK-054 — Bound the 20-player strategy order list

Status: `in_progress` (local UI only)

Owner: Codex

## Goal

Keep all 20 participants reachable in the opening-strategy decision-order sidebar without clipping its footer controls.

## Scope

- Give the member list its own vertical scrolling region while keeping its heading, match-information button and tip in place.
- Preserve the existing draft layout and behavior for solo and four-player rooms.

## Protected areas

- Do not change draft rules, production assets, version numbers or deployment state.
- Do not run tests, builds or screenshots unless the maintainer requests them.

## Acceptance checks

- Every member row can be reached with vertical scrolling on a 20-player draft.
- The match-information button and tip remain accessible; the four-player layout is unchanged.

## Checkpoint

- 2026-10-15: The owner supplied a screenshot of the 20-player draft with the left order list extending below the viewport. Wrapped the rows in a flex child with bounded overflow and a thin scrollbar. Local-only; no render/test/build validation or deployment. Next: owner visual acceptance on a 20-player draft.
- Source review: rows now have fixed flex height so the list scrolls instead of compressing all 20 rows. No rendering, automated check or release was performed.

## Rollback

Remove the list wrapper and its `.draft-order__list` style only.
