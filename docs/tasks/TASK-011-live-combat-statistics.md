# TASK-011 — Live per-operator combat statistics

Status: `review_ready`

Lead: Codex

Implementer: Codex

Starting commit: `64578102`, on top of the in-progress selective v0.2.5 worktree

Depends on: performance phases stable; existing record schema reviewed

## Goal

Add an optional in-match per-operator damage and DPS view using the same authoritative events and identities as the
existing post-match records and group-card output.

## Scope

- Map the current record collector's damage events, player identity and operator identity.
- Add only missing counters needed for live damage and average DPS.
- Build a compact optional panel that can be hidden and remains readable on measured mobile viewports.
- Reconcile final live totals with the stored match record and card payload.
- Treat Paper's damage panel as a UI reference, not a second statistics engine.

## Protected areas

- Do not replace or fork the existing records/cards pipeline.
- Do not reveal another room's private statistics or accept client-authored authoritative totals.
- Do not move or restyle the custom combat HUD outside the panel's explicitly allocated area.
- No gameplay, targeting or damage-calculation change.

## Acceptance checks

- Live totals and the completed record agree for deterministic fixtures.
- Reconnect/spectate cannot duplicate damage or attribute it to the wrong player/operator.
- The panel is optional, keyboard/touch accessible and does not overlap critical controls at target mobile sizes.
- Record/card backward compatibility is covered by tests.
- Targeted checks, `npm run ci` and `npm run golden` are recorded; goldens remain unchanged.

## Current checkpoint

- 2026-10-13: adapted Paper's `damageStats.js` and `damagePanel.js`, connected the panel to the battle screen's DPS button and existing modal behavior. It follows the displayed field and lists operators with their owner, damage and average DPS.
- Reads the same `unit.stats.dmg` counters used by `Battle.result().perPlayer[].unitStats`; there is no second accumulator or record upload. Simulation time excludes pause; independent non-operator summons are outside this operator-only table.
- Existing records/card formats remain unchanged. Read-only counter and zero-time checks pass; actual viewing/closing/spectating is left to the maintainer.


## Review notes

- Reviewer must confirm one statistics truth and inspect reconnect/spectator behavior.

## Rollback

Disable and remove the live panel/counters while keeping the existing stored record schema readable. Any additive
stored fields must be optional so rollback needs no destructive migration.
